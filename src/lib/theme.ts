export type Theme = 'dark' | 'light';
export type Accent = 'classic' | 'gold' | 'pink' | 'ocean';

export const themeStorageKey = 'token-orb:theme';
export const accentStorageKey = 'token-orb:accent';
export const accentOptions: readonly Accent[] = ['classic', 'gold', 'pink', 'ocean'];

export const normalizeAccent = (value: string | null): Accent =>
  accentOptions.includes(value as Accent) ? (value as Accent) : 'classic';

export const getStoredTheme = (): Theme => {
  try {
    return window.localStorage.getItem(themeStorageKey) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const getStoredAccent = (): Accent => {
  try {
    return normalizeAccent(window.localStorage.getItem(accentStorageKey));
  } catch {
    return 'classic';
  }
};

const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
};

const applyAccent = (accent: Accent): void => {
  document.documentElement.dataset.accent = accent;
};

export const setStoredTheme = (theme: Theme): void => {
  applyTheme(theme);
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    return;
  }
};

export const setStoredAccent = (accent: Accent): void => {
  applyAccent(accent);
  try {
    window.localStorage.setItem(accentStorageKey, accent);
  } catch {
    return;
  }
};

export const initializeStoredTheme = (): Theme => {
  const theme = getStoredTheme();
  applyTheme(theme);
  applyAccent(getStoredAccent());
  return theme;
};
