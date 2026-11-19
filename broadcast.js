
(() => {
  const cfg = window.APP_CONFIG;

  const image = document.getElementById('broadcast-image');
  const video = document.getElementById('broadcast-video');

  const MEDIA = {
    'Padel_V2.jpg': 'image',
    'Padel_V3.jpg': 'image',
    'Padel_V5 (2).jpg': 'image',
    'kling_20261113_VIDEO_make_a_sho_5488_0.mp4': 'video'
  };

  const DEFAULT_MEDIA = 'Padel_V2.jpg';

  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    console.error('Supabase-configuratie ontbreekt');
    return;
  }

  if (!window.supabase) {
    console.error('Supabase library kon niet worden geladen');
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let currentMedia = null;
  let lastUpdatedAt = null;

  function showImage(filename, updatedAt) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.classList.remove('active');

    image.classList.add('active');

    const version = updatedAt
      ? `?v=${encodeURIComponent(updatedAt)}`
      : '';

    image.src = `/images/${encodeURIComponent(filename)}${version}`;

    console.log('Afbeelding weergegeven:', filename);
  }

  async function showVideo(filename) {
    image.classList.remove('active');
    image.removeAttribute('src');

    video.classList.add('active');
    video.pause();
    video.loop = true;
    video.muted = true;
    video.volume = 0;

    video.src = `/images/${encodeURIComponent(filename)}`;
    video.load();

    try {
      await video.play();
      console.log('Video gestart:', filename);
    } catch (error) {
      console.error('Video automatisch afspelen mislukt:', error);
    }
  }

  function applyMedia(filename, updatedAt) {
    const mode = MEDIA[filename];

    if (!mode) {
      console.error('Onbekend mediabestand:', filename);
      return;
    }

    // Oudere opdrachten mogen een nieuwere selectie niet overschrijven.
    if (
      updatedAt &&
      lastUpdatedAt &&
      Date.parse(updatedAt) < Date.parse(lastUpdatedAt)
    ) {
      return;
    }

    if (
      filename === currentMedia &&
      updatedAt === lastUpdatedAt
    ) {
      return;
    }

    currentMedia = filename;
    lastUpdatedAt = updatedAt || null;

    if (mode === 'image') {
      showImage(filename, updatedAt);
    } else {
      showVideo(filename);
    }
  }

  // Start met de standaardafbeelding.
  applyMedia(DEFAULT_MEDIA, null);

  // Haal de laatst gekozen media op uit Supabase.
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

    if (MEDIA[data.command_id]) {
      applyMedia(data.command_id, data.updated_at);
    } else {
      console.log('Geen geldige media geselecteerd; standaardafbeelding blijft staan.');
    }
  }

  // Luister naar nieuwe selecties vanaf de telefoon.
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

        console.log('Nieuwe mediaopdracht:', state);

        applyMedia(state.command_id, state.updated_at);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Supabase Realtime verbonden');
        loadCurrentState();
      }

      if (status === 'CHANNEL_ERROR') {
        console.error('Supabase Realtime verbindingsfout');
      }
    });

  image.addEventListener('error', () => {
    console.error('Afbeelding kon niet worden geladen:', image.src);
  });

  video.addEventListener('error', () => {
    console.error('Videofout:', video.error);
  });

})();
