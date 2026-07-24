export type Theme = 'dark' | 'light';

export const themeStorageKey = 'token-orb:theme';

export const getStoredTheme = (): Theme => {
  try {
    return window.localStorage.getItem(themeStorageKey) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
};

export const setStoredTheme = (theme: Theme): void => {
  applyTheme(theme);
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    return;
  }
};

export const initializeStoredTheme = (): Theme => {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
};
