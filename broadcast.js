
(() => {
  const cfg = window.APP_CONFIG;

  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    console.error('Supabase-configuratie ontbreekt.');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  const layers = [
    document.getElementById('layer-1'),
    document.getElementById('layer-2')
  ];

  const FADE_DURATION = 1000;

  let mediaItems = [];
  let activeIndex = 0;
  let currentCommand = null;
  let playbackToken = 0;
  let switching = false;
  let pendingCommand = null;

  function findMedia(file) {
    return mediaItems.find(item => item.file === file);
  }

  function getElements(layer) {
    return {
      image: layer.querySelector('img'),
      video: layer.querySelector('video')
    };
  }

  function hideMedia(layer) {
    const { image, video } = getElements(layer);

    image.removeAttribute('src');
    image.style.display = 'none';

    video.pause();
    video.removeAttribute('src');
    video.load();
    video.style.display = 'none';
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function prepareMedia(layer, item, token) {
    const { image, video } = getElements(layer);

    hideMedia(layer);

    if (item.type === 'image') {
      image.style.display = 'block';

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error('Afbeelding kon niet worden geladen: ' + item.file)
        );

        image.src = `/images/${encodeURIComponent(item.file)}`;
      });

    } else {
      video.style.display = 'block';
      video.muted = true;
      video.volume = 0;
      video.loop = true;
      video.playsInline = true;

      video.src = `/images/${encodeURIComponent(item.file)}`;
      video.load();

      await new Promise((resolve, reject) => {
        const ready = () => {
          cleanup();
          resolve();
        };

        const failed = () => {
          cleanup();
          reject(new Error('Video kon niet worden geladen: ' + item.file));
        };

        const cleanup = () => {
          video.removeEventListener('canplay', ready);
          video.removeEventListener('error', failed);
        };

        video.addEventListener('canplay', ready, { once: true });
        video.addEventListener('error', failed, { once: true });

        if (video.readyState >= 3) {
          cleanup();
          resolve();
        }
      });

      if (token !== playbackToken) return;

      await video.play();
    }

    if (token !== playbackToken) return;
  }

  async function showMedia(file, updatedAt) {
    const item = findMedia(file);

    if (!item) {
      console.warn('Onbekend mediabestand:', file);
      return;
    }

    const command = `${file}|${updatedAt || ''}`;

    if (command === currentCommand) return;

    if (switching) {
      pendingCommand = { file, updatedAt };
      return;
    }

    switching = true;
    const token = ++playbackToken;

    try {
      const nextIndex = 1 - activeIndex;
      const oldLayer = layers[activeIndex];
      const newLayer = layers[nextIndex];

      console.log('Nieuwe content voorbereiden:', item.name);

      await prepareMedia(newLayer, item, token);

      if (token !== playbackToken) return;

      // Eerst de nieuwe laag activeren.
      newLayer.classList.add('active');

      // Browser de startpositie laten verwerken.
      await new Promise(requestAnimationFrame);

      if (token !== playbackToken) return;

      // Oude laag geleidelijk laten verdwijnen.
      oldLayer.classList.remove('active');

      await wait(FADE_DURATION);

      if (token !== playbackToken) return;

      hideMedia(oldLayer);

      activeIndex = nextIndex;
      currentCommand = command;

      console.log('Crossfade voltooid:', item.name);

    } catch (error) {
      if (token === playbackToken) {
        console.error('Mediawissel mislukt:', error);
      }
    } finally {
      switching = false;

      if (pendingCommand) {
        const next = pendingCommand;
        pendingCommand = null;
        showMedia(next.file, next.updatedAt);
      }
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

      // Beide lagen schoon beginnen.
      layers.forEach((layer, index) => {
        layer.classList.toggle('active', index === 0);
        hideMedia(layer);
      });

      await showMedia('Padel_V2.jpg', 'default');

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
            showMedia(
              payload.new.command_id,
              payload.new.updated_at
            );
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
