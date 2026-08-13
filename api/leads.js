// POST /api/leads
//
// Serverless proxy for the qualified-lead form on the static landing page.
//
// The real destination is NOT hardcoded. It must be provided as the
// LEAD_ENDPOINT environment variable (Vercel project settings -> Environment
// Variables). When LEAD_ENDPOINT is missing, this function returns 503 and the
// frontend shows the error state - never a fake success.
//
// Expected request: multipart/form-data (includes the optional logo file).
// The function re-forwards the same multipart payload to LEAD_ENDPOINT, so the
// destination should accept multipart/form-data with the fields listed below.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  var endpoint = process.env.LEAD_ENDPOINT;
  if (!endpoint) {
    return res.status(503).json({
      ok: false,
      error: 'LEAD_ENDPOINT_NOT_CONFIGURED',
      message: 'LEAD_ENDPOINT environment variable is not set.'
    });
  }

  try {
    var body = req.body || {};
    var out = new FormData();

    var singleFields = [
      'name', 'company', 'phone', 'email',
      'product', 'quantity', 'budget', 'deadline',
      'estimated_unit_price', 'estimated_total_ex_vat', 'estimated_total_inc_vat',
      'source', 'campaign',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'landing_page_url', 'referrer', 'timestamp'
    ];

    singleFields.forEach(function (k) {
      if (typeof body[k] === 'string' && body[k].length) out.append(k, body[k]);
    });

    ['purpose', 'priority'].forEach(function (k) {
      if (Array.isArray(body[k])) {
        body[k].forEach(function (v) { if (typeof v === 'string' && v.length) out.append(k, v); });
      } else if (typeof body[k] === 'string' && body[k].length) {
        out.append(k, body[k]);
      }
    });

    var logo = body.logo;
    if (Array.isArray(logo) && logo[0] && logo[0].data) {
      var buf = typeof logo[0].data === 'string'
        ? Buffer.from(logo[0].data, 'base64')
        : Buffer.from(logo[0].data);
      out.append('logo', new Blob([buf], { type: logo[0].contentType || 'application/octet-stream' }), logo[0].filename || 'logo');
    }

    var resp = await fetch(endpoint, { method: 'POST', body: out, headers: { 'Accept': 'application/json' } });

    if (!resp.ok) {
      var detail = await resp.text().catch(function () { return ''; });
      return res.status(502).json({ ok: false, error: 'UPSTREAM_ERROR', status: resp.status, detail: detail.slice(0, 500) });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'PROXY_ERROR', message: String((err && err.message) || err) });
  }
};
