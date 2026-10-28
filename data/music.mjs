// Public playlist metadata, captured on 28 October 2026.
// Update this catalogue, then run node tools/build-music.mjs. No audio files are hosted here.
export const musicPlaylist = {
  "title": "The Hub",
  "creator": "Islandia",
  "url": "https://suno.com/s/ca20A9dNAYhk9xzp",
  "playlistId": "6a229b02-ce78-4044-bf34-79cf298d363b",
  "cover": "assets/music/the-hub.jpeg",
  "updated": "2026-10-28",
  "tracks": [
    {
      "id": "3a1a33c0-1acb-40d0-9c31-90b8bf7487ba",
      "title": "Welcome To The Hub",
      "duration": 227.6,
      "style": "cyberpunk, rap metal, punk rap"
    },
    {
      "id": "2c976ba3-c3d1-4fd9-86a0-219a2045db27",
      "title": "First Run",
      "duration": 207.64,
      "style": "cyberpunk rap metal, rap metal, industrial punk"
    },
    {
      "id": "1e57a5e1-3c15-450b-87e6-2d47e7f4772f",
      "title": "One More Chrome",
      "duration": 270.64,
      "style": "industrial metal, hardcore rap metal, cyberpunk"
    },
    {
      "id": "d979bda2-74d0-40b6-938e-48d923c699a7",
      "title": "Manage",
      "duration": 302.44,
      "style": "cyberpunk industrial metal, electro-metal, industrial techno"
    },
    {
      "id": "05a41d53-c768-4bbc-bbfe-31d788c6c09d",
      "title": "Shine",
      "duration": 208.12,
      "style": "cyberpunk, rap metal, industrial rap"
    },
    {
      "id": "e10229e1-0eec-4dbb-825b-f038696fe61e",
      "title": "Hold The Line",
      "duration": 294,
      "style": "industrial metal, industrial rock, martial/industrial, dystopian work anthem"
    },
    {
      "id": "c173b513-95df-45ed-8b2d-c19f98bf3344",
      "title": "No Second Chance",
      "duration": 229.92,
      "style": "cyberpunk rap metal, industrial nu metal, dark industrial"
    },
    {
      "id": "4fae16b0-142b-45a5-8d42-cbde775af45d",
      "title": "Form 66-B",
      "duration": 278.16,
      "style": "industrial punk, dark rap metal, cyberpunk industrial"
    },
    {
      "id": "060f6a4d-4fb4-4d0f-8818-b3e488d4a418",
      "title": "Evolve",
      "duration": 298.08,
      "style": "industrial metal, cyberpunk industrial, rap metal"
    },
    {
      "id": "331f021a-26b2-48b3-b0cc-16a9659bbc6d",
      "title": "Beautiful From Above",
      "duration": 197.4,
      "style": "rap metal, industrial, cyberpunk"
    },
    {
      "id": "69ae83f8-22ce-4e7c-ba7e-9fc0cb9128f6",
      "title": "In the Dirt",
      "duration": 314.84,
      "style": "cyberpunk electro-industrial, sludge metal, industrial blues, synth punk cabaret"
    },
    {
      "id": "6c379948-f942-4ff0-a476-53afdb5a0a43",
      "title": "Drown in the Cloud",
      "duration": 283.36,
      "style": "cyberpunk darkwave, industrial metal, electro-noir"
    },
    {
      "id": "f3ff95b1-f0ed-42b6-9422-778047fcc273",
      "title": "Velvet",
      "duration": 261.4,
      "style": "hard techno, industrial, hardcore rap-metal"
    },
    {
      "id": "ab72eca8-4f85-4ccd-b6f1-652f69aebf00",
      "title": "Zero Day Smile",
      "duration": 261.16,
      "style": "glitch-pop, dark electro-rock, cyberpunk pop punk"
    },
    {
      "id": "00a0c7d0-3c92-4e08-87cc-67ea29948b7d",
      "title": "No Justice in Paradise",
      "duration": 315.04,
      "style": "cyberpunk, techno, hardcore rap metal"
    },
    {
      "id": "a6c79575-3938-43b2-a944-6476f3a8827c",
      "title": "Overchrome",
      "duration": 350.88,
      "style": "hardtek, hardcore techno, industrial rave, neurobass"
    },
    {
      "id": "401df4b0-3691-4d8d-9df9-3488d420714e",
      "title": "Case Goes Live",
      "duration": 256.48,
      "style": "cyberpunk electro-pop, industrial club, dark pop"
    }
  ]
};

const minutes = Math.round(musicPlaylist.tracks.reduce((sum, track) => sum + track.duration, 0) / 60);
const length = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
export const musicEnglish = {
  'Playlist ·': 'Playlist ·',
  [musicPlaylist.creator]: musicPlaylist.creator,
  ...Object.fromEntries(musicPlaylist.tracks.flatMap(track => [[track.title, track.title], [track.style, track.style]])),
  'Musique': 'Music',
  'Écouter': 'Listen',
  'Écouter la playlist The Hub et retrouver l’univers en musique.': 'Listen to The Hub playlist and experience its world through music.',
  'Pochette de la playlist The Hub': 'The Hub playlist cover',
  'Retrouvez l’univers de The Hub en musique et accompagnez vos parties.': 'Experience the world of The Hub through music and set the mood for your sessions.',
  [`${musicPlaylist.tracks.length} morceaux · ${length}`]: `${musicPlaylist.tracks.length} tracks · ${length}`,
  'Écouter la playlist sur Suno': 'Listen to the playlist on Suno',
  'Morceau sélectionné': 'Selected track',
  'Choisissez un titre, puis lancez la lecture dans le lecteur.': 'Choose a track, then press play in the player.',
  'Ouvrir ce morceau sur Suno': 'Open this track on Suno',
  'Le lecteur ne s’affiche pas ? Utilisez le lien ci-dessus.': 'Player not showing? Use the link above.',
  'La lecture s’arrête en quittant cette page. Pour écouter les morceaux à la suite ou continuer à parcourir le site, ouvrez la playlist sur Suno.': 'Playback stops when you leave this page. To listen to the tracks continuously or keep browsing the site, open the playlist on Suno.',
  'Les morceaux': 'Tracks',
  'Durée': 'Duration',
  'Ouvrez un titre pour l’écouter sur Suno.': 'Open a track to listen on Suno.',
  'Morceaux de la playlist The Hub': 'Tracks in The Hub playlist',
};
