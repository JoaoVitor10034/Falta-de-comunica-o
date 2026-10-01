if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
const banner = document.createElement('div'); banner.className = 'offline-banner'; banner.setAttribute('role','status'); document.body.append(banner);
const update = () => { banner.hidden = navigator.onLine; banner.textContent = 'Você está offline. No modo demo, seus dados continuam disponíveis neste navegador.'; };
addEventListener('online',update); addEventListener('offline',update); update();
