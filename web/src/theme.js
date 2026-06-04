// ── Theme definitions ────────────────────────────────────────
const THEMES = {
  dark: {
    '--bg0-hard':  '#1d2021',
    '--bg0':       '#282828',
    '--bg0-soft':  '#32302f',
    '--bg1':       '#3c3836',
    '--bg2':       '#504945',
    '--bg3':       '#665c54',
    '--bg4':       '#7c6f64',
    '--fg':        '#ebdbb2',
    '--fg1':       '#d5c4a1',
    '--fg2':       '#bdae93',
    '--fg3':       '#a89984',
    '--fg4':       '#928374',
    '--glass':     'rgba(29,32,33,0.75)',
    '--glass-mid': 'rgba(40,40,40,0.60)',
    '--glass-light':'rgba(60,56,54,0.40)',
    '--glass-border':'rgba(235,219,178,0.06)',
  },
  light: {
    '--bg0-hard':  '#f9f5d7',
    '--bg0':       '#fbf1c7',
    '--bg0-soft':  '#f2e5bc',
    '--bg1':       '#ebdbb2',
    '--bg2':       '#d5c4a1',
    '--bg3':       '#bdae93',
    '--bg4':       '#a89984',
    '--fg':        '#3c3836',
    '--fg1':       '#504945',
    '--fg2':       '#665c54',
    '--fg3':       '#7c6f64',
    '--fg4':       '#928374',
    '--glass':     'rgba(251,241,199,0.82)',
    '--glass-mid': 'rgba(242,229,188,0.75)',
    '--glass-light':'rgba(235,219,178,0.60)',
    '--glass-border':'rgba(60,56,54,0.12)',
  },
};

export function applyTheme(theme) {
  const vars = THEMES[theme] || THEMES.dark;
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.dataset.theme = theme;
}

export function getStoredTheme() {
  return localStorage.getItem('zn_theme') || 'dark';
}

export function saveTheme(theme) {
  localStorage.setItem('zn_theme', theme);
  applyTheme(theme);
}
