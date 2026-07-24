(() => {
  let theme = 'dark';
  try {
    theme = globalThis.localStorage.getItem('token-orb:theme') === 'light' ? 'light' : 'dark';
  } catch {
    theme = 'dark';
  }
  globalThis.document.documentElement.dataset.theme = theme;
})();
