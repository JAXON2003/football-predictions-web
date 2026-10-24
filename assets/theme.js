// Apply the saved choice before styles paint, so navigation keeps the same theme.
(() => {
  const key = 'matchday:theme:v1';
  const root = document.documentElement;
  let selected = 'light';
  try { if (localStorage.getItem(key) === 'dark') selected = 'dark'; } catch { /* Themes still work without storage. */ }
  function apply(theme) {
    selected = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = selected;
    const label = `Switch to ${selected === 'dark' ? 'light' : 'dark'} theme`;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.hidden = false;
      button.setAttribute('aria-label', label);
      button.title = label;
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'dark' ? '#10141d' : '#f3f0e8');
  }
  apply(selected);
  document.addEventListener('DOMContentLoaded', () => {
    apply(selected);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
      apply(selected === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, selected); } catch { /* Keep the in-memory choice. */ }
    }));
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue === 'dark' ? 'dark' : 'light');
  });
})();
