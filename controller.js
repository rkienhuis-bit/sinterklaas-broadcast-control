
(() => {
  const cfg = window.APP_CONFIG;
  const $ = id => document.getElementById(id);

  const pin = $('pin');
  const mediaList = $('media-list');
  const currentTitle = $('current-title');
  const message = $('message');

  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    message.textContent = 'Supabase-configuratie ontbreekt.';
    return;
  }

  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let connected = false;
  let mediaItems = [];
  let currentFile = null;
  let sending = false;

  function getMedia(file) {
    return mediaItems.find(item => item.file === file);
  }

  function render() {
    mediaList.innerHTML = '';

    if (!mediaItems.length) {
      mediaList.textContent = 'Geen content gevonden.';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'media-grid';

    mediaItems.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-card';

      if (item.file === currentFile) {
        button.classList.add('is-current');
      }

      button.disabled = !connected || sending;

      const preview = document.createElement('div');
      preview.className = 'media-preview';

      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = `/images/${encodeURIComponent(item.file)}`;
        img.alt = item.name;
        img.loading = 'lazy';

        img.addEventListener('error', () => {
          preview.innerHTML = '';
          const placeholder = document.createElement('div');
          placeholder.className = 'media-preview-placeholder';
          placeholder.textContent = '⚠';
          preview.appendChild(placeholder);
        });

        preview.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'media-preview-placeholder';
        placeholder.textContent = '▶';
        preview.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'media-info';

      const name = document.createElement('span');
      name.className = 'media-name';
      name.textContent = item.name;

      const type = document.createElement('span');
      type.className = 'media-type';
      type.textContent = item.type === 'video' ? 'Video' : 'Afbeelding';

      info.append(name, type);
      button.append(preview, info);

      button.addEventListener('click', () => selectMedia(item));

      grid.appendChild(button);
    });

    mediaList.appendChild(grid);
  }

  function updateCurrent(file) {
    currentFile = file;

    const item = getMedia(file);
    currentTitle.textContent = item
      ? item.name
      : 'Geen content geselecteerd';

    render();
  }

  function setConnection(ok, label) {
    connected = ok;

    $('connection').innerHTML =
      '<span class="dot ' + (ok ? 'online' : '') + '"></span> ' + label;

    render();
  }

  async function loadMedia() {
    try {
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

      render();

    } catch (error) {
      console.error(error);
      mediaList.textContent = error.message;
    }
  }

  async function loadCurrentState() {
    const { data, error } = await db
      .from('broadcast_state')
      .select('mode, command_id')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Status ophalen mislukt:', error);
      setConnection(false, 'Geen verbinding');
      message.textContent = 'Controleer de Supabase-verbinding.';
      return;
    }

    if (getMedia(data.command_id)) {
      updateCurrent(data.command_id);
    } else {
      updateCurrent('Padel_V2.jpg');
    }

    setConnection(true, 'Verbonden');
  }

  async function selectMedia(item) {
    if (!connected || sending) return;

    if (!pin.value.trim()) {
      message.textContent = 'Vul eerst de regiecode in.';
      pin.focus();
      return;
    }

    sending = true;
    message.textContent = 'Opdracht versturen…';
    render();

    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pin: pin.value,
          media: item.file
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Opdracht mislukt.');
      }

      updateCurrent(item.file);
      message.textContent = `${item.name} geselecteerd.`;

    } catch (error) {
      message.textContent = error.message;
    } finally {
      sending = false;
      render();
    }
  }

  async function start() {
    await loadMedia();

    db.channel('controller-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'broadcast_state',
          filter: 'id=eq.1'
        },
        payload => {
          const file = payload.new.command_id;

          if (getMedia(file)) {
            updateCurrent(file);
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          loadCurrentState();
        } else if (status === 'CHANNEL_ERROR') {
          setConnection(false, 'Verbindingsfout');
        }
      });
  }

  start();
})();
