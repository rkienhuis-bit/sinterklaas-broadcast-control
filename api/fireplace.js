
const { Readable } = require('node:stream');

const DROPBOX_URL =
  'https://www.dropbox.com/scl/fi/bm5roqgc0k00ryrh9bojs/fireplace.ts?rlkey=0s4m8pwwsa1ylyhoib39jl4m9&st=c8md6uvl&raw=1';

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).end('Method not allowed');
  }

  try {
    const headers = {};
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const upstream = await fetch(DROPBOX_URL, {
      method: req.method,
      headers
    });

    res.statusCode = upstream.status;

    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges'
    ]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'HEAD' || !upstream.body) {
      return res.end();
    }

    if (req.headers.range && upstream.status !== 206) {
      return res.status(502).end('Dropbox did not return a partial response');
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('Fireplace proxy error:', error);
    if (!res.headersSent) {
      res.status(502).end('Unable to retrieve fireplace video');
    } else {
      res.destroy(error);
    }
  }
};
