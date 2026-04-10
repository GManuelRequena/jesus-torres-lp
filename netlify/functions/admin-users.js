// Netlify Function: /netlify/functions/admin-users
// Gestiona alumnos vía Netlify Identity admin API.
// Requiere Authorization: Bearer <JWT con rol admin>
//
// GET  → lista todos los usuarios
// POST → invita nuevo alumno (email + full_name)
// PUT  → actualiza app_metadata de un alumno (id + campos)

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function getIdentity(context) {
  const cc = context.clientContext;
  if (!cc?.identity?.url || !cc?.identity?.token) return null;
  return { url: cc.identity.url, token: cc.identity.token };
}

function isAdmin(context) {
  const roles = context.clientContext?.user?.app_metadata?.roles || [];
  return roles.includes('admin');
}

async function idFetch(identity, path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${identity.token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${identity.url}/admin/${path}`, opts);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

exports.handler = async (event, context) => {
  if (!context.clientContext?.user) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  if (!isAdmin(context)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const identity = getIdentity(context);
  if (!identity) {
    return { statusCode: 503, body: 'Identity service unavailable' };
  }

  // ── GET: listar todos los usuarios ────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const r = await idFetch(identity, 'users?per_page=100');
    if (!r.ok) return { statusCode: r.status, body: r.text };

    const data = JSON.parse(r.text);
    const users = Array.isArray(data) ? data : (data.users || []);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(users),
    };
  }

  // ── POST: invitar nuevo alumno ────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let payload;
    try { payload = JSON.parse(event.body); } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { email, full_name } = payload;
    if (!email) return { statusCode: 400, body: 'email requerido' };

    const r = await idFetch(identity, 'users', 'POST', {
      email,
      user_metadata: { full_name: full_name || '' },
      app_metadata: { roles: ['alumno'] },
      send_invite: true,
    });

    if (!r.ok) return { statusCode: r.status, body: r.text };
    return { statusCode: 200, headers: JSON_HEADERS, body: r.text };
  }

  // ── PUT: actualizar app_metadata de un alumno ─────────────────────────────
  if (event.httpMethod === 'PUT') {
    let payload;
    try { payload = JSON.parse(event.body); } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { id, docId, patologias, peso, servicio, objetivo, notas } = payload;
    if (!id) return { statusCode: 400, body: 'id requerido' };

    // Leer app_metadata actual para no pisar roles ni otros campos
    const userRes = await idFetch(identity, `users/${id}`);
    if (!userRes.ok) return { statusCode: userRes.status, body: userRes.text };

    const existingMeta = JSON.parse(userRes.text).app_metadata || {};
    const updatedMeta = {
      ...existingMeta,
      ...(docId      !== undefined && { docId }),
      ...(patologias !== undefined && { patologias }),
      ...(peso       !== undefined && { peso }),
      ...(servicio   !== undefined && { servicio }),
      ...(objetivo   !== undefined && { objetivo }),
      ...(notas      !== undefined && { notas }),
    };

    const r = await idFetch(identity, `users/${id}`, 'PUT', {
      app_metadata: updatedMeta,
    });

    if (!r.ok) return { statusCode: r.status, body: r.text };
    return { statusCode: 200, headers: JSON_HEADERS, body: r.text };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
