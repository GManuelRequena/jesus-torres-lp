// Netlify Function: /.netlify/functions/routine-save
// Solo admin. Guarda y lee rutinas en Netlify Blobs.
//
// GET  ?userId=<id>           → devuelve la rutina JSON del alumno (404 si no existe)
// PUT  { userId, routine }    → guarda/sobreescribe la rutina del alumno

const { getStore } = require('@netlify/blobs');

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function isAdmin(context) {
  const roles = context.clientContext?.user?.app_metadata?.roles || [];
  return roles.includes('admin');
}

exports.handler = async (event, context) => {
  if (!context.clientContext?.user) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  if (!isAdmin(context)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const store = getStore('routines');

  // ── GET: leer rutina de un alumno ─────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { userId } = event.queryStringParameters || {};
    if (!userId) return { statusCode: 400, body: 'userId requerido' };

    const routine = await store.get(userId, { type: 'json' });
    if (routine === null) return { statusCode: 404, body: 'No routine found' };

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(routine) };
  }

  // ── PUT: guardar rutina de un alumno ──────────────────────────────────────
  if (event.httpMethod === 'PUT') {
    if (!event.body) return { statusCode: 400, body: 'Body requerido' };
    let payload;
    try { payload = JSON.parse(event.body); } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { userId, routine } = payload;
    if (!userId) return { statusCode: 400, body: 'userId requerido' };
    if (!routine || !Array.isArray(routine.dias)) {
      return { statusCode: 400, body: 'routine.dias requerido' };
    }

    await store.setJSON(userId, routine);
    return { statusCode: 200, headers: JSON_HEADERS, body: '{}' };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
