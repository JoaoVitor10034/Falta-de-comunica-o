// Teste de integração sem dependências: duas abas reais do Chrome via CDP.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': (mime[extname(path)] || 'application/octet-stream') + '; charset=utf-8' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const profileDir = await mkdtemp(resolve(tmpdir(), 'sesi-browser-'));
const browser = spawn(process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
try {
  const endpoint = await new Promise((resolveUrl, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Chrome não iniciou.')), 15000);
    browser.on('error', err => { clearTimeout(timeout); reject(err); });
    browser.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timeout); resolveUrl(match[1]); } });
  });
  ws = new WebSocket(endpoint);
  await new Promise((r, reject) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolveCall, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(key, { resolve: resolveCall, reject, timer }); ws.send(JSON.stringify({ id: key, method, params, sessionId }));
  });
  const evaluate = async (session, expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (session, expression) => {
    for (let i = 0; i < 120; i++) { if (await evaluate(session, expression)) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error('Condição não atendida: ' + expression);
  };
  const newTab = async email => {
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    await call('Runtime.enable', {}, sessionId);
    await call('Page.enable', {}, sessionId);
    await call('Page.navigate', { url: origin + '/login.html' }, sessionId);
    await waitFor(sessionId, '!!document.querySelector("#email")');
    await evaluate(sessionId, `import('./js/auth.js').then(async m => { await m.login(${JSON.stringify(email)}, 'demo'); location.href = 'dashboard.html'; })`);
    await waitFor(sessionId, '!!document.querySelector(".hero")');
    return sessionId;
  };
  const admin = await newTab('admin@demo'), student = await newTab('aluno@demo');
  await evaluate(student, 'location.hash = "#/disciplinas"');
  await waitFor(student, 'document.querySelectorAll(".subject-card").length === 19');
  await evaluate(student, `document.querySelector('#subject-search').value = 'educacao fisica'; document.querySelector('#subject-search').dispatchEvent(new Event('input'));`);
  assert.equal(await evaluate(student, 'document.querySelectorAll(".subject-card").length'), 1);
  await evaluate(student, 'document.querySelector(".subject-card").click()');
  await waitFor(student, '!!document.querySelector(".subject-hero")');
  assert.equal(await evaluate(student, '!!document.querySelector("[data-publish]")'), false);

  const before = await evaluate(student, 'document.querySelector(".count").textContent');
  await evaluate(admin, 'location.hash = "#/disciplina/s16"');
  await waitFor(admin, '!!document.querySelector(".subject-hero [data-publish]")');
  await evaluate(admin, 'document.querySelector(".subject-hero [data-publish]").click()');
  await waitFor(admin, '!!document.querySelector("#pf")');
  await evaluate(admin, `document.querySelector('#f_title').value = 'Guia de Biologia — teste'; document.querySelector('#f_description').value = ${JSON.stringify('Orientações de estudo para a turma.\nRevisar ecologia.')}; document.querySelector('#pf').requestSubmit();`);
  await waitFor(admin, '!document.querySelector("#pf")');
  await waitFor(student, `document.querySelector('.count').textContent !== ${JSON.stringify(before)}`);
  await evaluate(student, 'document.querySelector(".bell").click()');
  await waitFor(student, 'document.querySelector(".nlist").textContent.includes("Guia de Biologia — teste")');
  await evaluate(student, `[...document.querySelectorAll('.nitem')].find(b => b.textContent.includes('Guia de Biologia — teste')).click()`);
  await waitFor(student, '!!document.querySelector("[data-source]")');
  await evaluate(student, 'document.querySelector("[data-source]").click()');
  await waitFor(student, 'document.querySelector(".subject-hero h1")?.textContent === "Biologia"');
  assert.ok(await evaluate(student, 'document.querySelector("#channel-results").textContent.includes("Guia de Biologia — teste")'));

  await evaluate(admin, 'location.hash = "#/admin"');
  await waitFor(admin, '!!document.querySelector("[data-compose]")');
  await evaluate(admin, 'document.querySelector("[data-compose]").click()');
  await waitFor(admin, '!!document.querySelector("#cf")');
  await evaluate(admin, `document.querySelector('#ct').value = 'Mensagem direta — teste'; document.querySelector('#cm').value = 'Comunicado enviado pela administração.'; document.querySelector('#cf').requestSubmit();`);
  await waitFor(admin, '!!document.querySelector("[data-yes]")');
  await evaluate(admin, 'document.querySelector("[data-yes]").click()');
  await waitFor(student, 'document.querySelector(".nlist").textContent.includes("Mensagem direta — teste")');

  await evaluate(student, 'location.hash = "#/mural"');
  await waitFor(student, '!!document.querySelector("#feed-search")');
  await evaluate(student, `document.querySelector('#feed-search').value = 'Guia de Biologia'; document.querySelector('#feed-search').dispatchEvent(new Event('input'));`);
  assert.equal(await evaluate(student, 'document.querySelectorAll(".publication").length'), 1);
  await evaluate(student, 'location.hash = "#/disciplinas"');
  await waitFor(student, 'document.querySelectorAll(".subject-card").length === 19');
  const artifacts = resolve(root, 'test-artifacts'); await mkdir(artifacts, { recursive: true });
  for (const [width, height, name] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }, student);
    await evaluate(student, 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    assert.ok(await evaluate(student, 'document.documentElement.scrollWidth <= innerWidth'), 'Layout excede a tela em ' + name);
    const shot = await call('Page.captureScreenshot', { format: 'png' }, student);
    await writeFile(resolve(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
  }
  await evaluate(student, 'location.hash = "#/perfil/configuracoes"');
  await waitFor(student, '!!document.querySelector("input[value=dark]")');
  await evaluate(student, 'document.querySelector("input[value=dark]").click(); document.querySelector("input[value=blue]").click()');
  assert.equal(await evaluate(student, 'document.documentElement.dataset.theme'), 'dark');
  await call('Page.reload', {}, student);
  await waitFor(student, '!!document.querySelector("input[value=dark]:checked")');
  assert.equal(await evaluate(student, 'document.documentElement.dataset.accent'), 'blue');
  await evaluate(student, 'location.hash = "#/perfil/conta"');
  await waitFor(student, '!!document.querySelector("#profile-form")');
  await evaluate(student, `document.querySelector('#profile-name').value = 'Ana Teste'; document.querySelector('#profile-bio').value = 'Estudante de música'; document.querySelector('#profile-form').requestSubmit();`);
  await waitFor(student, 'document.querySelector(".profile-heading h1")?.textContent === "Ana Teste"');
  assert.equal(await evaluate(student, '!!document.querySelector("a[href*=chat]")'), false);
  await evaluate(student, 'location.hash = "#/perfil/configuracoes"');
  await waitFor(student, '!!document.querySelector("input[value=light]")');
  await evaluate(student, 'document.querySelector("input[value=light]").click()');
  assert.equal(await evaluate(student, 'document.documentElement.dataset.theme'), 'light');
  assert.equal(await evaluate(student, '!!document.querySelector("input[value=red]")'), false);
  await evaluate(student, 'location.hash = "#/perfil/geral"');
  await waitFor(student, '!!document.querySelector(".profile-shortcuts")');
  assert.equal(await evaluate(student, '!!document.querySelector("a[href*=chat]")'), false);
  await evaluate(student, 'localStorage.setItem("sesi_appearance", JSON.stringify({theme:"dark", accent:"red"}))');
  await call('Page.reload', {}, student);
  await waitFor(student, '!!document.querySelector(".profile-shortcuts")');
  assert.equal(await evaluate(student, 'document.documentElement.dataset.accent'), 'green');
  const teacher = await newTab('prof@demo'), monitor = await newTab('monitor@demo');
  await evaluate(monitor, 'document.querySelector("#header-publish").click()');
  await waitFor(monitor, '!!document.querySelector("#pf")');
  await evaluate(monitor, `document.querySelector('#type').value='assignments';document.querySelector('#type').dispatchEvent(new Event('change'));document.querySelector('#f_title').value='Projeto revisado pelo professor';document.querySelector('#f_due_date').value='2026-10-15';document.querySelector('#f_reason').value='Apoio ao professor responsável';document.querySelector('#pf').requestSubmit();`);
  await waitFor(monitor, '!document.querySelector("#pf")');
  const pendingId = await evaluate(monitor, `JSON.parse(localStorage.getItem('sesi_demo2')).assignments.find(p=>p.title==='Projeto revisado pelo professor').id`);
  assert.equal(await evaluate(student, `import('./js/community.js').then(async m=>(await m.publications({id:'u1',role:'student'})).rows.some(r=>r.id===${JSON.stringify(pendingId)}))`), false);
  await evaluate(teacher, 'location.hash="#/gestao"');
  await waitFor(teacher, '!!document.querySelector("[data-approve]")');
  await evaluate(teacher, 'document.querySelector("[data-approve]").click()');
  await waitFor(teacher, '!document.querySelector("[data-approve]")');
  await evaluate(student, `location.hash='#/publicacao/assignments/${pendingId}'`);
  await waitFor(student, '!!document.querySelector("[data-save]")');
  assert.equal(await evaluate(student, '!!document.querySelector("[data-edit]")'), false);
  await evaluate(student, 'document.querySelector("[data-save]").click()');
  await waitFor(student, 'document.querySelector("[data-save]")?.textContent.includes("Salvo")');
  await evaluate(student, 'document.querySelector("[data-read]").click()');
  await waitFor(student, 'document.querySelector("[data-read]")?.textContent.includes("Lido")');
  await evaluate(student, 'document.querySelector("[data-share]").click()');
  await waitFor(student, '!!document.querySelector("#qr-code canvas")');
  assert.ok(await evaluate(student, 'document.querySelector("#share-url").value.includes("#/publicacao/assignments/")'));
  await evaluate(student, 'document.querySelector(".modal [data-close]").click();location.hash="#/salvos"');
  await waitFor(student, 'document.querySelector("#notice-list")?.textContent.includes("Projeto revisado")');
  await evaluate(admin, 'document.querySelector("#header-publish").click()');
  await waitFor(admin, '!!document.querySelector("#pf")');
  await evaluate(admin, `document.querySelector('#f_title').value='Passaporte: oficina de projetos';document.querySelector('#pub-area').value='passaporte';document.querySelector('#pub-kind').value='Projeto';const transfer=new DataTransfer();transfer.items.add(new File(['Orientações fictícias da oficina'],'guia.txt',{type:'text/plain'}));document.querySelector('#pub-file').files=transfer.files;document.querySelector('#pf').requestSubmit();`);
  await waitFor(admin, '!document.querySelector("#pf")');
  await evaluate(student, 'location.hash="#/passaporte"');
  await waitFor(student, 'document.querySelector("#passport-items")?.textContent.includes("oficina de projetos")');
  await evaluate(student, 'document.querySelector("#passport-items h3 a").click()');
  await waitFor(student, '!!document.querySelector("[data-attachment]")');
  assert.ok(await evaluate(student, 'document.querySelector("[data-attachment]").textContent.includes("guia.txt")'));
  await evaluate(student, 'location.hash="#/busca?q=oficina"');
  await waitFor(student, 'document.querySelector("#search-results")?.textContent.includes("oficina de projetos")');
  await evaluate(student, 'location.hash="#/calendario"');
  await waitFor(student, 'document.querySelectorAll(".calendar-cell").length===42');
  const period = await evaluate(student, 'document.querySelector("#period-label").textContent');
  await evaluate(student, 'document.querySelector("[data-next]").click()');
  assert.notEqual(await evaluate(student, 'document.querySelector("#period-label").textContent'), period);
  await evaluate(student, 'window.portalAppearance.set({theme:"light",accent:"green"});location.hash="#/"');
  await waitFor(student, '!!document.querySelector(".campus-hero")');
  await call('Page.bringToFront',{},student);
  await evaluate(student,'new Promise(r=>setTimeout(r,3800))');
  for (const [width,height,name] of [[1440,1100,'dashboard-desktop'],[820,1180,'dashboard-tablet'],[390,844,'dashboard-mobile']]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768},student);
    await evaluate(student, 'new Promise(r=>setTimeout(r,700))');
    assert.ok(await evaluate(student,'document.documentElement.scrollWidth<=innerWidth'),'Dashboard excede '+name);
    const shot=await call('Page.captureScreenshot',{format:'png'},student);await writeFile(resolve(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));
  }
  await evaluate(student,'location.hash="#/tela"');
  await waitFor(student,'document.body.classList.contains("wall-mode")');
  await evaluate(student,'location.hash="#/perfil/configuracoes"');
  await waitFor(student,'!!document.querySelector("#notification-preference")');
  assert.equal(await evaluate(student,'document.body.classList.contains("wall-mode")'),false);
  await evaluate(student,'document.querySelector("#notification-preference").value="silent";document.querySelector("#notification-preference").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate(student,'localStorage.getItem("sesi_notifications_u1")'),'silent');
  await evaluate(admin,'location.hash="#/escola"');
  await waitFor(admin,'!!document.querySelector("#manage-person")');
  await evaluate(student,'location.hash="#/escola"');
  await waitFor(student,'document.querySelector("#view")?.textContent.includes("exclusiva")');
  assert.equal(await evaluate(student,'!!document.querySelector("#manage-person")'),false);
  await evaluate(admin,`location.hash='#/publicacao/assignments/${pendingId}'`);
  await waitFor(admin,'!!document.querySelector("[data-edit]")');
  await evaluate(admin,'document.querySelector("[data-edit]").click()');
  await waitFor(admin,'!!document.querySelector("#edit-post")');
  await evaluate(admin,'document.querySelector("#edit-date").value="2026-10-20";document.querySelector("#edit-post").requestSubmit()');
  await waitFor(admin,'!document.querySelector("#edit-post")');
  assert.equal(await evaluate(admin,`JSON.parse(localStorage.getItem('sesi_demo2')).assignments.find(r=>r.id==='${pendingId}').due_date`),'2026-10-20');
  await evaluate(student,'location.hash="#/"');
  await waitFor(student,'!!document.querySelector(".campus-hero")');
  await waitFor(student,'!!navigator.serviceWorker.controller');
  await call('Network.enable',{},student);
  await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},student);
  await call('Page.reload',{},student);
  await waitFor(student,'!!document.querySelector(".campus-hero")');
  assert.equal(await evaluate(student,'navigator.onLine'),false);
  await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},student);
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},student);
  assert.equal(await evaluate(student,'getComputedStyle(document.querySelector(".campus-hero img")).animationName'),'none');
  assert.deepEqual(errors, []);
  console.log('OK: edição de prazo, recarga offline do demo e preferência de movimento reduzido.');
  console.log('OK: quatro perfis, aprovação, anexos, QR local, salvos, pesquisa global, Passaporte, calendário, mural, preferências e dashboard em desktop/tablet/mobile.');
  console.log('OK: temas persistentes, perfil sem chat e sem destaque vermelho.');
  console.log('OK: 19 disciplinas, busca sem acentos, permissões, publicação admin → aluno entre abas, mensagem direta, leitura, navegação e layouts desktop/mobile.');
  await call('Browser.close');
} finally {
  ws?.close(); browser.kill(); server.close();
}
