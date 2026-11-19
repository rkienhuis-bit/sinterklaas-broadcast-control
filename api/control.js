
const MEDIA = {
  "Padel_V2.jpg": "image",
  "Padel_V3.jpg": "image",
  "Padel_V5 (2).jpg": "image",
  "kling_20261113_VIDEO_make_a_sho_5488_0.mp4": "video"
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pin, media } = req.body || {};

  if (
    !process.env.CONTROLLER_PIN ||
    pin !== process.env.CONTROLLER_PIN
  ) {
    return res.status(401).json({ error: "Onjuiste regiecode" });
  }

  const mode = MEDIA[media];

  if (!mode) {
    return res.status(400).json({
      error: "Onbekend mediabestand"
    });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    return res.status(500).json({
      error: "Serverconfiguratie ontbreekt"
    });
  }

  const update = {
    mode,
    command_id: media,
    updated_at: new Date().toISOString()
  };

  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/rest/v1/broadcast_state?id=eq.1`,
      {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(update)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Supabase update error:", error);

      return res.status(502).json({
        error: "Supabase kon de opdracht niet opslaan"
      });
    }

    return res.status(200).json({
      ok: true,
      media,
      mode
    });

  } catch (error) {
    console.error("Control API error:", error);

    return res.status(500).json({
      error: "Interne serverfout"
    });
  }
};
