// POST /api/leads
//
// Receives the qualified-lead form (multipart/form-data) and sends a
// formatted HTML email to info@printground.net via the Resend API.
//
// Required env var: RESEND_API_KEY (from https://resend.com)
// The email is sent from onboarding@resend.dev (free tier default).
// To use your own domain, verify it in Resend and set RESEND_FROM.

var RESEND_FROM = process.env.RESEND_FROM || 'PrintGround Landing <onboarding@resend.dev>';
var RESEND_TO = process.env.RESEND_TO || 'info@printground.net';

var ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://printground.net,https://www.printground.net,https://christmas2026.printground.net,https://printground-landing.vercel.app')
  .split(',')
  .map(function (s) { return s.trim(); })
  .filter(Boolean);

var RATE_MAX = 30;
var RATE_WINDOW_MS = 10 * 60 * 1000;
var MAX_LOGO_BYTES = 10 * 1024 * 1024;
var ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'application/octet-stream', 'image/svg+xml'];

var PRODUCT_LABELS = {
  bottle: 'LANDSCAPE S — спортна бутилка 400 ml',
  meyer: 'MEYER тефтер',
  hemingway: 'HEMINGWAY A5 тефтер',
  notebookPen: 'Тефтер + химикал',
  cup: 'Брандирана чаша',
  bag: 'Брандирана торба',
  backpack: 'Брандирана раница',
  giftSet: 'Корпоративен подаръчен комплект',
  other: 'Друго'
};

var buckets = new Map();

function clientIp(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  var now = Date.now();
  if (buckets.size > 10000) {
    buckets.forEach(function (v, k) {
      if (now - v.start >= RATE_WINDOW_MS) buckets.delete(k);
    });
  }
  var bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX;
}

function originAllowed(req) {
  var origin = req.headers['origin'];
  if (!origin) return true;
  if (origin.indexOf('http://localhost:') === 0) return true;
  return ALLOWED_ORIGINS.indexOf(origin) !== -1;
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function json(res, status, obj) {
  res.status(status).json(obj);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(d) {
  var rows = '';
  function row(label, value) {
    if (!value || value === '' || value === '[]') return '';
    rows += '<tr><td style="padding:8px 12px;font-weight:600;color:#123043;border-bottom:1px solid #e0dbce;width:180px;vertical-align:top">' + esc(label) + '</td><td style="padding:8px 12px;border-bottom:1px solid #e0dbce;color:#333">' + esc(value) + '</td></tr>';
  }

  var productLabel = PRODUCT_LABELS[d.product] || d.product;
  row('Име', d.name);
  row('Фирма', d.company);
  row('Телефон', d.phone);
  row('Email', d.email);
  row('Продукт', productLabel);
  if (d.product_other) row('Друго (описание)', d.product_other);
  row('Количество', d.quantity);
  row('Предназначение', d.purpose);
  row('Краен срок', d.deadline);
  row('Бюджет', d.budget);
  row('Приоритети', d.priority);
  row('Оценка цена/бр.', d.estimated_unit_price ? d.estimated_unit_price + (d.currency === 'BGN' ? ' лв.' : ' €') : '');
  row('Оценка общо без ДДС', d.estimated_total_ex_vat ? d.estimated_total_ex_vat + (d.currency === 'BGN' ? ' лв.' : ' €') : '');
  row('Оценка общо с ДДС', d.estimated_total_inc_vat ? d.estimated_total_inc_vat + (d.currency === 'BGN' ? ' лв.' : ' €') : '');

  var utmParts = [];
  if (d.utm_source) utmParts.push('source=' + d.utm_source);
  if (d.utm_medium) utmParts.push('medium=' + d.utm_medium);
  if (d.utm_campaign) utmParts.push('campaign=' + d.utm_campaign);
  if (d.utm_content) utmParts.push('content=' + d.utm_content);
  if (d.utm_term) utmParts.push('term=' + d.utm_term);
  row('UTM', utmParts.join(', '));
  row('Страница', d.landing_page_url);
  row('Referrer', d.referrer);
  row('IP', d.client_ip);
  row('Час', d.timestamp);

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f3ee;font-family:Arial,sans-serif">' +
    '<div style="max-width:640px;margin:0 auto;padding:24px">' +
    '<div style="background:#123043;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">' +
    '<h1 style="margin:0;font-size:18px">Ново запитване от printground-landing.vercel.app</h1>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e0dbce;border-radius:0 0 8px 8px">' +
    rows +
    (d.logo_filename ? '<tr><td style="padding:8px 12px;font-weight:600;color:#123043;border-bottom:1px solid #e0dbce;width:180px;vertical-align:top">Лого</td><td style="padding:8px 12px;border-bottom:1px solid #e0dbce;color:#333">Прикачен файл: ' + esc(d.logo_filename) + ' (' + esc(d.logo_size_label) + ')</td></tr>' : '') +
    '</table>' +
    '<p style="margin-top:16px;font-size:13px;color:#888">Това запитване е изпратено автоматично от формата на сайта.</p>' +
    '</div></body></html>';
}

module.exports = async function handler(req, res) {
  if (!originAllowed(req)) return json(res, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' });

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.headers['origin']) {
    res.setHeader('Access-Control-Allow-Origin', req.headers['origin']);
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  if (rateLimited(clientIp(req))) return json(res, 429, { ok: false, error: 'RATE_LIMITED' });

  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('lead handler: RESEND_API_KEY not configured');
    return json(res, 503, { ok: false, error: 'EMAIL_SERVICE_NOT_CONFIGURED' });
  }

  var body = req.body || {};

  if (typeof body.website === 'string' && body.website.length) {
    return json(res, 200, { ok: true });
  }

  var name = typeof body.name === 'string' ? body.name.trim() : '';
  var company = typeof body.company === 'string' ? body.company.trim() : '';
  var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  var email = typeof body.email === 'string' ? body.email.trim() : '';
  var product = typeof body.product === 'string' ? body.product.trim() : '';

  if (!name || !company || !phone || !product) return json(res, 400, { ok: false, error: 'INVALID_FIELDS' });
  if (!validEmail(email)) return json(res, 400, { ok: false, error: 'INVALID_EMAIL' });

  var purposeArr = [];
  if (Array.isArray(body.purpose)) {
    purposeArr = body.purpose.filter(function (v) { return typeof v === 'string' && v.length; });
  } else if (typeof body.purpose === 'string' && body.purpose.length) {
    purposeArr = [body.purpose];
  }

  var priorityArr = [];
  if (Array.isArray(body.priority)) {
    priorityArr = body.priority.filter(function (v) { return typeof v === 'string' && v.length; });
  } else if (typeof body.priority === 'string' && body.priority.length) {
    priorityArr = [body.priority];
  }

  var logo = null;
  var logoData = null;
  var logoContentType = null;
  var logoFilename = null;
  var logoSizeLabel = '';

  if (Array.isArray(body.logo) && body.logo[0] && body.logo[0].data) {
    var buf = typeof body.logo[0].data === 'string'
      ? Buffer.from(body.logo[0].data, 'base64')
      : Buffer.from(body.logo[0].data);
    if (buf.length > MAX_LOGO_BYTES) return json(res, 413, { ok: false, error: 'LOGO_TOO_LARGE' });
    var ctype = (body.logo[0].contentType || 'application/octet-stream').toLowerCase();
    if (ALLOWED_LOGO_TYPES.indexOf(ctype) === -1) return json(res, 400, { ok: false, error: 'INVALID_LOGO' });
    logoData = buf;
    logoContentType = ctype;
    logoFilename = body.logo[0].filename || 'logo';
    var kb = Math.round(buf.length / 1024);
    logoSizeLabel = kb >= 1024 ? (buf.length / 1048576).toFixed(1) + ' MB' : kb + ' KB';
  }

  var d = {
    name: name,
    company: company,
    phone: phone,
    email: email,
    product: product,
    product_other: typeof body.product_other === 'string' ? body.product_other.trim() : '',
    quantity: typeof body.quantity === 'string' ? body.quantity : '',
    purpose: purposeArr.join(', '),
    deadline: typeof body.deadline === 'string' ? body.deadline : '',
    budget: typeof body.budget === 'string' ? body.budget : '',
    priority: priorityArr.join(', '),
    estimated_unit_price: typeof body.estimated_unit_price === 'string' ? body.estimated_unit_price : '',
    estimated_total_ex_vat: typeof body.estimated_total_ex_vat === 'string' ? body.estimated_total_ex_vat : '',
    estimated_total_inc_vat: typeof body.estimated_total_inc_vat === 'string' ? body.estimated_total_inc_vat : '',
    utm_source: typeof body.utm_source === 'string' ? body.utm_source : '',
    utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium : '',
    utm_campaign: typeof body.utm_campaign === 'string' ? body.utm_campaign : '',
    utm_content: typeof body.utm_content === 'string' ? body.utm_content : '',
    utm_term: typeof body.utm_term === 'string' ? body.utm_term : '',
    landing_page_url: typeof body.landing_page_url === 'string' ? body.landing_page_url : '',
    referrer: typeof body.referrer === 'string' ? body.referrer : '',
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
    client_ip: clientIp(req),
    logo_filename: logoFilename,
    logo_size_label: logoSizeLabel
  };

  var subject = 'Ново запитване: ' + (PRODUCT_LABELS[product] || product) + ' — ' + name + ', ' + company;

  var payload = {
    from: RESEND_FROM,
    to: [RESEND_TO],
    reply_to: email,
    subject: subject,
    html: buildEmailHtml(d)
  };

  if (logoData && logoFilename) {
    payload.attachments = [{
      filename: logoFilename,
      content: logoData.toString('base64')
    }];
  }

  var attempts = 0;
  var lastError = '';
  var lastStatus = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      var resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (resp.ok) return json(res, 200, { ok: true });
      lastStatus = resp.status;
      lastError = await resp.text().catch(function () { return ''; });
    } catch (err) {
      lastError = String((err && err.message) || err);
    }
    if (attempts < 2) await new Promise(function (r) { setTimeout(r, 250); });
  }

  console.error('lead handler: resend failed status=' + lastStatus + ' error=' + lastError);
  return json(res, 502, { ok: false, error: 'EMAIL_SEND_FAILED', status: lastStatus });
};
