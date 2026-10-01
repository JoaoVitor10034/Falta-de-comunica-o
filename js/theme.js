// Aplicado antes da pintura da página para evitar flashes ao usar o tema escuro.
(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const defaults = { theme: 'system', accent: 'green' };
  let settings;
  try { settings = { ...defaults, ...JSON.parse(localStorage.getItem('sesi_appearance') || '{}') }; }
  catch { settings = { ...defaults }; }
  const apply = () => {
    if (!['green', 'blue'].includes(settings.accent)) settings.accent = 'green';
    document.documentElement.dataset.theme = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
    document.documentElement.dataset.accent = settings.accent;
  };
  window.portalAppearance = {
    get: () => ({ ...settings }),
    set: next => {
      const updated = { ...settings, ...next };
      if (!['light', 'dark', 'system'].includes(updated.theme) || !['green', 'blue'].includes(updated.accent)) throw new Error('Aparência inválida.');
      localStorage.setItem('sesi_appearance', JSON.stringify(updated));
      settings = updated; apply();
    }
  };
  media.addEventListener('change', apply);
  addEventListener('storage', event => {
    if (event.key !== 'sesi_appearance') return;
    try { settings = { ...defaults, ...JSON.parse(event.newValue || '{}') }; apply(); } catch {}
  });
  apply();
})();
