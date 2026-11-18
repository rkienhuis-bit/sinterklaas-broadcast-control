
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin, mode } = req.body || {};

  if (!process.env.CONTROLLER_PIN ||
      pin !== process.env.CONTROLLER_PIN) {
    return res.status(401).json({ error: 'Onjuiste regiecode' });
  }

  if (!['special', 'fireplace', 'audio'].includes(mode)) {
    return res.status(400).json({ error: 'Ongeldige opdracht' });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    return res.status(500).json({
      error: 'Serverconfiguratie ontbreekt'
    });
  }

  const update = {
    command_id: `${mode}-${Date.now()}`,
    updated_at: new Date().toISOString()
  };

  // Alleen bij video-opdrachten de videomodus aanpassen.
  if (mode !== 'audio') {
    update.mode = mode;
  }

  const response = await fetch(
    `${base}/rest/v1/broadcast_state?id=eq.1`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(update)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Supabase update error:', error);

    return res.status(502).json({
      error: 'Supabase kon de opdracht niet opslaan',
      details: error
    });
  }

  return res.status(200).json({ ok: true });
};
