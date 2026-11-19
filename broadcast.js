
(() => {
  const cfg = window.APP_CONFIG;

  const image = document.getElementById('broadcast-image');
  const video = document.getElementById('broadcast-video');

  const FADE_DURATION = 1000;

  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    console.error('Supabase-configuratie ontbreekt.');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let mediaItems = [];
  let currentFile = null;
  let playbackToken = 0;
  let activeElement = null;

  function findMedia(file) {
    return mediaItems.find(item => item.file === file);
  }

  function waitForTransition(element) {
    return new Promise(resolve => {
      let finished = false;

      const done = () => {
        if (finished) return;
        finished = true;
        element.removeEventListener('transitionend', onEnd);
        resolve();
      };

      const onEnd = event => {
        if (event.propertyName === 'opacity') done();
      };

      element.addEventListener('transitionend', onEnd);
      setTimeout(done, FADE_DURATION + 100);
    });
  }

  async function fadeTo(element, token) {
    if (token !== playbackToken) return;

    element.classList.remove('fading');
    element.classList.add('active');

    // Laat de browser de beginstatus verwerken.
    await new Promise(requestAnimationFrame);

    if (token !== playbackToken) return;

    element.classList.add('active');
    element.classList.remove('fading');

    if (activeElement && activeElement !== element) {
      activeElement.classList.remove('active');
      activeElement.classList.add('fading');
    }

    const previousElement = activeElement;
    activeElement = element;

    const promises = [waitForTransition(element)];

    if (previousElement && previousElement !== element) {
      promises.push(waitForTransition(previousElement));
    }

    await Promise.all(promises);

    if (token !== playbackToken) return;

    if (previousElement && previousElement !== element) {
      previousElement.classList.remove('active', 'fading');

      if (previousElement === video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    }

    element.classList.add('active');
    element.classList.remove('fading');
  }

  function prepareImage(item, token) {
    return new Promise((resolve, reject) => {
      image.onload = () => {
        if (token !== playbackToken) return resolve(false);
        resolve(true);
      };

      image.onerror = () => {
        if (token !== playbackToken) return resolve(false);
        reject(new Error('Afbeelding kon niet worden geladen: ' + item.file));
      };

      image.src = `/images/${encodeURIComponent(item.file)}`;
    });
  }

  async function prepareVideo(item, token) {
    video.pause();
    video.removeAttribute('src');

    video.loop = true;
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;

    video.src = `/images/${encodeURIComponent(item.file)}`;
    video.load();

    await new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('Video kon niet worden geladen: ' + item.file));
      };

      const cleanup = () => {
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });

      if (video.readyState >= 3) {
        cleanup();
        resolve();
      }
    });

    if (token !== playbackToken) return false;

    await video.play();

    return token === playbackToken;
  }

  async function showMedia(file, updatedAt) {
    const item = findMedia(file);

    if (!item) {
      console.warn('Onbekend mediabestand:', file);
      return;
    }

    const commandKey = `${file}|${updatedAt || ''}`;

    if (commandKey === currentFile) return;

    currentFile = commandKey;
    const token = ++playbackToken;

    console.log('Nieuwe uitzending voorbereiden:', item.name);

    try {
      if (item.type === 'image') {
        const ready = await prepareImage(item, token);
        if (!ready || token !== playbackToken) return;

        await fadeTo(image, token);

      } else if (item.type === 'video') {
        const ready = await prepareVideo(item, token);
        if (!ready || token !== playbackToken) return;

        await fadeTo(video, token);
      }

      console.log('Crossfade voltooid:', item.name);

    } catch (error) {
      if (token !== playbackToken) return;

      console.error('Mediawissel mislukt:', error);
    }
  }

  async function loadMedia() {
    const response = await fetch('/media.json', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('media.json kon niet worden geladen.');
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Ongeldig media.json-bestand.');
    }

    mediaItems = data.filter(item =>
      item &&
      typeof item.file === 'string' &&
      typeof item.name === 'string' &&
      ['image', 'video'].includes(item.type) &&
      !item.file.includes('/') &&
      !item.file.includes('\\')
    );

    if (!mediaItems.length) {
      throw new Error('Geen geldige media gevonden.');
    }
  }

  async function loadCurrentState() {
    const { data, error } = await db
      .from('broadcast_state')
      .select('mode, command_id, updated_at')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Supabase-status ophalen mislukt:', error);
      return;
    }

    if (findMedia(data.command_id)) {
      showMedia(data.command_id, data.updated_at);
    } else {
      showMedia('Padel_V2.jpg', 'default');
    }
  }

  async function start() {
    try {
      await loadMedia();

      const defaultImage = findMedia('Padel_V2.jpg');

      if (defaultImage) {
        await showMedia(defaultImage.file, 'default');
      }

      db.channel('broadcast-control')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'broadcast_state',
            filter: 'id=eq.1'
          },
          payload => {
            const state = payload.new;
            showMedia(state.command_id, state.updated_at);
          }
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            console.log('Supabase Realtime verbonden.');
            loadCurrentState();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Supabase Realtime verbindingsfout.');
          }
        });

    } catch (error) {
      console.error('Broadcast starten mislukt:', error);
    }
  }

  start();
})();
