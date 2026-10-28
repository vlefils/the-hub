// Adapted from Pekly/modern-html5-music-player (MIT); see LICENSE and README.md.
import { musicPlaylist } from '../../data/music.mjs';
import { installHubBridge, createSafeStorage } from './hub-bridge.js';

        if (window.self !== window.top) document.body.style.backgroundColor = 'transparent';

        document.addEventListener('DOMContentLoaded', () => {
            const localStorage = createSafeStorage();

            const playerConfig = {
                githubUsername: 'Pekly',
                promotionEnabled: false,
                enableVisualizer: true,
                enableSpeedControl: true,
                enableSleepTimer: true,
                enableThemeSwitcher: true,
                enableLikeSystem: true,
                enableReverb: true,
                defaultTheme: 'cyberpunk',
                themes: {
                    'spotify': { 
                        name: 'Spotify Dark', 
                        '--background-color': '#121212', 
                        '--primary-text': '#ffffff', 
                        '--secondary-text': '#b3b3b3', 
                        '--highlight-color': '#1DB954', 
                        '--border-color': '#282828', 
                        '--panel-bg': 'rgba(25, 20, 20, 0.85)', 
                        '--scrollbar-track-color': 'rgba(255,255,255,0.1)', 
                        '--scrollbar-thumb-color': '#535353',
                        '--font-stack': "'Poppins', sans-serif"
                    },
                    'light': { 
                        name: 'Arctic Light', 
                        '--background-color': '#f0f2f5', 
                        '--primary-text': '#1c1e21', 
                        '--secondary-text': '#606770', 
                        '--highlight-color': '#0866ff', 
                        '--border-color': '#ced0d4', 
                        '--panel-bg': 'rgba(255, 255, 255, 0.85)', 
                        '--scrollbar-track-color': 'rgba(0,0,0,0.1)', 
                        '--scrollbar-thumb-color': '#b0b3b8',
                        '--font-stack': "'Poppins', sans-serif"
                    },
                    'cyberpunk': { 
                        name: 'Cyberpunk 2077', 
                        '--background-color': '#0b0b0b', 
                        '--primary-text': '#fcee0a', 
                        '--secondary-text': '#00f0ff', 
                        '--highlight-color': '#fcee0a', 
                        '--border-color': '#00f0ff', 
                        '--panel-bg': 'rgba(10, 10, 15, 0.95)', 
                        '--scrollbar-track-color': 'rgba(0,240,255,0.1)', 
                        '--scrollbar-thumb-color': '#fcee0a',
                        '--font-stack': "'Space Mono', monospace"
                    },
                    'sunset': { 
                        name: 'Sunset Blvd', 
                        '--background-color': '#2b102f', 
                        '--primary-text': '#ff9a9e', 
                        '--secondary-text': '#fad0c4', 
                        '--highlight-color': '#ff6b6b', 
                        '--border-color': '#5c3a63', 
                        '--panel-bg': 'rgba(43, 16, 47, 0.9)', 
                        '--scrollbar-track-color': 'rgba(255,154,158,0.1)', 
                        '--scrollbar-thumb-color': '#ff6b6b',
                        '--font-stack': "'Poppins', sans-serif"
                    },
                    'hacker': { 
                        name: 'Hacker Terminal', 
                        '--background-color': '#000000', 
                        '--primary-text': '#00ff00', 
                        '--secondary-text': '#008f11', 
                        '--highlight-color': '#00ff00', 
                        '--border-color': '#003300', 
                        '--panel-bg': 'rgba(0, 0, 0, 0.95)', 
                        '--scrollbar-track-color': '#001100', 
                        '--scrollbar-thumb-color': '#008f11',
                        '--font-stack': "'Space Mono', monospace"
                    },
                    'vaporwave': {
                        name: 'Vaporwave',
                        '--background-color': '#1a0533',
                        '--primary-text': '#ff71ce',
                        '--secondary-text': '#b967ff',
                        '--highlight-color': '#01cdfe',
                        '--border-color': '#05ffa1',
                        '--panel-bg': 'rgba(26, 5, 51, 0.9)',
                        '--scrollbar-track-color': 'rgba(1, 205, 254, 0.1)',
                        '--scrollbar-thumb-color': '#b967ff',
                        '--font-stack': "'Space Mono', monospace"
                    }
                }
            };
            
            const playlistData = musicPlaylist.tracks.map(track => ({ ...track, artist: musicPlaylist.creator, url: new URL('../../' + track.audio, import.meta.url).href, albumArtUrl: new URL('../../' + musicPlaylist.cover, import.meta.url).href }));

            function setupMusicPlayer() {
                let toastTimeout, isPlaylistToggling = false;
                let cachedHighlight = '#1DB954', cachedPrimary = '#ffffff';
                let sleepCountdownInterval;
                const player = {
                    audio: document.getElementById('audio-player'),
                    playlist: [...playlistData],
                    originalPlaylist: [...playlistData],
                    favorites: JSON.parse(localStorage.getItem('oss_music_player_favorites') || '[]'),
                    queuedTracks: [],
                    currentTrack: 0, isPlaying: false, isShuffle: false,
                    repeatMode: 'none', isReverbEnabled: false,
                    sleepTimer: null, sleepTimerDuration: 0,
                    audioContext: null, sourceNode: null, analyserNode: null, dataArray: null, convolverNode: null, reverbGainNode: null,
                    dom: {
                        player: document.getElementById('music-player'), toggleBtn: document.getElementById('player-toggle-btn'),
                        playPauseBtn: document.getElementById('play-pause-btn'), nextBtn: document.getElementById('next-btn'),
                        prevBtn: document.getElementById('prev-btn'), shuffleBtn: document.getElementById('shuffle-btn'),
                        repeatBtn: document.getElementById('repeat-btn'), likeBtn: document.getElementById('like-btn'),
                        speedBtn: document.getElementById('speed-btn'),
                        reverbBtn: document.getElementById('reverb-btn'),
                        sleepTimerBtn: document.getElementById('sleep-timer-btn'),
                        timelineSlider: document.getElementById('timeline-slider'),
                        songTitleEl: document.getElementById('song-title'), songArtistEl: document.getElementById('song-artist'),
                        albumArt: document.getElementById('album-art'), albumBg: document.getElementById('player-album-bg'),
                        toast: document.getElementById('song-notification-toast'), toastArt: document.getElementById('toast-album-art'),
                        toastTitle: document.getElementById('toast-song-title'), volumeBtn: document.getElementById('volume-btn'),
                        volumeSlider: document.getElementById('volume-slider-input'), playlistBtn: document.getElementById('playlist-btn'),
                        playlistToggleBtnMain: document.getElementById('playlist-toggle-btn-main'),
                        playlistModal: document.getElementById('playlist-modal'), playlistContainer: document.getElementById('playlist-container'),
                        playlistSearch: document.getElementById('playlist-search'), filterFavBtn: document.getElementById('filter-fav-btn'),
                        currentTimeEl: document.getElementById('current-time'), totalDurationEl: document.getElementById('total-duration'),
                        themeSwitcher: document.getElementById('theme-switcher-list'), promoBanner: document.getElementById('github-promotion'),
                        promoLink: document.getElementById('github-link'), promoCloseBtn: document.getElementById('close-promo-btn'),
                        playerBody: document.querySelector('.player-body'),
                        settingsBtn: document.getElementById('settings-btn'),
                        settingsModal: document.getElementById('settings-modal'),
                        settingsCloseBtn: document.querySelector('.settings-close-btn')
                    }
                };
                
                let visualizerCanvas = null;
                if (playerConfig.enableVisualizer) {
                    visualizerCanvas = document.createElement('canvas');
                    visualizerCanvas.id = 'visualizer';
                    player.dom.visualizerCanvas = visualizerCanvas;
                }

                if (!playerConfig.enableSpeedControl && player.dom.speedBtn) player.dom.speedBtn.style.display = 'none';
                if (!playerConfig.enableSleepTimer && player.dom.sleepTimerBtn) player.dom.sleepTimerBtn.style.display = 'none';
                if (!playerConfig.enableThemeSwitcher && player.dom.themeSwitcher) player.dom.themeSwitcher.style.display = 'none';
                if (!playerConfig.enableLikeSystem) {
                    if (player.dom.likeBtn) player.dom.likeBtn.style.display = 'none';
                    if (player.dom.filterFavBtn) player.dom.filterFavBtn.style.display = 'none';
                }

                let lastBarHeights = [];
                let animationFrameId;
                
                function applyTheme(themeName) {
                    const theme = playerConfig.themes[themeName]; if (!theme) return;
                    for (const [key, value] of Object.entries(theme)) if (key !== 'name') document.documentElement.style.setProperty(key, value);
                    
                    const s = getComputedStyle(document.documentElement);
                    cachedHighlight = s.getPropertyValue('--highlight-color').trim();
                    cachedPrimary = s.getPropertyValue('--primary-text').trim();

                    localStorage.setItem('oss_music_player_theme', themeName);
                    if(player.dom.themeSwitcher){
                        const currentActive = player.dom.themeSwitcher.querySelector('.active');
                        if (currentActive) currentActive.classList.remove('active');
                        const newActive = player.dom.themeSwitcher.querySelector(`[data-theme="${themeName}"] .theme-button`);
                        if (newActive) newActive.classList.add('active');
                    }
                    if (player.isPlaying && playerConfig.enableVisualizer) {
                        cancelAnimationFrame(animationFrameId);
                        drawVisualizer();
                    }
                }
                
                function setupThemeSwitcher() {
                    if (!player.dom.themeSwitcher || !playerConfig.enableThemeSwitcher) return;
                    player.dom.themeSwitcher.innerHTML = '';
                    for(const [key, theme] of Object.entries(playerConfig.themes)) {
                        const item = document.createElement('div');
                        item.className = 'theme-list-item';
                        item.dataset.theme = key;
                        
                        const button = document.createElement('button');
                        button.className = 'theme-button'; 
                        button.title = theme.name;
                        button.style.backgroundColor = theme['--highlight-color'];
                        
                        const label = document.createElement('span');
                        label.textContent = theme.name;
                        
                        item.appendChild(button);
                        item.appendChild(label);
                        item.addEventListener('click', () => applyTheme(key));
                        player.dom.themeSwitcher.appendChild(item);
                    }
                }
                
                function setupPromotion() {
                    if(player.dom.promoLink) player.dom.promoLink.href = `https://github.com/${playerConfig.githubUsername}/modern-html5-music-player`;
                    if (player.dom.promoBanner) {
                         if (!playerConfig.promotionEnabled || localStorage.getItem('oss_music_player_promo_seen') === 'true') player.dom.promoBanner.classList.add('hidden');
                    }
                    if (player.dom.promoCloseBtn) {
                        player.dom.promoCloseBtn.addEventListener('click', () => {
                            if(player.dom.promoBanner) player.dom.promoBanner.classList.add('hidden');
                            localStorage.setItem('oss_music_player_promo_seen', 'true');
                        });
                    }
                }

                function createReverbBuffer(audioCtx) {
                    const sampleRate = audioCtx.sampleRate;
                    const length = sampleRate * 2.5; 
                    const impulse = audioCtx.createBuffer(2, length, sampleRate);
                    const decay = 2.0;
                    for (let i = 0; i < 2; i++) {
                        const channel = impulse.getChannelData(i);
                        for (let j = 0; j < length; j++) {
                            channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
                        }
                    }
                    return impulse;
                }

                function initAudioContext() {
                    if (!playerConfig.enableVisualizer || player.audioContext) return;
                    try {
                        player.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        player.sourceNode = player.audioContext.createMediaElementSource(player.audio);
                        player.analyserNode = player.audioContext.createAnalyser();
                        player.analyserNode.fftSize = 256;
                        
                        if (playerConfig.enableReverb) {
                            player.convolverNode = player.audioContext.createConvolver();
                            player.convolverNode.buffer = createReverbBuffer(player.audioContext);
                            player.reverbGainNode = player.audioContext.createGain();
                            player.reverbGainNode.gain.value = player.isReverbEnabled ? 0.6 : 0;
                            
                            player.analyserNode.connect(player.convolverNode);
                            player.convolverNode.connect(player.reverbGainNode);
                            player.reverbGainNode.connect(player.audioContext.destination);
                        }

                        player.sourceNode.connect(player.analyserNode);
                        player.analyserNode.connect(player.audioContext.destination);
                        player.dataArray = new Uint8Array(player.analyserNode.frequencyBinCount);
                    } catch (e) { console.error("Web Audio API is not supported.", e); }
                }
                document.addEventListener('click', initAudioContext, { once: true });
                
                function drawVisualizer() {
                    if (!playerConfig.enableVisualizer) return;
                    animationFrameId = requestAnimationFrame(drawVisualizer);
                
                    if (!player.analyserNode) return;
                
                    const canvas = player.dom.visualizerCanvas;
                    if(!canvas) return;

                    const ctx = canvas.getContext('2d');
                    if (canvas.parentElement && (canvas.width !== canvas.parentElement.offsetWidth || canvas.height !== canvas.parentElement.offsetHeight)) {
                        canvas.width = canvas.parentElement.offsetWidth;
                        canvas.height = canvas.parentElement.offsetHeight;
                    }
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                    const bufferLength = player.analyserNode.frequencyBinCount;
                    if (lastBarHeights.length !== bufferLength) {
                        lastBarHeights = new Array(bufferLength).fill(0);
                    }
                    
                    const highlightColor = cachedHighlight;
                    const primaryColor = cachedPrimary;

                    let targetFrequencies = new Uint8Array(bufferLength);
                    if (player.isPlaying) {
                        player.analyserNode.getByteFrequencyData(targetFrequencies);
                    }
                
                    const isSmall = player.dom.toggleBtn && canvas.parentElement === player.dom.toggleBtn;
                    
                    const numBars = isSmall ? 16 : 48; 
                    const gap = isSmall ? 2 : 4;
                    const barWidth = Math.max(1, (canvas.width / (numBars * 2)) - gap);
                    const centerY = canvas.height - (barWidth / 2); 
                    const centerX = canvas.width / 2;

                    ctx.shadowBlur = isSmall ? 4 : 12;
                    ctx.shadowColor = highlightColor;
                    ctx.lineCap = 'round';
                    ctx.lineWidth = barWidth;

                    for (let i = 0; i < numBars; i++) {
                        const freqIndex = Math.floor((i / numBars) * (bufferLength * 0.6)); // Focus on lower-mid frequencies for better reaction
                        let targetHeight = (targetFrequencies[freqIndex] / 255) * (canvas.height * 0.7);
                        let currentHeight = lastBarHeights[i] || 0;
                
                        if (currentHeight < targetHeight) {
                            currentHeight += (targetHeight - currentHeight) * 0.25;
                        } else {
                            currentHeight = currentHeight * 0.85; // Faster decay for snappier feel
                        }
                
                        if (currentHeight < 2) currentHeight = 2; 
                        lastBarHeights[i] = currentHeight;
                
                        const gradient = ctx.createLinearGradient(0, centerY, 0, centerY - currentHeight);
                        gradient.addColorStop(0, primaryColor);
                        gradient.addColorStop(1, highlightColor);
                        ctx.strokeStyle = gradient;

                        const offsetX = (i * (barWidth + gap)) + (barWidth / 2) + (gap / 2);

                        // Right side
                        ctx.beginPath();
                        ctx.moveTo(centerX + offsetX, centerY);
                        ctx.lineTo(centerX + offsetX, centerY - currentHeight);
                        ctx.stroke();

                        // Left side
                        ctx.beginPath();
                        ctx.moveTo(centerX - offsetX, centerY);
                        ctx.lineTo(centerX - offsetX, centerY - currentHeight);
                        ctx.stroke();
                    }

                    ctx.shadowBlur = 0;
                }

                function showToast(title, message) {
                    if (!player.dom.toast) return;
                    clearTimeout(toastTimeout);
                    if(player.dom.toastArt) {
                        player.dom.toastArt.src = player.playlist[player.currentTrack]?.albumArtUrl || '';
                        player.dom.toastArt.style.display = message ? 'none' : 'block';
                    }
                    const toastDiv = player.dom.toast.querySelector('div');
                    if(toastDiv && toastDiv.firstElementChild) toastDiv.firstElementChild.textContent = title;
                    if(player.dom.toastTitle) player.dom.toastTitle.textContent = message || '';
                    
                    player.dom.toast.classList.add('show');
                    toastTimeout = setTimeout(() => {
                        player.dom.toast.classList.remove('show');
                        setTimeout(() => { if(player.dom.toastArt) player.dom.toastArt.style.display = 'block'; }, 300);
                    }, 3000);
                }

                function showSongToast(track) {
                    if(!player.dom.toast) return;
                    clearTimeout(toastTimeout);
                    if(player.dom.toastArt) {
                        player.dom.toastArt.style.display = 'block';
                        player.dom.toastArt.src = track.albumArtUrl;
                    }
                    const toastDiv = player.dom.toast.querySelector('div');
                    if(toastDiv && toastDiv.firstElementChild) toastDiv.firstElementChild.textContent = 'Now Playing:';
                    if(player.dom.toastTitle) player.dom.toastTitle.textContent = track.title;
                    player.dom.toast.classList.add('show');
                    toastTimeout = setTimeout(() => player.dom.toast.classList.remove('show'), 4000);
                }

                function updateMediaSession(track) {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.metadata = new MediaMetadata({
                            title: track.title,
                            artist: track.artist,
                            album: 'Pekly\'s Music Player',
                            artwork: [{ src: track.albumArtUrl, sizes: '512x512', type: 'image/jpeg' }]
                        });
                    }
                }

                function isFavorite(url) {
                    return player.favorites.includes(url);
                }

                function toggleFavorite(url) {
                    if (!playerConfig.enableLikeSystem) return;
                    if (isFavorite(url)) {
                        player.favorites = player.favorites.filter(u => u !== url);
                    } else {
                        player.favorites.push(url);
                    }
                    localStorage.setItem('oss_music_player_favorites', JSON.stringify(player.favorites));
                    updateLikeBtn();
                    filterPlaylist();
                }

                function updateLikeBtn() {
                    if (!playerConfig.enableLikeSystem || !player.dom.likeBtn) return;
                    const currentSong = player.playlist[player.currentTrack];
                    const isFav = isFavorite(currentSong.url);
                    if (isFav) {
                        player.dom.likeBtn.classList.add('liked');
                        player.dom.likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
                    } else {
                        player.dom.likeBtn.classList.remove('liked');
                        player.dom.likeBtn.innerHTML = '<i class="far fa-heart"></i>';
                    }
                }

                function loadTrack(trackIndex, shouldPlay = false) {
                    const trackToLoad = player.playlist[trackIndex];
                    if (player.queuedTracks) {
                        const qIndex = player.queuedTracks.indexOf(trackToLoad.url);
                        if (qIndex !== -1) {
                            player.queuedTracks.splice(qIndex, 1);
                            setTimeout(populatePlaylistModal, 0);
                        }
                    }
                    player.currentTrack = trackIndex;
                    localStorage.setItem('oss_music_player_currentTrack', trackIndex);
                    const track = trackToLoad;
                    
                    if(player.dom.songTitleEl) {
                        player.dom.songTitleEl.classList.remove('overflowing');
                        player.dom.songTitleEl.style.removeProperty('--overflow-width');
                        player.dom.songTitleEl.textContent = track.title;
                        requestAnimationFrame(() => {
                            if (player.dom.songTitleEl.scrollWidth > player.dom.songTitleEl.parentElement.offsetWidth) {
                                player.dom.songTitleEl.classList.add('overflowing');
                                const diff = player.dom.songTitleEl.scrollWidth - player.dom.songTitleEl.parentElement.offsetWidth + 10;
                                player.dom.songTitleEl.style.setProperty('--overflow-width', `-${diff}px`);
                            }
                        });
                    }
                    
                    if(player.dom.songArtistEl) player.dom.songArtistEl.textContent = track.artist;
                    if(player.dom.albumArt) player.dom.albumArt.src = track.albumArtUrl;
                    if(player.dom.albumBg) player.dom.albumBg.style.backgroundImage = `url(${track.albumArtUrl})`;
                    if(player.dom.timelineSlider) player.dom.timelineSlider.value = 0;
                    // Do not even assign a media URL before a playback request.
                    if (shouldPlay || player.audio.hasAttribute('src')) {
                        if (player.audio.src !== track.url) player.audio.src = track.url;
                        player.audio.load();
                    }
                    if (player.dom.currentTimeEl) player.dom.currentTimeEl.textContent = '0:00';
                    if (player.dom.totalDurationEl) player.dom.totalDurationEl.textContent = formatTime(track.duration);
                    
                    if (track.url.toLowerCase().endsWith('.mp4')) {
                        player.dom.playerBody.classList.add('is-video');
                    } else {
                        player.dom.playerBody.classList.remove('is-video');
                    }

                    if (player.dom.player.classList.contains('player-hidden') && shouldPlay) showSongToast(track);
                    
                    if(playerConfig.enableSpeedControl && player.dom.speedBtn) {
                        const speedVal = parseFloat(player.dom.speedBtn.textContent);
                        if(speedVal) {
                            player.audio.playbackRate = speedVal;
                            player.audio.preservesPitch = false;
                            if(player.audio.mozPreservesPitch !== undefined) player.audio.mozPreservesPitch = false;
                            if(player.audio.webkitPreservesPitch !== undefined) player.audio.webkitPreservesPitch = false;
                        }
                    }

                    updateLikeBtn(); 
                    
                    if(shouldPlay) {
                        if (player.audioContext && player.audioContext.state === 'suspended') player.audioContext.resume();
                        player.audio.play().catch(e => console.log("Playback was prevented: ", e.message));
                    }
                    updateMediaSession(track);
                    
                    if (player.dom.playlistContainer) {
                        const items = player.dom.playlistContainer.querySelectorAll('.playlist-song');
                        items.forEach((el, i) => {
                            const isNow = i === player.currentTrack;
                            el.classList.toggle('playing', isNow);
                            const img = el.querySelector('img');
                            if (img) img.classList.toggle('spinning', isNow && player.isPlaying);
                        });
                    }
                }
                
                function formatTime(seconds) {
                    if (isNaN(seconds) || seconds < 0) return "0:00";
                    const minutes = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
                }

                const playNext = () => {
                    if (player.queuedTracks && player.queuedTracks.length > 0) {
                        const nextUrl = player.queuedTracks.shift();
                        const nextIndex = player.playlist.findIndex(t => t.url === nextUrl);
                        if (nextIndex !== -1) {
                            loadTrack(nextIndex, true);
                            populatePlaylistModal();
                            return;
                        }
                    }
                    loadTrack((player.currentTrack + 1) % player.playlist.length, true);
                };
                const playPrevious = () => loadTrack((player.currentTrack - 1 + player.playlist.length) % player.playlist.length, true);
                const togglePlay = () => {
                    if (!player.audio.hasAttribute('src')) { loadTrack(player.currentTrack, true); return; }
                    if (player.audioContext && player.audioContext.state === 'suspended') player.audioContext.resume();
                    if (player.audio.paused) player.audio.play().catch(e => console.error("Playback failed:", e));
                    else player.audio.pause();
                };

                if (player.dom.toggleBtn) {
                    player.dom.toggleBtn.addEventListener('click', () => {
                        const isHidden = player.dom.player.classList.toggle('player-hidden');
                        if (playerConfig.enableVisualizer && player.dom.visualizerCanvas) {
                            if (isHidden) {
                                player.dom.toggleBtn.appendChild(player.dom.visualizerCanvas);
                            } else {
                                player.dom.playerBody.insertBefore(player.dom.visualizerCanvas, player.dom.playerBody.firstChild);
                            }
                        }
                    });
                }
                
                if(player.dom.playPauseBtn) player.dom.playPauseBtn.addEventListener('click', togglePlay);
                if(playerConfig.enableLikeSystem && player.dom.likeBtn) player.dom.likeBtn.addEventListener('click', () => toggleFavorite(player.playlist[player.currentTrack].url));

                if(playerConfig.enableSpeedControl && player.dom.speedBtn) {
                    let currentSpeedIndex = 0;
                    const speeds = [1, 1.25, 1.5, 0.85];
                    player.dom.speedBtn.addEventListener('click', () => {
                        currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
                        const s = speeds[currentSpeedIndex];
                        player.audio.playbackRate = s;
                        player.audio.preservesPitch = false;
                        if(player.audio.mozPreservesPitch !== undefined) player.audio.mozPreservesPitch = false;
                        if(player.audio.webkitPreservesPitch !== undefined) player.audio.webkitPreservesPitch = false;
                        player.dom.speedBtn.innerHTML = `<i class="fas fa-tachometer-alt"></i> <span>${s}x</span>`;
                        player.dom.speedBtn.title = 'Speed: ' + s + 'x';
                        if (s === 1) {
                            player.dom.speedBtn.classList.remove('toggled-glow');
                        } else {
                            player.dom.speedBtn.classList.add('toggled-glow');
                        }
                    });
                }

                if (playerConfig.enableSleepTimer && player.dom.sleepTimerBtn) {
                    player.dom.sleepTimerBtn.addEventListener('click', () => {
                        if (player.sleepTimer) { clearTimeout(player.sleepTimer); player.sleepTimer = null; }
                        if (sleepCountdownInterval) { clearInterval(sleepCountdownInterval); sleepCountdownInterval = null; }
                        
                        if (player.sleepTimerDuration === 0) player.sleepTimerDuration = 15;
                        else if (player.sleepTimerDuration === 15) player.sleepTimerDuration = 30;
                        else if (player.sleepTimerDuration === 30) player.sleepTimerDuration = 60;
                        else player.sleepTimerDuration = 0;

                        if (player.sleepTimerDuration > 0) {
                            player.dom.sleepTimerBtn.classList.add('active');
                            let remainingSeconds = player.sleepTimerDuration * 60;
                            player.dom.sleepTimerBtn.title = `Sleep in ${Math.ceil(remainingSeconds / 60)}m`;
                            
                            player.sleepTimer = setTimeout(() => {
                                if (!player.audio.paused) togglePlay();
                                player.sleepTimerDuration = 0;
                                player.dom.sleepTimerBtn.classList.remove('active');
                                player.dom.sleepTimerBtn.title = 'Sleep Timer';
                                clearInterval(sleepCountdownInterval);
                                showToast("Sleep Timer", "Music stopped by timer.");
                            }, remainingSeconds * 1000);
                            
                            sleepCountdownInterval = setInterval(() => {
                                remainingSeconds--;
                                if(remainingSeconds > 0) {
                                    player.dom.sleepTimerBtn.title = `Sleep in ${Math.ceil(remainingSeconds / 60)}m`;
                                }
                            }, 1000);
                            
                            showToast("Sleep Timer", `Set for ${player.sleepTimerDuration} minutes`);
                        } else {
                            player.dom.sleepTimerBtn.classList.remove('active');
                            player.dom.sleepTimerBtn.title = 'Sleep Timer';
                            showToast("Sleep Timer", "Timer turned off");
                        }
                    });
                }

                player.audio.addEventListener('play', () => {
                    player.isPlaying = true;
                    if (!animationFrameId && playerConfig.enableVisualizer) drawVisualizer();
                    if(player.dom.playPauseBtn) {
                        player.dom.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                        player.dom.playPauseBtn.setAttribute('aria-pressed', 'true');
                    }
                    if(player.dom.toggleBtn) player.dom.toggleBtn.classList.add('is-playing');
                    if(player.dom.playlistContainer && player.dom.playlistContainer.children[player.currentTrack]) {
                        const playingRow = player.dom.playlistContainer.children[player.currentTrack];
                        if (playingRow) {
                            const playingImg = playingRow.querySelector('img');
                            if (playingImg) playingImg.classList.add('spinning');
                        }
                    }
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                });
                player.audio.addEventListener('pause', () => {
                    player.isPlaying = false;
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                    if(player.dom.playPauseBtn) {
                        player.dom.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                        player.dom.playPauseBtn.setAttribute('aria-pressed', 'false');
                    }
                    if(player.dom.toggleBtn) player.dom.toggleBtn.classList.remove('is-playing');
                    if(player.dom.playlistContainer && player.dom.playlistContainer.children[player.currentTrack]) {
                        const playingRow = player.dom.playlistContainer.children[player.currentTrack];
                        if (playingRow) {
                            const playingImg = playingRow.querySelector('img');
                            if (playingImg) playingImg.classList.remove('spinning');
                        }
                    }
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
                });
                
                player.audio.addEventListener('waiting', () => { if(player.dom.player) player.dom.player.classList.add('buffering'); });
                player.audio.addEventListener('playing', () => { if(player.dom.player) player.dom.player.classList.remove('buffering'); });
                player.audio.addEventListener('canplay', () => { if(player.dom.player) player.dom.player.classList.remove('buffering'); });

                if(player.dom.nextBtn) player.dom.nextBtn.addEventListener('click', playNext);
                if(player.dom.prevBtn) player.dom.prevBtn.addEventListener('click', playPrevious);

                player.audio.addEventListener('ended', () => {
                    const counts = JSON.parse(localStorage.getItem('oss_play_counts') || '{}');
                    const url = player.playlist[player.currentTrack].url;
                    counts[url] = (counts[url] || 0) + 1;
                    localStorage.setItem('oss_play_counts', JSON.stringify(counts));

                    if (player.repeatMode === 'one') { player.audio.currentTime = 0; player.audio.play(); } 
                    else if (player.currentTrack === player.playlist.length - 1 && player.repeatMode !== 'all') { } 
                    else { playNext(); }
                });
                
                player.audio.addEventListener('loadedmetadata', () => { if(player.dom.totalDurationEl) player.dom.totalDurationEl.textContent = formatTime(player.audio.duration); });
                  let isDraggingSlider = false;
                  player.audio.addEventListener('timeupdate', () => {
                      if (player.audio.duration) {
                          if(player.dom.timelineSlider && !isDraggingSlider) player.dom.timelineSlider.value = (player.audio.currentTime / player.audio.duration) * 100;
                          if(player.dom.currentTimeEl) player.dom.currentTimeEl.textContent = formatTime(player.audio.currentTime);
                      }
                  });
                  if(player.dom.timelineSlider) {
                      player.dom.timelineSlider.style.webkitAppearance = 'none';
                      player.dom.timelineSlider.addEventListener('input', (e) => { if (player.audio.duration) player.audio.currentTime = (e.target.value / 100) * player.audio.duration; });
                      player.dom.timelineSlider.addEventListener('mousedown', () => { isDraggingSlider = true; player.dom.timelineSlider.classList.add('grabbing'); });
                      window.addEventListener('mouseup', () => { isDraggingSlider = false; if(player.dom.timelineSlider) player.dom.timelineSlider.classList.remove('grabbing'); });
                      player.dom.timelineSlider.addEventListener('touchstart', () => { isDraggingSlider = true; }, {passive: true});
                      window.addEventListener('touchend', () => { isDraggingSlider = false; });
                  }

                if (player.dom.reverbBtn && playerConfig.enableReverb) {
                    const savedReverb = localStorage.getItem('oss_music_player_reverb') === 'true';
                    player.isReverbEnabled = savedReverb;
                    player.dom.reverbBtn.classList.toggle('toggled-glow', savedReverb);
                    
                    player.dom.reverbBtn.addEventListener('click', () => {
                        player.isReverbEnabled = !player.isReverbEnabled;
                        localStorage.setItem('oss_music_player_reverb', player.isReverbEnabled);
                        player.dom.reverbBtn.classList.toggle('toggled-glow', player.isReverbEnabled);
                        
                        if (player.audioContext && player.reverbGainNode) {
                            player.reverbGainNode.gain.setTargetAtTime(player.isReverbEnabled ? 0.6 : 0, player.audioContext.currentTime, 0.1);
                        } else if (player.isReverbEnabled && !player.audioContext) {
                            initAudioContext();
                            if (player.audioContext && player.reverbGainNode) {
                                player.reverbGainNode.gain.setValueAtTime(0.6, player.audioContext.currentTime);
                            }
                        }
                        
                        showToast('Reverb', player.isReverbEnabled ? 'On' : 'Off');
                    });
                } else if (player.dom.reverbBtn) {
                    player.dom.reverbBtn.style.display = 'none';
                }

                if(player.dom.shuffleBtn) {
                    player.dom.shuffleBtn.addEventListener('click', () => {
                        player.isShuffle = !player.isShuffle;
                        player.dom.shuffleBtn.setAttribute('aria-pressed', player.isShuffle);
                        localStorage.setItem('oss_music_player_isShuffle', player.isShuffle);
                        player.dom.shuffleBtn.classList.toggle('toggled-glow', player.isShuffle);
                        const currentSongUrl = player.playlist[player.currentTrack]?.url;
                        if (player.isShuffle) {
                            let shuffled = [...player.originalPlaylist];
                            for (let i = shuffled.length - 1; i > 0; i--) { 
                                const j = Math.floor(Math.random() * (i + 1));
                                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; 
                            }
                            player.playlist = shuffled;
                        } else { player.playlist = [...player.originalPlaylist]; }
                        player.currentTrack = player.playlist.findIndex(track => track.url === currentSongUrl);
                        if (player.currentTrack === -1) player.currentTrack = 0;
                        populatePlaylistModal();
                    });
                }

                if(player.dom.repeatBtn) {
                    player.dom.repeatBtn.addEventListener('click', () => {
                        if (player.repeatMode === 'none') {
                            player.repeatMode = 'one';
                            player.dom.repeatBtn.classList.add('toggled-glow');
                            player.dom.repeatBtn.classList.add('repeat-one-active');
                            player.dom.repeatBtn.setAttribute('aria-pressed', 'true');
                        } else if (player.repeatMode === 'one') {
                            player.repeatMode = 'all';
                            player.dom.repeatBtn.classList.remove('repeat-one-active');
                        } else {
                            player.repeatMode = 'none';
                            player.dom.repeatBtn.classList.remove('toggled-glow', 'repeat-one-active');
                            player.dom.repeatBtn.setAttribute('aria-pressed', 'false');
                        }
                        localStorage.setItem('oss_music_player_repeatMode', player.repeatMode);
                    });
                }

                if(player.dom.volumeSlider) player.dom.volumeSlider.addEventListener('input', (e) => { player.audio.volume = e.target.value; localStorage.setItem('oss_music_player_volume', e.target.value); });
                player.audio.addEventListener('volumechange', () => {
                    if(!player.dom.volumeBtn) return;
                    const icon = player.dom.volumeBtn.querySelector('i');
                    if(!icon) return;
                    if (player.audio.volume > 0.5) icon.className = 'fas fa-volume-up';
                    else if (player.audio.volume > 0) icon.className = 'fas fa-volume-down';
                    else icon.className = 'fas fa-volume-mute';
                });

                function togglePlaylistModal() {
                    if (isPlaylistToggling) return;
                    if (!player.dom.playlistModal) return;
                    isPlaylistToggling = true;
                    const isOpening = !player.dom.playlistModal.classList.contains('show');
                    if (isOpening && localStorage.getItem('oss_music_player_promo_seen') !== 'true') localStorage.setItem('oss_music_player_promo_seen', 'true');
                    player.dom.playlistModal.classList.toggle('show');
                    if (player.dom.settingsModal && player.dom.settingsModal.classList.contains('show')) player.dom.settingsModal.classList.remove('show');
                    setTimeout(() => isPlaylistToggling = false, 400);
                }

                function toggleSettingsModal() {
                    if (!player.dom.settingsModal) return;
                    const isOpening = !player.dom.settingsModal.classList.contains('show');
                    player.dom.settingsModal.classList.toggle('show');
                    if (isOpening) {
                        if (player.dom.playlistModal) player.dom.playlistModal.classList.remove('show');
                    } else {
                        if (player.dom.playlistModal) player.dom.playlistModal.classList.add('show');
                    }
                }
                
                if(player.dom.settingsBtn) player.dom.settingsBtn.addEventListener('click', toggleSettingsModal);
                if(player.dom.settingsCloseBtn) player.dom.settingsCloseBtn.addEventListener('click', toggleSettingsModal);



                function populatePlaylistModal(songsToDisplay = player.playlist) {
                    if(!player.dom.playlistContainer) return;
                    const existingGhost = document.querySelector('.drag-ghost');
                    if (existingGhost) existingGhost.remove();
                    player.dom.playlistContainer.innerHTML = '';
                    
                    if (songsToDisplay.length === 0) {
                        player.dom.playlistContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--secondary-text); padding:20px; font-style:italic;">No songs found.</div>';
                        return;
                    }

                    const counts = JSON.parse(localStorage.getItem('oss_play_counts') || '{}');
                    const isFiltered = (player.dom.playlistSearch && player.dom.playlistSearch.value.trim() !== '') || 
                                       (player.dom.filterFavBtn && player.dom.filterFavBtn.classList.contains('active'));

                    songsToDisplay.forEach((song) => {
                        const originalIndex = player.playlist.findIndex(pSong => pSong.url === song.url);
                        const songEl = document.createElement('div');
                        songEl.className = 'playlist-song';
                        if(originalIndex === player.currentTrack) songEl.classList.add('playing');
                        
                        const isFav = isFavorite(song.url);
                        const favClass = isFav ? 'active' : '';
                        const favIcon = isFav ? 'fas fa-heart' : 'far fa-heart';
                        const likeIconHtml = playerConfig.enableLikeSystem ? `<i class="${favIcon} fav-icon ${favClass}"></i>` : '';
                        
                        const isVideo = song.url.toLowerCase().endsWith('.mp4');
                        const videoTagHtml = isVideo ? `<span class="video-tag" title="Video File"><i class="fas fa-video"></i></span>` : '';
                        
                        const playCountHtml = counts[song.url] >= 3 ? `<span title="Played ${counts[song.url]} times" style="margin-left:6px; font-size:0.8rem;">🔥</span>` : '';
                        const qIndex = player.queuedTracks ? player.queuedTracks.indexOf(song.url) : -1;
                        let queueIconHtml = '';
                        if (qIndex !== -1) {
                            queueIconHtml = `<div class="queue-icon queued-badge" title="Remove from Queue" style="background:var(--highlight-color); color:var(--background-color); border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold; cursor:pointer; opacity:1;">${qIndex + 1}</div>`;
                        } else if (originalIndex !== player.currentTrack) {
                            queueIconHtml = `<i class="fas fa-level-down-alt queue-icon" title="Play Next"></i>`;
                        }

                        const dragHandleHtml = isFiltered ? '' : '<i class="fas fa-grip-vertical drag-handle" title="Drag to reorder"></i>';
                        songEl.innerHTML = `
                            ${dragHandleHtml}
                            <div class="playlist-album-wrapper">
                                <img src="${song.albumArtUrl}" alt="${song.title} album art">
                                ${videoTagHtml}
                            </div>
                            <div class="playlist-song-info">
                                <div class="playlist-song-title-row">
                                    <div class="playlist-song-title-wrapper"><span class="playlist-song-title">${song.title}</span></div>
                                    <div class="playlist-song-badges">${playCountHtml}</div>
                                </div>
                                <div class="playlist-song-artist">${song.artist}</div>
                            </div>
                            ${queueIconHtml}
                            ${likeIconHtml}
                        `;
                        
                        songEl.addEventListener('click', (e) => {
                            if (e.target.classList.contains('drag-handle')) return;
                            if (e.target.classList.contains('fav-icon')) {
                                e.stopPropagation();
                                toggleFavorite(song.url);
                            } else if (e.target.closest('.queue-icon')) {
                                e.stopPropagation();
                                const qIndex = player.queuedTracks.indexOf(song.url);
                                if (qIndex !== -1) {
                                    player.queuedTracks.splice(qIndex, 1);
                                    showToast('Queue', `Removed "${song.title}" from queue`);
                                } else {
                                    player.queuedTracks.push(song.url);
                                    showToast('Queue', `"${song.title}" added to queue`);
                                }
                                populatePlaylistModal();
                            } else {
                                if (songsToDisplay.length < player.playlist.length) {
                                    const clickedLocalIndex = songsToDisplay.findIndex(s => s.url === song.url);
                                    if (clickedLocalIndex !== -1) {
                                        player.queuedTracks = [];
                                        for (let i = clickedLocalIndex + 1; i < songsToDisplay.length; i++) {
                                            player.queuedTracks.push(songsToDisplay[i].url);
                                        }
                                        showToast('Queue', `Queued the rest of the list`);
                                    }
                                }
                                loadTrack(originalIndex, true); 
                                if(player.dom.playlistModal && player.dom.playlistModal.classList.contains('show')) togglePlaylistModal();
                            }
                        });
                        
                        player.dom.playlistContainer.appendChild(songEl);
                        
                        requestAnimationFrame(() => {
                            const titleEl = songEl.querySelector('.playlist-song-title');
                            const wrapperEl = songEl.querySelector('.playlist-song-title-wrapper');
                            if (titleEl.scrollWidth > wrapperEl.offsetWidth) {
                                titleEl.classList.add('overflowing');
                                const diff = titleEl.scrollWidth - wrapperEl.offsetWidth + 10;
                                titleEl.style.setProperty('--overflow-width', `-${diff}px`);
                            }
                        });
                    });
                    if (player.isPlaying) {
                        const playingImg = player.dom.playlistContainer.querySelector('.playlist-song.playing img');
                        if (playingImg) playingImg.classList.add('spinning');
                    }
                    if (!isFiltered) setupDragReorder();
                }

                function setupDragReorder() {
                    let dragState = null;

                    function clearIndicators() {
                        player.dom.playlistContainer.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                            el.classList.remove('drag-over-top', 'drag-over-bottom');
                        });
                    }

                    function onDragStart(e, songEl, idx) {
                        if (dragState) return;
                        e.preventDefault();
                        e.stopPropagation();

                        const touch = e.touches ? e.touches[0] : e;
                        const rect = songEl.getBoundingClientRect();

                        const ghost = songEl.cloneNode(true);
                        ghost.classList.add('drag-ghost');
                        ghost.classList.remove('dragging');
                        ghost.style.width = rect.width + 'px';
                        ghost.style.left = rect.left + 'px';
                        ghost.style.top = rect.top + 'px';
                        document.body.appendChild(ghost);

                        songEl.classList.add('dragging');

                        dragState = { index: idx, songEl, ghost, offsetY: touch.clientY - rect.top };

                        document.addEventListener('mousemove', onDragMove);
                        document.addEventListener('mouseup', onDragEnd);
                        document.addEventListener('touchmove', onDragMove, { passive: false });
                        document.addEventListener('touchend', onDragEnd);
                    }

                    function onDragMove(e) {
                        if (!dragState) return;
                        e.preventDefault();

                        const touch = e.touches ? e.touches[0] : e;
                        dragState.ghost.style.top = (touch.clientY - dragState.offsetY) + 'px';

                        clearIndicators();

                        const songs = player.dom.playlistContainer.querySelectorAll('.playlist-song:not(.dragging)');
                        for (const el of songs) {
                            const r = el.getBoundingClientRect();
                            if (touch.clientY >= r.top && touch.clientY <= r.bottom) {
                                el.classList.add(touch.clientY < r.top + r.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
                                break;
                            }
                        }

                        const cr = player.dom.playlistContainer.getBoundingClientRect();
                        const edge = 40;
                        if (touch.clientY < cr.top + edge && touch.clientY > cr.top) {
                            player.dom.playlistContainer.scrollTop -= 8;
                        } else if (touch.clientY > cr.bottom - edge && touch.clientY < cr.bottom) {
                            player.dom.playlistContainer.scrollTop += 8;
                        }
                    }

                    function onDragEnd() {
                        if (!dragState) return;

                        document.removeEventListener('mousemove', onDragMove);
                        document.removeEventListener('mouseup', onDragEnd);
                        document.removeEventListener('touchmove', onDragMove);
                        document.removeEventListener('touchend', onDragEnd);

                        const overEl = player.dom.playlistContainer.querySelector('.drag-over-top, .drag-over-bottom');
                        if (overEl) {
                            const allSongs = [...player.dom.playlistContainer.querySelectorAll('.playlist-song')];
                            let dropIdx = allSongs.indexOf(overEl);
                            if (overEl.classList.contains('drag-over-bottom')) dropIdx++;
                            if (dragState.index < dropIdx) dropIdx--;

                            if (dragState.index !== dropIdx) {
                                const currentUrl = player.playlist[player.currentTrack]?.url;
                                const [moved] = player.playlist.splice(dragState.index, 1);
                                player.playlist.splice(dropIdx, 0, moved);

                                if (!player.isShuffle) player.originalPlaylist = [...player.playlist];

                                if (currentUrl) {
                                    player.currentTrack = player.playlist.findIndex(t => t.url === currentUrl);
                                }

                                localStorage.setItem('oss_music_player_order', JSON.stringify(player.playlist.map(t => t.url)));

                                dragState.songEl.classList.remove('dragging');
                                clearIndicators();
                                dragState.ghost.remove();
                                dragState = null;
                                populatePlaylistModal();
                                return;
                            }
                        }

                        dragState.songEl.classList.remove('dragging');
                        clearIndicators();
                        dragState.ghost.remove();
                        dragState = null;
                    }

                    const songEls = player.dom.playlistContainer.querySelectorAll('.playlist-song');
                    songEls.forEach((songEl, idx) => {
                        const handle = songEl.querySelector('.drag-handle');
                        if (!handle) return;
                        handle.addEventListener('mousedown', (e) => onDragStart(e, songEl, idx));
                        handle.addEventListener('touchstart', (e) => onDragStart(e, songEl, idx), { passive: false });
                    });
                }
                
                if(player.dom.playlistBtn) player.dom.playlistBtn.addEventListener('click', togglePlaylistModal);
                if(player.dom.playlistToggleBtnMain) player.dom.playlistToggleBtnMain.addEventListener('click', togglePlaylistModal);
                if(player.dom.playlistModal) {
                    const closeBtn = player.dom.playlistModal.querySelector('.modal-close-btn');
                    if(closeBtn) closeBtn.addEventListener('click', togglePlaylistModal);
                }


                
                const filterPlaylist = () => {
                    if(!player.dom.playlistSearch) return;
                    const searchTerm = player.dom.playlistSearch.value.toLowerCase();
                    const showFavsOnly = player.dom.filterFavBtn && player.dom.filterFavBtn.classList.contains('active');
                    
                    const filteredSongs = player.playlist.filter(song => {
                        const matchesSearch = song.title.toLowerCase().includes(searchTerm) || song.artist.toLowerCase().includes(searchTerm);
                        const matchesFav = showFavsOnly ? isFavorite(song.url) : true;
                        return matchesSearch && matchesFav;
                    });
                    populatePlaylistModal(filteredSongs);
                };

                if(player.dom.playlistSearch) player.dom.playlistSearch.addEventListener('input', filterPlaylist);
                
                if(playerConfig.enableLikeSystem && player.dom.filterFavBtn) {
                    player.dom.filterFavBtn.addEventListener('click', () => {
                        player.dom.filterFavBtn.classList.toggle('active');
                        filterPlaylist();
                    });
                }

                document.addEventListener('click', (e) => {
                    // Transport controls stay usable while the playlist/settings are open.
                    if (e.target.closest('#music-player')) return;
                    if (player.dom.playlistModal && player.dom.playlistModal.classList.contains('show')) {
                        const modalContent = player.dom.playlistModal.querySelector('.modal-content');
                        if(modalContent && !e.composedPath().includes(modalContent) && !e.target.closest('.album-art-container') && !e.target.closest('.queue-icon') && !e.target.closest('#settings-btn')) {
                            togglePlaylistModal();
                        }
                    }
                    if (player.dom.settingsModal && player.dom.settingsModal.classList.contains('show')) {
                        const modalContent = player.dom.settingsModal.querySelector('.modal-content');
                        if(modalContent && !e.composedPath().includes(modalContent) && !e.target.closest('#settings-btn')) {
                            toggleSettingsModal();
                        }
                    }
                });
                
                function setupKeyboardShortcuts() {
                    document.addEventListener('keydown', (e) => {
                        if (e.defaultPrevented || e.target.closest('input, textarea, button, [role=button], [contenteditable=true]')) return;
                        
                        switch(e.code) {
                            case 'Space':
                                e.preventDefault();
                                togglePlay();
                                break;
                            case 'ArrowRight':
                                playNext();
                                break;
                            case 'ArrowLeft':
                                playPrevious();
                                break;
                            case 'KeyM':
                                player.audio.muted = !player.audio.muted;
                                break;
                        }
                    });
                }

                function setupMediaSession() {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.setActionHandler('play', () => { if (player.audio.paused) togglePlay(); });
                        navigator.mediaSession.setActionHandler('pause', () => player.audio.pause());
                        navigator.mediaSession.setActionHandler('nexttrack', playNext);
                        navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
                    }
                }
                
                function initializePlayer() {
                    if(playerConfig.enableVisualizer && player.dom.toggleBtn && player.dom.visualizerCanvas) player.dom.toggleBtn.appendChild(player.dom.visualizerCanvas);
                    if(playerConfig.enableVisualizer && player.dom.playerBody && player.dom.visualizerCanvas) player.dom.playerBody.insertBefore(player.dom.visualizerCanvas, player.dom.playerBody.firstChild);

                    setupThemeSwitcher();
                    setupPromotion();
                    applyTheme(localStorage.getItem('oss_music_player_theme') || playerConfig.defaultTheme);
                    
                    populatePlaylistModal();
                    
                    const videoFloatingToggle = document.getElementById('video-floating-toggle');
                    if(videoFloatingToggle) {
                        const isFloating = localStorage.getItem('oss_music_player_video_floating') === 'true';
                        videoFloatingToggle.checked = isFloating;
                        if(isFloating) player.dom.player.classList.add('video-floating');
                        
                        videoFloatingToggle.addEventListener('change', (e) => {
                            const floating = e.target.checked;
                            localStorage.setItem('oss_music_player_video_floating', floating);
                            if(floating) {
                                player.dom.player.classList.add('video-floating');
                            } else {
                                player.dom.player.classList.remove('video-floating');
                            }
                        });
                    }

                    const savedOrder = JSON.parse(localStorage.getItem('oss_music_player_order') || 'null');
                    if (savedOrder) {
                        const reordered = [];
                        for (const url of savedOrder) {
                            const song = player.originalPlaylist.find(s => s.url === url);
                            if (song) reordered.push(song);
                        }
                        for (const song of player.originalPlaylist) {
                            if (!reordered.find(s => s.url === song.url)) reordered.push(song);
                        }
                        player.playlist = reordered;
                        player.originalPlaylist = [...reordered];
                    }

                    const savedShuffle = localStorage.getItem('oss_music_player_isShuffle') === 'true';
                    const volumeValue = localStorage.getItem('oss_music_player_volume');
                    const savedVolume = volumeValue !== null && Number.isFinite(Number(volumeValue)) ? Math.max(0, Math.min(1, Number(volumeValue))) : 0.6;
                    const savedRepeatMode = localStorage.getItem('oss_music_player_repeatMode') || 'none';

                    player.audio.volume = savedVolume;
                    if(player.dom.volumeSlider) player.dom.volumeSlider.value = savedVolume;
                    player.repeatMode = savedRepeatMode;
                    if(player.dom.repeatBtn) {
                        if(player.repeatMode === 'all') { player.dom.repeatBtn.classList.add('toggled-glow'); player.dom.repeatBtn.setAttribute('aria-pressed', 'true'); }
                        else if (player.repeatMode === 'one') { player.dom.repeatBtn.classList.add('toggled-glow', 'repeat-one-active'); player.dom.repeatBtn.setAttribute('aria-pressed', 'true'); }
                    }
                    if(savedShuffle && player.dom.shuffleBtn) player.dom.shuffleBtn.click();
                    const savedTrack = parseInt(localStorage.getItem('oss_music_player_currentTrack'), 10) || 0;
                    loadTrack(savedTrack > 0 && savedTrack < player.playlist.length ? savedTrack : 0);
                    
                    setupKeyboardShortcuts();
                    setupMediaSession();
                    document.body.classList.remove('loading');
                }
                initializePlayer();
                installHubBridge(player, { loadTrack, togglePlay, initAudioContext, togglePlaylistModal });
            }
            setupMusicPlayer();
        });
