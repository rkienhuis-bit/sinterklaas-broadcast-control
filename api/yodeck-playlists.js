
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin } = req.body || {};

  if (!process.env.CONTROLLER_PIN ||
      pin !== process.env.CONTROLLER_PIN) {
    return res.status(401).json({ error: 'Onjuiste regiecode' });
  }

  const token = process.env.YODECK_API_TOKEN;
  const label = process.env.YODECK_API_LABEL;

  if (!token || !label) {
    return res.status(500).json({
      error: 'Yodeck API-configuratie ontbreekt'
    });
  }

  try {
    const response = await fetch(
      'https://app.yodeck.com/api/v2/playlists?q=test&limit=100',
      {
        headers: {
          Authorization: `Token ${label}:${token}`,
          Accept: 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: 'Yodeck API-fout',
        status: response.status
      });
    }

    return res.status(200).json({
      ok: true,
      count: data.count,
      playlists: (data.results || []).map(p => ({
        id: p.id,
        name: p.name
      }))
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Verbinding mislukt'
    });
  }
};
