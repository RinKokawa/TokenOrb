(() => {
  let theme = 'dark';
  let accent = 'classic';
  try {
    theme = globalThis.localStorage.getItem('token-orb:theme') === 'light' ? 'light' : 'dark';
    const storedAccent = globalThis.localStorage.getItem('token-orb:accent');
    accent = ['classic', 'gold', 'pink', 'ocean'].includes(storedAccent) ? storedAccent : 'classic';
  } catch {
    theme = 'dark';
    accent = 'classic';
  }
  globalThis.document.documentElement.dataset.theme = theme;
  globalThis.document.documentElement.dataset.accent = accent;
})();
