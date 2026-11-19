
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

  const headers = {
    Authorization: `Token ${label}:${token}`,
    Accept: 'application/json'
  };

  async function get(path) {
    const response = await fetch(
      `https://app.yodeck.com/api/v2/${path}`,
      { headers }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`${path}: HTTP ${response.status}`);
    }

    return data;
  }

  try {
    const [screen, fireplace, special] = await Promise.all([
      get('screens/846282'),
      get('media/38175759'),
      get('media/38446721')
    ]);

    return res.status(200).json({
      ok: true,

      screen: {
        id: screen.id,
        name: screen.name,
        screen_content: screen.screen_content
      },

      media: [
        {
          id: fireplace.id,
          name: fireplace.name,
          media_origin: fireplace.media_origin,
          default_duration: fireplace.default_duration,
          arguments_keys: Object.keys(fireplace.arguments || {}),
          arguments: fireplace.arguments || {}
        },
        {
          id: special.id,
          name: special.name,
          media_origin: special.media_origin,
          default_duration: special.default_duration,
          arguments_keys: Object.keys(special.arguments || {}),
          arguments: special.arguments || {}
        }
      ]
    });

  } catch (error) {
    console.error('Yodeck details error:', error);

    return res.status(502).json({
      error: 'Yodeck details ophalen mislukt',
      details: error.message
    });
  }
};
