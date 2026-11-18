
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

  function showSpecialScreen() {
    document.body.classList.add('special-active');
  }

  function showFireplaceScreen() {
    document.body.classList.remove('special-active');
  }

  // YouTube API
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtube-player', {
      videoId: cfg.YOUTUBE_VIDEO_ID,

      playerVars: {
        autoplay: 1,
        mute: 1,
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

    active = true;
    lastCommand = commandId;

    showSpecialScreen();

    if (player) {
      player.pauseVideo();
    }

    try {
      video.pause();
      video.src = cfg.SPECIAL_VIDEO_URL;
      video.load();

      status.textContent = 'Sinterklaasuitzending';

      await video.play();

      console.log('Sinterklaasvideo gestart');
    } catch (error) {
      handleVideoError(error);
    }
  }

  function returnToFireplace() {
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
