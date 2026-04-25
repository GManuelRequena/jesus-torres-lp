import { getStore } from '@netlify/blobs';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

// En Functions v2, context.clientContext puede no estar disponible.
// Fallback: decodificar el payload del JWT del header Authorization.
function getUser(req, context) {
  if (context.clientContext?.user) return context.clientContext.user;
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
    return payload?.sub ? payload : null;
  } catch {
    return null;
  }
}

function isAdmin(user) {
  const roles = user?.app_metadata?.roles || [];
  return roles.includes('admin');
}

export default async (req, context) => {
  const user = getUser(req, context);
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const store = getStore('routines');

  // ── GET: leer rutina de un alumno ─────────────────────────────────────────
  if (req.method === 'GET') {
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return new Response('userId requerido', { status: 400 });

    const routine = await store.get(userId, { type: 'json' });
    if (routine === null) return new Response('No routine found', { status: 404 });

    return new Response(JSON.stringify(routine), { status: 200, headers: JSON_HEADERS });
  }

  // ── PUT: guardar rutina de un alumno ──────────────────────────────────────
  if (req.method === 'PUT') {
    let payload;
    try { payload = await req.json(); } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { userId, routine } = payload;
    if (!userId) return new Response('userId requerido', { status: 400 });
    if (!routine || !Array.isArray(routine.dias)) {
      return new Response('routine.dias requerido', { status: 400 });
    }

    await store.setJSON(userId, routine);
    return new Response('{}', { status: 200, headers: JSON_HEADERS });
  }

  // ── DELETE: borrar rutina del editor (vuelve a caer al Google Doc) ──────────
  if (req.method === 'DELETE') {
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return new Response('userId requerido', { status: 400 });

    await store.delete(userId);
    return new Response('{}', { status: 200, headers: JSON_HEADERS });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
