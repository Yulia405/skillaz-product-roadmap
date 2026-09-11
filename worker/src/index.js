const ALLOWED_ORIGINS = new Set([
  'https://yulia405.github.io',
  'http://127.0.0.1:8770',
  'http://localhost:8770',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://yulia405.github.io',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

async function createSession(secret) {
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  return `${expiresAt}.${await sign(String(expiresAt), secret)}`;
}

async function validSession(request, secret) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature || Number(expiresAt) < Date.now()) return false;
  return signature === await sign(expiresAt, secret);
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
    if (!originAllowed(request)) return json(request, { error: 'Источник запроса не разрешён' }, 403);

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/roadmap') {
      const stored = await env.ROADMAP_STATE.get('current');
      if (!stored) return json(request, { configured: false }, 404);
      return new Response(stored, {
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/auth') {
      const body = await request.json().catch(() => ({}));
      if (!body.password || body.password !== env.ADMIN_PASSWORD) {
        return json(request, { error: 'Неверный пароль' }, 401);
      }
      return json(request, { token: await createSession(env.SESSION_SECRET) });
    }

    if (request.method === 'PUT' && url.pathname === '/roadmap') {
      if (!await validSession(request, env.SESSION_SECRET)) {
        return json(request, { error: 'Сессия завершена. Введите пароль ещё раз' }, 401);
      }
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object' || !body.overrides || !Array.isArray(body.promo) || !Array.isArray(body.methodology) || !Array.isArray(body.discovery)) {
        return json(request, { error: 'Некорректные данные плана' }, 400);
      }
      const payload = JSON.stringify({
        updatedAt: new Date().toISOString(),
        overrides: body.overrides,
        promo: body.promo,
        methodology: body.methodology,
        discovery: body.discovery,
      });
      if (payload.length > 250000) return json(request, { error: 'Слишком большой объём данных' }, 413);
      await env.ROADMAP_STATE.put('current', payload);
      return new Response(payload, {
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    return json(request, { error: 'Не найдено' }, 404);
  },
};
