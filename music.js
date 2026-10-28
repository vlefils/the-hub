// One persistent Pekly player for the entire book. Never reload on route/language changes.
const frame = document.querySelector('[data-music-frame]');
const section = document.getElementById('outils-musique');
if (frame && section) {
  const t = text => window.HubI18n?.t(text) ?? text;
  const stateLabel = section.querySelector('[data-music-state]');
  const openButton = section.querySelector('[data-music-open]');
  const links = [...section.querySelectorAll('[data-music-track]')];
  let playing = false, started = false, currentId = '', currentTitle = '', ready = false;
  const player = () => frame.contentWindow?.HubMusic;
  const render = () => {
    stateLabel.textContent = currentTitle ? `${t(playing ? 'Lecture en cours' : started ? 'En pause' : 'Prêt à écouter')} · ${currentTitle}` : t('Le lecteur reste accessible en bas à droite sur tout le site.');
    buttons.forEach(button => button.setAttribute('aria-pressed', String(currentId === button.dataset.musicTrack)));
    document.body.classList.toggle('music-is-playing', playing);
  };
  let buttons = [];
  function enhanceCatalogue() {
    buttons = links.map(link => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = link.className; button.dataset.musicTrack = link.dataset.musicTrack;
      button.append(...link.childNodes); button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => player()?.select(button.dataset.musicTrack));
      link.replaceWith(button); return button;
    });
  }
  function update(state) {
    if (!['collapsed', 'player', 'playlist'].includes(state.mode)) return;
    frame.dataset.mode = state.mode;
    frame.style.setProperty('--music-player-height', `${Math.max(64, Math.min(260, Number(state.height) || 140))}px`);
    document.body.classList.toggle('music-player-expanded', state.mode !== 'collapsed');
    currentId = state.id; currentTitle = state.title; playing = Boolean(state.playing); started = Boolean(state.started);
    render();
  }
  function connect() {
    const api = player();
    if (!api) return;
    if (!ready) enhanceCatalogue();
    ready = true; frame.hidden = false; openButton.hidden = false;
    api.setLanguage(document.documentElement.lang); update(api.getState());
  }
  frame.addEventListener('load', connect);
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'hub:music') return;
    if (!ready) connect();
    update(event.data);
  });
  openButton.addEventListener('click', () => player()?.open(true));
  document.addEventListener('hub:languagechange', () => { player()?.setLanguage(document.documentElement.lang); render(); });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-music-open], [data-music-track]')) player()?.closePanels();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && frame.dataset.mode === 'playlist') { player()?.closePanels(); frame.focus(); }
  });
  // The game is a separate document: keep this tab and its soundtrack alive.
  for (const link of document.querySelectorAll('a[href^="rumbleball/"]')) {
    link.target = '_blank'; link.rel = 'noopener noreferrer';
  }
  frame.src = `vendor/pekly/player.html?lang=${document.documentElement.lang === 'en' ? 'en' : 'fr'}`;
  render();
}
