
(() => {
  const cfg = window.APP_CONFIG;
  const status = document.getElementById('status');
  const video = document.getElementById('broadcast-video');

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    status.textContent = 'Supabase-configuratie ontbreekt';
    console.error('Supabase-configuratie ontbreekt');
    return;
  }

  if (!cfg.FIREPLACE_VIDEO_URL || !cfg.SPECIAL_VIDEO_URL) {
    status.textContent = 'Videoconfiguratie ontbreekt';
    console.error('Een of beide video-URL\'s ontbreken');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let currentMode = null;
  let lastCommand = null;
  let playbackToken = 0;

  // Videoscherm instellen
  function setScreen(mode) {
    document.body.classList.toggle(
      'special-active',
      mode === 'special'
    );
  }

  // Een MP4 laden en afspelen
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

    status.textContent =
      mode === 'special'
        ? 'Sinterklaasuitzending laden…'
        : 'Openhaard laden…';

    console.log('Video laden:', mode, url);

    try {
      await video.play();

      if (token !== playbackToken) return;

      console.log(mode + ' gestart met geluid');

      status.textContent =
        mode === 'special'
          ? 'Sinterklaasuitzending'
          : 'Openhaard';

    } catch (error) {
      if (token !== playbackToken) return;

      console.warn(
        'Afspelen met geluid niet toegestaan:',
        error.name,
        error.message
      );

      // Tweede poging: automatisch afspelen zonder geluid.
      if (error.name === 'NotAllowedError') {
        try {
          video.muted = true;

          await video.play();

          if (token !== playbackToken) return;

          console.log(mode + ' gestart zonder geluid');

          status.textContent =
            mode === 'special'
              ? 'Sinterklaas speelt zonder geluid'
              : 'Openhaard speelt zonder geluid';

          return;

        } catch (mutedError) {
          if (token !== playbackToken) return;

          console.error('Ook gedempt afspelen mislukt:', mutedError);
        }
      }

      status.textContent = 'Video kon niet starten';
    }
  }

  // Openhaardvideo
  function playFireplace() {
    lastCommand = null;

    console.log('Overschakelen naar openhaard');

    playVideo(
      'fireplace',
      cfg.FIREPLACE_VIDEO_URL,
      true
    );
  }

  // Sinterklaasvideo
  function playSpecial(commandId) {
    if (
      currentMode === 'special' &&
      lastCommand === commandId
    ) {
      return;
    }

    lastCommand = commandId;

    console.log('START ontvangen:', commandId);

    playVideo(
      'special',
      cfg.SPECIAL_VIDEO_URL,
      false
    );
  }

  // Wanneer de Sinterklaasvideo eindigt
  video.addEventListener('ended', () => {
    if (currentMode === 'special') {
      console.log('Sinterklaasvideo afgelopen');

      playFireplace();
    }
  });

  // Videofouten
  video.addEventListener('error', () => {
    console.error(
      'Videofout:',
      video.error
    );

    status.textContent =
      'Videofout – controleer de videobron';

  });

  // Direct starten met de openhaard
  playFireplace();

  // Bestaande Supabase-status ophalen
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

  // Live opdrachten vanuit de telefooncontroller
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
