
(() => {
  const cfg = window.APP_CONFIG;
  const status = document.getElementById('status');
  const video = document.getElementById('broadcast-video');

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('Supabase-configuratie ontbreekt');
    return;
  }

  if (!cfg.SPECIAL_VIDEO_URL) {
    console.error('Sinterklaasvideo ontbreekt in config.js');
    return;
  }

  if (!window.Hls) {
    console.error('Hls.js kon niet worden geladen');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  // Vercel-proxy naar de testvideo op Dropbox.
  const FIREPLACE_SEGMENT_URL =
    'https://sinterklaas-broadcast-control.vercel.app/api/fireplace';

  // Byte-ranges van de 40 seconden durende testvideo.
  const ranges = [
    '739780@0',
    '689584@739780',
    '533544@1429364',
    '529408@1962908',
    '599156@2492316',
    '505720@3091472',
    '516436@3597192',
    '607992@4113628',
    '558924@4721620',
    '537868@5280544'
  ];

  const playlistLines = [
    '#EXTM3U',
    '#EXT-X-VERSION:4',
    '#EXT-X-TARGETDURATION:4',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD'
  ];

  ranges.forEach((range) => {
    playlistLines.push('#EXTINF:4.000000,');
    playlistLines.push('#EXT-X-BYTERANGE:' + range);
    playlistLines.push(FIREPLACE_SEGMENT_URL);
  });

  playlistLines.push('#EXT-X-ENDLIST');

  const playlistBlob = new Blob(
    [playlistLines.join('\n')],
    { type: 'application/vnd.apple.mpegurl' }
  );

  const fireplacePlaylistUrl =
    URL.createObjectURL(playlistBlob);

  let hls = null;
  let currentMode = null;
  let lastCommand = null;
  let lastAudioCommand = null;
  let playbackToken = 0;

  function setScreen(mode) {
    document.body.classList.toggle(
      'special-active',
      mode === 'special'
    );
  }

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  async function startPlayback(token, mode) {
    try {
      await video.play();

      if (token !== playbackToken) return;

      console.log(mode + ' gestart');

    } catch (error) {
      if (token !== playbackToken) return;

      console.error('Automatisch afspelen mislukt:', error);
    }
  }

  function playFireplace() {
    const token = ++playbackToken;

    currentMode = 'fireplace';
    lastCommand = null;

    setScreen('fireplace');
    destroyHls();

    video.pause();
    video.removeAttribute('src');
    video.loop = true;
    video.muted = true;
    video.volume = 1;
    video.load();

    console.log('Open haard laden via HLS');

    if (status) {
      status.textContent = 'Open haard laden...';
    }

    if (Hls.isSupported()) {
      hls = new Hls();

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && token === playbackToken) {
          console.error('HLS-fout:', data.type, data.details);
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (token !== playbackToken) return;

        console.log('Openhaard-playlist geladen');

        startPlayback(token, 'Open haard');
      });

      hls.loadSource(fireplacePlaylistUrl);
      hls.attachMedia(video);

    } else if (
      video.canPlayType('application/vnd.apple.mpegurl')
    ) {
      video.src = fireplacePlaylistUrl;
      video.load();

      video.addEventListener(
        'loadedmetadata',
        () => startPlayback(token, 'Open haard'),
        { once: true }
      );

    } else {
      console.error('Deze speler ondersteunt geen HLS');
    }
  }

  function playSpecial(commandId) {
    if (
      currentMode === 'special' &&
      lastCommand === commandId
    ) {
      return;
    }

    const token = ++playbackToken;

    currentMode = 'special';
    lastCommand = commandId;

    setScreen('special');
    destroyHls();

    console.log('Sinterklaas START ontvangen:', commandId);

    video.pause();
    video.removeAttribute('src');
    video.loop = false;
    video.muted = true;
    video.volume = 1;
    video.src = cfg.SPECIAL_VIDEO_URL;
    video.load();

    startPlayback(token, 'Sinterklaas');
  }

  function activateAudio(commandId) {
    if (lastAudioCommand === commandId) return;

    lastAudioCommand = commandId;

    console.log('Audio-opdracht ontvangen');

    video.muted = false;
    video.volume = 1;

    console.log('Geluid aangezet. Browser kan dit nog blokkeren.');
  }

  video.addEventListener('ended', () => {
    if (currentMode === 'special') {
      console.log('Sinterklaasvideo afgelopen');
      playFireplace();
    }
  });

  video.addEventListener('error', () => {
    console.error('Videofout:', video.error);
  });

  // Een lokale klik kan geluid activeren wanneer dat mogelijk is.
  document.addEventListener('click', async () => {
    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
      console.log('Geluid geactiveerd via lokale klik');
    } catch (error) {
      console.error('Geluid activeren mislukt:', error);
    }
  }, { once: true });

  // Start standaard met de open haard.
  playFireplace();

  // Controleer de huidige status in Supabase.
  db.from('broadcast_state')
    .select('mode,command_id')
    .eq('id', 1)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error('Supabase-status ophalen mislukt:', error);
        return;
      }

      if (data.mode === 'special') {
        playSpecial(data.command_id);
      }
    });

  // Luister naar nieuwe opdrachten vanaf de telefoon.
  db.channel('broadcast-control')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'broadcast_state',
        filter: 'id=eq.1'
      },
      (payload) => {
        const state = payload.new;

        console.log('Nieuwe controlleropdracht:', state);

        if (state.command_id?.startsWith('audio-')) {
          activateAudio(state.command_id);
          return;
        }

        if (state.mode === 'special') {
          playSpecial(state.command_id);
        }

        if (state.mode === 'fireplace') {
          playFireplace();
        }
      }
    )
    .subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        console.log('Supabase Realtime verbonden');
      }
    });

})();
