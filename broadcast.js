
(() => {
  const cfg = window.APP_CONFIG;
  const status = document.getElementById('status');
  const video = document.getElementById('special-video');
  const ytId = cfg.YOUTUBE_VIDEO_ID;

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    status.textContent = 'Supabase-configuratie ontbreekt';
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let player = null;
  let active = false;
  let lastCommand = null;

  // YouTube API laden
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtube-player', {
      videoId: ytId,

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

          // Tijdelijke autoplay-test zonder geluid
          event.target.mute();
          event.target.playVideo();

          status.textContent = 'Openhaard - autoplay test';
        },

        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            console.log('YouTube speelt');
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

  // Sinterklaasvideo starten
  async function playSpecial(commandId) {
    if (active || lastCommand === commandId) return;

    active = true;
    lastCommand = commandId;

    video.style.display = 'block';

    try {
      if (player) {
        player.pauseVideo();
      }

      video.src = cfg.SPECIAL_VIDEO_URL;
      video.currentTime = 0;

      status.textContent = 'Sinterklaasuitzending';

      await video.play();

      console.log('Sinterklaasvideo gestart');

    } catch (error) {
      console.error('MP4 playback failed:', error);

      active = false;
      video.style.display = 'none';

      if (player) {
        player.playVideo();
      }

      status.textContent = 'Video kon niet starten';
    }
  }

  // Terug naar openhaard
  function returnToFireplace() {
    if (!active) return;

    active = false;

    video.pause();
    video.style.display = 'none';
    video.removeAttribute('src');
    video.load();

    status.textContent = 'Openhaard';

    if (player) {
      player.playVideo();
    }

    console.log('Teruggeschakeld naar openhaard');
  }

  // Automatisch terugschakelen na MP4
  video.addEventListener('ended', returnToFireplace);

  video.addEventListener('error', () => {
    if (active) {
      active = false;
      video.style.display = 'none';

      if (player) {
        player.playVideo();
      }

      status.textContent = 'Fout bij laden MP4';
    }
  });

  // Huidige uitzending ophalen
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

  // Luisteren naar opdrachten vanaf controller
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
