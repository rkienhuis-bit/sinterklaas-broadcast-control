
(() => {
  const cfg = window.APP_CONFIG;
  const status = document.getElementById('status');
  const video = document.getElementById('broadcast-video');

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('Supabase-configuratie ontbreekt');
    return;
  }

  if (!cfg.FIREPLACE_VIDEO_URL || !cfg.SPECIAL_VIDEO_URL) {
    console.error('Videoconfiguratie ontbreekt');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let currentMode = null;
  let lastCommand = null;
  let lastAudioCommand = null;
  let playbackToken = 0;

  function setScreen(mode) {
    document.body.classList.toggle('special-active', mode === 'special');
  }

  async function playVideo(mode, url, loop = false) {
    const token = ++playbackToken;

    currentMode = mode;
    setScreen(mode);

    video.pause();
    video.loop = loop;
    video.volume = 1;
    video.muted = false;
    video.src = url;
    video.load();

    if (status) status.textContent = 'Video laden…';

    console.log('Video laden:', mode, url);

    try {
      await video.play();
      if (token !== playbackToken) return;
      console.log(mode + ' gestart');
    } catch (error) {
      if (token !== playbackToken) return;

      console.warn('Afspelen met geluid mislukt:', error);

      if (error.name === 'NotAllowedError') {
        try {
          video.muted = true;
          await video.play();
          if (token !== playbackToken) return;
          console.log(mode + ' gestart zonder geluid');
        } catch (mutedError) {
          console.error('Afspelen mislukt:', mutedError);
        }
      }
    }
  }

  function playFireplace() {
    lastCommand = null;
    console.log('Overschakelen naar openhaard');
    playVideo('fireplace', cfg.FIREPLACE_VIDEO_URL, true);
  }

  function playSpecial(commandId) {
    if (currentMode === 'special' && lastCommand === commandId) return;

    lastCommand = commandId;
    console.log('START ontvangen:', commandId);

    playVideo('special', cfg.SPECIAL_VIDEO_URL, false);
  }

  async function activateAudio(commandId) {
    if (lastAudioCommand === commandId) return;
    lastAudioCommand = commandId;

    console.log('Audio-opdracht ontvangen');

    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
      console.log('Audio geactiveerd');
    } catch (error) {
      console.warn('Browser blokkeert audio op afstand:', error);
    }
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

  playFireplace();

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
