import qrcode from './qrcode-generator.js';
export default { toCanvas(canvas, text, { width = 240, margin = 3 } = {}) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const count = qr.getModuleCount(), scale = Math.max(1, Math.floor(width / (count + margin * 2)));
  canvas.width = canvas.height = (count + margin * 2) * scale;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y,x)) ctx.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
} };
