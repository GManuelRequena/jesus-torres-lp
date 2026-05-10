// Netlify Function: /netlify/functions/admin-users
// Gestiona alumnos vía Netlify Identity admin API.
// Requiere Authorization: Bearer <JWT con rol admin>
//
// GET  → lista todos los usuarios
// POST → invita nuevo alumno (email + full_name)
// PUT  → actualiza app_metadata de un alumno (id + campos)

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function parseJWT(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return JSON.parse(Buffer.from(authHeader.slice(7).split('.')[1], 'base64url').toString());
  } catch { return null; }
}

function getUser(event, context) {
  return context.clientContext?.user || parseJWT(event.headers['authorization']);
}

function getIdentity(context, event) {
  const cc = context.clientContext;
  if (cc?.identity?.url && cc?.identity?.token) {
    return { url: cc.identity.url, token: cc.identity.token };
  }
  // Fallback para local (netlify dev): usar API token del CLI + URL del sitio
  const apiToken = process.env.NETLIFY_API_ACCESS_TOKEN;
  const siteUrl  = process.env.URL || 'https://entrenadorjesustorres.netlify.app';
  if (apiToken) return { url: `${siteUrl}/.netlify/identity`, token: apiToken };
  return null;
}

function isAdmin(user) {
  const roles = user?.app_metadata?.roles || [];
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
  const user = getUser(event, context);
  if (!user) return { statusCode: 401, body: 'Unauthorized' };
  if (!isAdmin(user)) return { statusCode: 403, body: 'Forbidden' };

  const identity = getIdentity(context, event);
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
    if (!event.body) return { statusCode: 400, body: 'Body requerido' };
    let payload;
    try { payload = JSON.parse(event.body); } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { email, full_name } = payload;
    if (!email) return { statusCode: 400, body: 'email requerido' };

    // Paso 1: enviar invite email via /invite (no /admin/users)
    // POST /admin/users con send_invite:true NO envía el email en Netlify Identity.
    // El endpoint correcto es /invite, que no admite app_metadata.
    const inviteRes = await fetch(`${identity.url}/invite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${identity.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        data: { full_name: full_name || '' },
      }),
    });

    if (!inviteRes.ok) {
      return { statusCode: inviteRes.status, body: await inviteRes.text() };
    }

    const invitedUser = await inviteRes.json();

    // Paso 2: asignar rol alumno en app_metadata
    const metaRes = await idFetch(identity, `users/${invitedUser.id}`, 'PUT', {
      app_metadata: { roles: ['alumno'] },
    });

    if (!metaRes.ok) return { statusCode: metaRes.status, body: metaRes.text };
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(invitedUser) };
  }

  // ── PUT: actualizar app_metadata de un alumno ─────────────────────────────
  if (event.httpMethod === 'PUT') {
    if (!event.body) return { statusCode: 400, body: 'Body requerido' };
    let payload;
    try { payload = JSON.parse(event.body); } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { id, docId, patologias, peso, servicio, objetivo, notas, historialPeso, archivado } = payload;
    if (!id) return { statusCode: 400, body: 'id requerido' };

    // Leer app_metadata actual para no pisar roles ni otros campos
    const userRes = await idFetch(identity, `users/${id}`);
    if (!userRes.ok) return { statusCode: userRes.status, body: userRes.text };

    const existingMeta = JSON.parse(userRes.text).app_metadata || {};
    const updatedMeta = {
      ...existingMeta,
      ...(docId         !== undefined && { docId }),
      ...(patologias    !== undefined && { patologias }),
      ...(peso          !== undefined && { peso }),
      ...(servicio      !== undefined && { servicio }),
      ...(objetivo      !== undefined && { objetivo }),
      ...(notas         !== undefined && { notas }),
      ...(historialPeso !== undefined && { historialPeso }),
      ...(archivado     !== undefined && { archivado }),
    };

    // Al archivar/reactivar, sincronizar el rol alumno
    if (archivado === true) {
      updatedMeta.roles = (existingMeta.roles || []).filter(r => r !== 'alumno');
    } else if (archivado === false) {
      const roles = existingMeta.roles || [];
      if (!roles.includes('alumno')) updatedMeta.roles = [...roles, 'alumno'];
    }

    const r = await idFetch(identity, `users/${id}`, 'PUT', {
      app_metadata: updatedMeta,
    });

    if (!r.ok) return { statusCode: r.status, body: r.text };
    return { statusCode: 200, headers: JSON_HEADERS, body: r.text };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
