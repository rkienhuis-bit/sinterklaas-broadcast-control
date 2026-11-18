
(() => {
  const cfg = window.APP_CONFIG;
  const status = document.getElementById('status');
  const video = document.getElementById('special-video');

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    status.textContent = 'Supabase-configuratie ontbreekt';
    console.error('Supabase-configuratie ontbreekt');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let player = null;
  let active = false;
  let lastCommand = null;
  let pendingCommandId = null;
  let mediaUnlocked = false;

  function showSpecialScreen() {
    document.body.classList.add('special-active');
  }

  function showFireplaceScreen() {
    document.body.classList.remove('special-active');
  }

  // Echte toetsenbord- of afstandsbedieningsinvoer
  function handleActivationKey(event) {
    if (!event.isTrusted || mediaUnlocked) return;

    // Modifiertoetsen tellen niet als onze activatietoets.
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) {
      return;
    }

    mediaUnlocked = true;

    if (event.cancelable) {
      event.preventDefault();
    }

    console.log('Echte toets ontvangen:', {
      key: event.key,
      code: event.code,
      trusted: event.isTrusted,
      userActivation: navigator.userActivation?.hasBeenActive
    });

    // MP4-element voorbereiden binnen de echte toetsinteractie.
    video.pause();
    video.src = cfg.SPECIAL_VIDEO_URL;
    video.muted = false;
    video.volume = 1;
    video.load();

    status.textContent =
      `Toets herkend: ${event.key || event.code} – audio voorbereid`;

    console.log('MP4 voorbereid voor afspelen met geluid');

    // Was er al een START-commando binnengekomen?
    if (pendingCommandId) {
      const commandId = pendingCommandId;
      pendingCommandId = null;
      playSpecial(commandId);
    }
  }

  document.addEventListener('keydown', handleActivationKey, true);

  // YouTube API
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtube-player', {
      videoId: cfg.YOUTUBE_VIDEO_ID,

      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
      },

      events: {
        onReady: (event) => {
          console.log('YouTube player gereed');

          if (!active) {
            event.target.mute();
            event.target.setVolume(100);
            event.target.playVideo();
            status.textContent = 'Openhaard';
          } else {
            event.target.pauseVideo();
          }
        },

        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING && !active) {
            console.log('Openhaard speelt (gedempt)');
            status.textContent = 'Openhaard';
          }

          if (event.data === YT.PlayerState.PAUSED) {
            console.log('YouTube gepauzeerd');
          }
        },

        onError: (event) => {
          console.error('YouTube fout:', event.data);
          status.textContent = 'YouTube kon niet laden';
        }
      }
    });
  };

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  function handleVideoError(error) {
    if (!active) return;

    console.error('MP4 playback failed:', error);

    active = false;
    lastCommand = null;

    video.pause();
    video.removeAttribute('src');
    video.load();

    showFireplaceScreen();

    if (player) {
      player.playVideo();
    }

    status.textContent = 'MP4 kon niet starten - autoplay of videofout';
  }

  async function playSpecial(commandId) {
    if (active || lastCommand === commandId) return;

    // Wachten op echte toetsinvoer als Chrome nog niet geactiveerd is.
    if (!mediaUnlocked) {
      pendingCommandId = commandId;
      status.textContent = 'Wacht op toetsinvoer voor audio';
      console.log('START ontvangen; wacht op echte toetsinvoer');
      return;
    }

    active = true;
    lastCommand = commandId;
    pendingCommandId = null;

    showSpecialScreen();

    if (player) {
      player.pauseVideo();
    }

    try {
      video.pause();

      const specialUrl = new URL(
        cfg.SPECIAL_VIDEO_URL,
        window.location.href
      ).href;

      if (video.src !== specialUrl) {
        video.src = cfg.SPECIAL_VIDEO_URL;
        video.load();
      }

      video.muted = false;
      video.volume = 1;

      status.textContent = 'Sinterklaasuitzending';

      await video.play();

      console.log('Sinterklaasvideo gestart met geluid');
    } catch (error) {
      handleVideoError(error);
    }
  }

  function returnToFireplace() {
    pendingCommandId = null;

    if (!active) return;

    active = false;
    lastCommand = null;

    video.pause();
    video.removeAttribute('src');
    video.load();

    showFireplaceScreen();

    status.textContent = 'Openhaard';

    if (player) {
      player.mute();
      player.playVideo();
    }

    console.log('Teruggeschakeld naar openhaard');
  }

  video.addEventListener('ended', returnToFireplace);

  video.addEventListener('error', () => {
    if (active) {
      handleVideoError(video.error);
    }
  });

  // Huidige status ophalen
  db.from('broadcast_state')
    .select('mode,command_id')
    .eq('id', 1)
    .single()
    .then(({ data, error }) => {
      if (error) {
        status.textContent = 'Geen verbinding met regie';
        console.error(error);
        return;
      }

      if (data.mode === 'special') {
        playSpecial(data.command_id);
      }
    });

  // Live opdrachten ontvangen
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

        if (state.mode === 'special') {
          playSpecial(state.command_id);
        }

        if (state.mode === 'fireplace') {
          returnToFireplace();
        }
      }
    )
    .subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        console.log('Supabase Realtime verbonden');
      }
    });

})();
