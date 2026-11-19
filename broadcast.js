
(() => {
  const cfg = window.APP_CONFIG;

  const image = document.getElementById('broadcast-image');
  const video = document.getElementById('broadcast-video');

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

  function findMedia(file) {
    return mediaItems.find(item => item.file === file);
  }

  function showImage(item) {
    const token = ++playbackToken;

    video.pause();
    video.removeAttribute('src');
    video.load();
    video.classList.remove('active');

    image.classList.remove('active');

    image.onload = () => {
      if (token !== playbackToken) return;
      image.classList.add('active');
      console.log('Afbeelding actief:', item.name);
    };

    image.onerror = () => {
      if (token !== playbackToken) return;
      console.error('Afbeelding kon niet worden geladen:', item.file);
    };

    image.src = `/images/${encodeURIComponent(item.file)}`;
  }

  async function showVideo(item) {
    const token = ++playbackToken;

    image.classList.remove('active');

    video.pause();
    video.removeAttribute('src');

    video.loop = true;
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;

    video.src = `/images/${encodeURIComponent(item.file)}`;
    video.classList.add('active');
    video.load();

    try {
      await video.play();

      if (token !== playbackToken) return;

      console.log('Video actief:', item.name);
    } catch (error) {
      if (token !== playbackToken) return;
      console.error('Video afspelen mislukt:', error);
    }
  }

  function showMedia(file, updatedAt) {
    const item = findMedia(file);

    if (!item) {
      console.warn('Onbekend mediabestand:', file);
      return;
    }

    const commandKey = `${file}|${updatedAt || ''}`;

    if (commandKey === currentFile) return;
    currentFile = commandKey;

    console.log('Nieuwe uitzending:', item.name);

    if (item.type === 'image') {
      showImage(item);
    } else if (item.type === 'video') {
      showVideo(item);
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

      // Toon direct de standaardafbeelding.
      const defaultImage = findMedia('Padel_V2.jpg');

      if (defaultImage) {
        showMedia(defaultImage.file, 'default');
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
