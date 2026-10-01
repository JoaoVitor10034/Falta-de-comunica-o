import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())out.push(...await walk(path));else out.push(relative(root,path).replaceAll('\\','/'));}return out;}
const files=['index.html','dashboard.html','login.html','manifest.json',...await walk(resolve(root,'js')),...await walk(resolve(root,'css')),...await walk(resolve(root,'assets'))].filter(p=>!p.endsWith('.gitkeep'));
const hash=createHash('sha256');for(const path of files) hash.update(await readFile(resolve(root,path)));
const version=hash.digest('hex').slice(0,12);
await writeFile(resolve(root,'service-worker.js'),`// Gerado por npm run build:offline. Cache apenas de arquivos públicos da aplicação.
const CACHE='sesi-shell-${version}';
const ASSETS=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sesi-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin||!ASSETS.some(p=>new URL(p,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));
});
`);
console.log(`Cache offline: ${files.length} arquivos, versão ${version}.`);
