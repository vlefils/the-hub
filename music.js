// Progressive enhancement: the catalogue links also work without JavaScript.
(() => {
  const section = document.getElementById('outils-musique');
  if (!section) return;
  const tracks = [...section.querySelectorAll('[data-music-track]')];
  const player = section.querySelector('[data-music-player]');
  const embed = section.querySelector('[data-music-embed]');
  const title = section.querySelector('[data-music-current]');
  const external = section.querySelector('[data-music-external]');
  let selected = tracks[0];
  let frame;

  const loadSelected = () => {
    if (!selected || section.hidden || !section.classList.contains('is-active')) return;
    const id = selected.dataset.musicTrack;
    if (frame?.dataset.track === id) return;
    const next = document.createElement('iframe');
    next.src = `https://suno.com/embed/${id}`;
    next.title = `Suno · ${selected.querySelector('[data-music-title]').textContent}`;
    next.dataset.track = id;
    next.allow = 'autoplay; encrypted-media';
    next.referrerPolicy = 'strict-origin-when-cross-origin';
    embed.replaceChildren(next); // Replacing the previous frame also stops its audio.
    frame = next;
  };

  tracks.forEach(track => {
    // Song selection is a button when enhanced; the original links remain the no-JS fallback.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = track.className;
    button.dataset.musicTrack = track.dataset.musicTrack;
    button.setAttribute('aria-pressed', String(track === selected));
    button.append(...track.childNodes);
    if (track === selected) selected = button;
    track.replaceWith(button);
    button.addEventListener('click', () => {
      selected?.setAttribute('aria-pressed', 'false');
      selected = button;
      button.setAttribute('aria-pressed', 'true');
      title.textContent = button.querySelector('[data-music-title]').textContent;
      external.href = `https://suno.com/song/${button.dataset.musicTrack}`;
      loadSelected();
      // On stacked layouts, bring the selected song and its controls back into view.
      if (window.matchMedia('(max-width: 70rem)').matches) {
        player.scrollIntoView({ block: 'start', behavior: 'instant' });
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    });
  });

  player.hidden = !selected;
  section.classList.add('music-enhanced');
  document.addEventListener('hub:sectionchange', event => {
    if (event.detail.id === section.id) loadSelected();
    else {
      embed.replaceChildren();
      frame = null;
    }
  });
  // script.js may already have activated the page before this deferred script runs.
  loadSelected();
})();
