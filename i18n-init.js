// Runs before paint. The reader's explicit choice takes precedence over browser language.
(() => {
  let saved;
  try { saved = localStorage.getItem('the-hub-language'); } catch { /* Private browsing may deny storage. */ }
  const requested = new URLSearchParams(location.search).get('lang');
  const valid = value => ['fr', 'en'].includes(value);
  const preferred = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
  const language = valid(requested) ? requested : valid(saved) ? saved : preferred.startsWith('fr') ? 'fr' : 'en';
  document.documentElement.lang = language;
  window.hubInitialLanguage = language;
})();
