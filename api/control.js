
const mediaItems = require('../media.json');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const { pin, media } = req.body || {};

  if (
    !process.env.CONTROLLER_PIN ||
    pin !== process.env.CONTROLLER_PIN
  ) {
    return res.status(401).json({
      error: 'Onjuiste regiecode'
    });
  }

  const selected = mediaItems.find(item =>
    item.file === media &&
    ['image', 'video'].includes(item.type)
  );

  if (!selected) {
    return res.status(400).json({
      error: 'Deze content bestaat niet in de medialijst.'
    });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    return res.status(500).json({
      error: 'Serverconfiguratie ontbreekt.'
    });
  }

  try {
    const response = await fetch(
      `${base.replace(/\/$/, '')}/rest/v1/broadcast_state?id=eq.1`,
      {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          mode: selected.type,
          command_id: selected.file,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase update error:', error);

      return res.status(502).json({
        error: 'Supabase kon de opdracht niet opslaan.'
      });
    }

    return res.status(200).json({
      ok: true,
      media: selected.file,
      name: selected.name
    });

  } catch (error) {
    console.error('Control API error:', error);

    return res.status(500).json({
      error: 'Er ging iets mis bij het versturen van de opdracht.'
    });
  }
};
