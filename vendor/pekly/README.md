# The Hub music player

Adapted from [Pekly / Modern HTML5 Music Player](https://github.com/Pekly/modern-html5-music-player), retrieved 28 October 2026. Original copyright and MIT license: [LICENSE](LICENSE).

`player.html`, `player.css` and `player.js` come from the upstream `music_player.html`, split into static files. The demo songs were replaced by `data/music.mjs`; media and artwork resolve relative to the site, including GitHub Pages subdirectories. The original Cyberpunk theme and player features are retained. No upstream demo media are used.

Local changes in `player.js`: disabled promotion, default Cyberpunk theme, `preload=none` with no media URL assigned until play is requested, defensive namespaced storage, muted volume restoration, guarded Media Session actions and playback state, keyboard shortcuts scoped to non-editable/non-button targets, and sequential traversal of the already shuffled playlist (avoids duplicate random picks). `hub-bridge.js` adds FR/EN, host controls/state, error feedback and keyboard access to playlist actions. `hub.css` adapts the original layout to the responsive host frame and keeps controls readable. Changes do not require a build or a server API.

The host `music.js` owns one persistent same-origin iframe outside book sections. It never reloads during hash or language changes. The iframe reports only its display mode, current song and playback state; the host checks its source and origin. Direct same-origin calls preserve browser user activation when a song is chosen from the catalogue. Preferences survive reloads; audible playback starts only with user input.

Font Awesome Free 6.5.1 is bundled locally from cdnjs; its license is in `fontawesome/LICENSE.txt`. Poppins and Space Mono are bundled from the official Google Fonts repository with their OFL licenses in `fonts/`. No remote fonts, icons or scripts are requested.

After editing the catalogue: `node tools/build-music.mjs`, then `node tools/build-translations.mjs`.
