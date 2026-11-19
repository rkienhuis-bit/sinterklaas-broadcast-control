
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const { pin } = req.body || {};

  if (!process.env.CONTROLLER_PIN ||
      pin !== process.env.CONTROLLER_PIN) {
    return res.status(401).json({
      error: 'Onjuiste regiecode'
    });
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
      'https://app.yodeck.com/api/v2/screens',
      {
        method: 'GET',
        headers: {
          Authorization: `Token ${label}:${token}`,
          Accept: 'application/json'
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error(
        'Yodeck API error:',
        response.status,
        text
      );

      return res.status(502).json({
        error: 'Yodeck API heeft de aanvraag geweigerd',
        upstream_status: response.status
      });
    }

    const data = JSON.parse(text);

    const screens = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
        ? data.results
        : Array.isArray(data.data)
          ? data.data
          : [];

    return res.status(200).json({
      ok: true,
      screen_count: screens.length,
      screens: screens.map(screen => ({
        id: screen.id ?? screen.uuid ?? screen.pk ?? null,
        name: screen.name ?? screen.screen_name ?? null,
        status: screen.status ?? null,
        is_online: screen.is_online ?? screen.online ?? null
      })),
      response_keys: Object.keys(data)
    });

  } catch (error) {
    console.error('Yodeck connection error:', error);

    return res.status(500).json({
      error: 'Verbinding met Yodeck is mislukt'
    });
  }
};
