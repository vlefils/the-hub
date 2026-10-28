// The Hub adapter. The player itself remains in player.js (Pekly, MIT).
export function createSafeStorage() {
  const memory = new Map();
  const arrays = new Set(['favorites', 'order']);
  return {
    getItem(key) {
      let value;
      if (memory.has(key)) value = memory.get(key);
      else try { value = window.localStorage.getItem(`the-hub-${key}`); } catch { value = null; }
      if (value === null) return null;
      if ([...arrays].some(name => key.endsWith(`_${name}`)) || key === 'oss_play_counts') {
        try {
          const parsed = JSON.parse(value);
          if (key === 'oss_play_counts') return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? value : null;
          return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? value : null;
        } catch { return null; }
      }
      return value;
    },
    setItem(key, value) {
      memory.set(key, String(value));
      try { window.localStorage.setItem(`the-hub-${key}`, String(value)); } catch { /* Session-only preferences still work. */ }
    },
  };
}

const french = {
  'Playlist': 'The Hub · Playlist', 'Open Playlist': 'Ouvrir la playlist', 'Close Playlist': 'Fermer la playlist',
  'Settings': 'Réglages', 'Close Settings': 'Fermer les réglages', 'Themes': 'Thèmes',
  'Search...': 'Rechercher un morceau…', 'Search playlist': 'Rechercher dans la playlist',
  'Show Favorites Only': 'Afficher les favoris', 'Shuffle': 'Aléatoire', 'Repeat': 'Répéter',
  'Change Speed': 'Vitesse de lecture', 'Toggle Reverb': 'Activer ou désactiver la réverbération', 'Reverb': 'Réverb.',
  'Like Song': 'Ajouter aux favoris', 'Like this song': 'Ajouter aux favoris',
  'Previous': 'Précédent', 'Previous Song': 'Morceau précédent', 'Next': 'Suivant', 'Next Song': 'Morceau suivant',
  'Play/Pause': 'Lire / Pause', 'Play / Pause': 'Lire / Pause', 'Play or Pause': 'Lire ou mettre en pause',
  'Song progress': 'Position de lecture', 'Volume control': 'Volume', 'Mute/Unmute Volume': 'Couper ou rétablir le son',
  'Mute / Unmute': 'Couper / Rétablir le son', 'Sleep Timer': 'Minuterie', 'Set sleep timer': 'Régler la minuterie',
  'Toggle Player': 'Ouvrir ou réduire le lecteur', 'Show or hide music player': 'Ouvrir ou réduire le lecteur',
  'Now Playing:': 'En cours :', 'No songs found.': 'Aucun morceau trouvé.', 'Keyboard Shortcuts': 'Raccourcis dans le lecteur',
  'Space': 'Espace', 'Play Next': 'Lire ensuite', 'Remove from Queue': 'Retirer de la file',
  'Drag to reorder': 'Glisser pour réordonner', 'Queue': 'File d’attente', 'Queued the rest of the list': 'Suite de la liste ajoutée',
  'On': 'Activée', 'Off': 'Désactivée', 'Music stopped by timer.': 'Lecture arrêtée par la minuterie.',
  'Timer turned off': 'Minuterie désactivée', 'The Hub music player': 'Lecteur musical The Hub',
  'Unable to play this track. Try again or open it on Suno.': 'Lecture impossible. Réessayez ou ouvrez le morceau sur Suno.',
  'Press Play to start the music.': 'Appuyez sur Lire pour lancer la musique.',
  'Open on Suno': 'Ouvrir sur Suno',
};
function translate(text) {
  const raw = text.trim();
  let value = french[raw];
  if (!value) value = raw.replace(/^Speed: (.+)$/, 'Vitesse : $1').replace(/^Sleep in (\d+)m$/, 'Arrêt dans $1 min')
    .replace(/^Set for (\d+) minutes$/, 'Arrêt dans $1 minutes').replace(/^Removed "(.+)" from queue$/, '« $1 » retiré de la file')
    .replace(/^"(.+)" added to queue$/, '« $1 » ajouté à la file').replace(/^Played (\d+) times$/, 'Écouté $1 fois');
  return text.replace(raw, value);
}

export function installHubBridge(player, actions) {
  let language = 'fr';
  let started = false;
  player.dom.promoBanner?.remove();
  const textRecords = new WeakMap(), attributeRecords = new WeakMap();
  const status = document.createElement('span');
  status.className = 'hub-player-status'; status.setAttribute('role', 'status');
  player.dom.playerBody.querySelector('.player-info-and-controls').append(status);
  const suno = document.createElement('a');
  suno.className = 'hub-suno'; suno.target = '_blank'; suno.rel = 'noopener noreferrer'; suno.textContent = 'Open on Suno';
  document.querySelector('.settings-body').append(suno);

  function renderText(node) {
    if (node.parentElement?.closest('script, style, #song-title, .playlist-song-title, #toast-song-title')) return;
    let record = textRecords.get(node);
    if (!record || node.data !== record.rendered) record = { source: node.data };
    record.rendered = language === 'fr' ? translate(record.source) : record.source;
    textRecords.set(node, record);
    if (node.data !== record.rendered) node.data = record.rendered;
  }
  function localize(root = document.body) {
    if (root.nodeType === Node.TEXT_NODE) return renderText(root);
    if (!(root instanceof Element)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) renderText(walker.currentNode);
    for (const element of [root, ...root.querySelectorAll('[title], [aria-label], [placeholder]')]) {
      let records = attributeRecords.get(element);
      if (!records) { records = {}; attributeRecords.set(element, records); }
      for (const name of ['title', 'aria-label', 'placeholder']) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name);
        let record = records[name];
        if (!record || current !== record.rendered) record = { source: current };
        record.rendered = language === 'fr' ? translate(record.source) : record.source;
        records[name] = record;
        if (current !== record.rendered) element.setAttribute(name, record.rendered);
      }
    }
  }
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') renderText(mutation.target);
      else if (mutation.type === 'attributes') localize(mutation.target);
      else mutation.addedNodes.forEach(localize);
    }
    decoratePlaylist();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });

  function decoratePlaylist() {
    for (const row of player.dom.playlistContainer.children) {
      if (!row.matches('.playlist-song') || row.dataset.accessible) continue;
      row.dataset.accessible = 'true'; row.setAttribute('role', 'listitem');
      const info = row.querySelector('.playlist-song-info');
      info.setAttribute('role', 'button'); info.tabIndex = 0;
      for (const icon of row.querySelectorAll('.fav-icon, .queue-icon')) {
        icon.setAttribute('role', 'button'); icon.tabIndex = 0;
        icon.setAttribute('aria-label', attributeRecords.get(icon)?.title?.source || icon.title || 'Like this song');
      }
    }
  }
  player.dom.playlistContainer.setAttribute('role', 'list');
  player.dom.playlistContainer.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key) && event.target.matches('[role=button]')) {
      event.preventDefault(); event.stopPropagation(); event.target.click();
    }
  });

  function closePanels() {
    for (const panel of [player.dom.playlistModal, player.dom.settingsModal]) if (panel.classList.contains('show')) panel.classList.remove('show');
  }
  function open(playlist = false) {
    player.dom.player.classList.remove('player-hidden');
    if (player.dom.visualizerCanvas) player.dom.playerBody.prepend(player.dom.visualizerCanvas);
    if (playlist) { player.dom.settingsModal.classList.remove('show'); player.dom.playlistModal.classList.add('show'); }
    report();
  }
  function snapshot() {
    const collapsed = player.dom.player.classList.contains('player-hidden');
    const panel = !collapsed && (player.dom.playlistModal.classList.contains('show') || player.dom.settingsModal.classList.contains('show'));
    const track = player.playlist[player.currentTrack];
    return { type: 'hub:music', mode: collapsed ? 'collapsed' : panel ? 'playlist' : 'player', height: Math.ceil(player.dom.player.getBoundingClientRect().height) + 16,
      id: track?.id, title: track?.title, started, playing: !player.audio.paused && !player.audio.ended, error: status.textContent };
  }
  let previous = '';
  function report() {
    player.dom.likeBtn.setAttribute('aria-pressed', String(player.dom.likeBtn.classList.contains('liked')));
    player.dom.filterFavBtn.setAttribute('aria-pressed', String(player.dom.filterFavBtn.classList.contains('active')));
    const state = snapshot();
    const value = JSON.stringify(state);
    if (value !== previous) {
      previous = value;
      document.documentElement.style.setProperty('--transport-height', `${state.height}px`);
      player.dom.toggleBtn.setAttribute('aria-expanded', String(state.mode !== 'collapsed'));
      if (window.parent !== window) window.parent.postMessage(state, location.origin);
    }
  }
  function refreshTrack() { suno.href = `https://suno.com/song/${player.playlist[player.currentTrack].id}`; status.textContent = ''; report(); }
  for (const name of ['play', 'pause', 'ended', 'loadedmetadata']) player.audio.addEventListener(name, report);
  player.audio.addEventListener('loadstart', refreshTrack);
  player.audio.addEventListener('error', () => { status.textContent = 'Unable to play this track. Try again or open it on Suno.'; localize(status); report(); });
  // Every path (player controls, keyboard, playlist or catalogue) uses the same error handling.
  player.audio.play = ((nativePlay) => function () {
    started = true; status.textContent = ''; actions.initAudioContext();
    if (player.audioContext?.state === 'suspended') player.audioContext.resume();
    return nativePlay.call(this).catch(error => {
      if (error.name !== 'AbortError') {
        status.textContent = error.name === 'NotAllowedError' ? 'Press Play to start the music.' : 'Unable to play this track. Try again or open it on Suno.';
        localize(status); report();
      }
      // Feedback is visible in the player; event-driven controls need no rejected promise.
    });
  })(player.audio.play);
  player.dom.sleepTimerBtn.addEventListener('click', () => {
    status.textContent = player.sleepTimerDuration ? `Sleep in ${player.sleepTimerDuration}m` : '';
    localize(status); report();
  });
  new ResizeObserver(report).observe(player.dom.player);
  new MutationObserver(() => {
    if (player.dom.player.classList.contains('player-hidden')) closePanels();
    report();
  }).observe(player.dom.player, { subtree: true, attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closePanels(); player.dom.toggleBtn.focus(); report();
  });
  window.HubMusic = {
    open,
    closePanels() { closePanels(); report(); },
    select(id) {
      const index = player.playlist.findIndex(track => track.id === id);
      if (index < 0) return;
      closePanels(); open(); actions.initAudioContext(); actions.loadTrack(index, true); refreshTrack();
    },
    setLanguage(value) { language = value === 'en' ? 'en' : 'fr'; document.documentElement.lang = language; localize(); report(); },
    getState: snapshot,
  };
  window.HubMusic.setLanguage(new URLSearchParams(location.search).get('lang'));
  decoratePlaylist(); refreshTrack(); report();
}
