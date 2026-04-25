// Netlify Function: GET /.netlify/functions/routine
// Devuelve la rutina del alumno autenticado como JSON.
//
// Prioridad de resolución:
//   1. Netlify Blobs por jwtUser.sub (editor visual del admin)
//   2. app_metadata.docId del JWT → Google Docs (legacy)
//   3. ?docId= en querystring (testing directo)
//   4. ROUTINES_MAP por email (compatibilidad)

import { getStore } from '@netlify/blobs';

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

export default async (req, context) => {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const jwtUser = getUser(req, context);
  const params  = new URL(req.url).searchParams;
  const qsDocId = params.get('docId');
  const qsEmail = params.get('email');

  // ── 1. Netlify Blobs (rutinas cargadas desde el editor del admin) ──────────
  if (jwtUser?.sub) {
    try {
      const store = getStore('routines');
      const blobRoutine = await store.get(jwtUser.sub, { type: 'json' });
      if (blobRoutine !== null) {
        return new Response(JSON.stringify(blobRoutine), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        });
      }
    } catch (_) {
      // Si Blobs falla, continuar con el fallback
    }
  }

  // ── 2-4. Fallback: Google Docs (alumnos legacy con docId) ─────────────────

  let resolvedDocId = jwtUser?.app_metadata?.docId || null;

  if (!resolvedDocId && qsDocId) resolvedDocId = qsDocId;

  if (!resolvedDocId) {
    const email = jwtUser?.email || qsEmail;
    if (email) {
      try {
        const map = JSON.parse(process.env.ROUTINES_MAP || '{}');
        resolvedDocId = map[email] || null;
      } catch {
        return new Response('Invalid ROUTINES_MAP config', { status: 500 });
      }
    }
  }

  if (!resolvedDocId) {
    return new Response('No routine found', { status: 404 });
  }

  let html;
  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${resolvedDocId}/export?format=html`
    );
    if (!res.ok) {
      return new Response(`Google Docs error: ${res.status}`, { status: 502 });
    }
    html = await res.text();
  } catch (err) {
    return new Response(`Fetch failed: ${err.message}`, { status: 502 });
  }

  const routine = parseRoutine(html);

  return new Response(JSON.stringify(routine), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};

// ── HTML → plain text ─────────────────────────────────────────────────────────

function htmlToLines(html) {
  const decoded = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&[Aa]acute;/g, 'á')
    .replace(/&[Ee]acute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&[Oo]acute;/g, 'ó')
    .replace(/&[Uu]acute;/g, 'ú')
    .replace(/&[Nn]tilde;/g, 'ñ')
    .replace(/&[Uu]uml;/g, 'ü')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&#\d+;/g, '');

  return decoded.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

// ── Main parser ───────────────────────────────────────────────────────────────

function parseRoutine(html) {
  const lines = htmlToLines(html);

  const dias = [
    { label: 'Día 1', movilidad: [], calor: [], principal: [] },
    { label: 'Día 2', movilidad: [], calor: [], principal: [] },
    { label: 'Día 3', movilidad: [], calor: [], principal: [] },
  ];
  const periodizacion = [];

  let section = null;
  let diaIdx  = -1;

  for (const line of lines) {
    if (/==\s*MOVILIDAD/i.test(line))        { section = 'movilidad';  diaIdx = -1; continue; }
    if (/==\s*ENTRADA/i.test(line))          { section = 'calor';      diaIdx = -1; continue; }
    if (/==\s*PARTE\s+PRINCIPAL/i.test(line)){ section = 'principal';  diaIdx = -1; continue; }
    if (/==\s*PERIODIZACI/i.test(line)) {
      section = 'periodizacion';
      extractPeriodLines(line, periodizacion);
      continue;
    }

    const diaMatch = /^d[ií]a\s*(\d+)/i.exec(line);
    if (diaMatch) { diaIdx = parseInt(diaMatch[1], 10) - 1; continue; }

    if (!section) continue;

    if (section === 'periodizacion') { extractPeriodLines(line, periodizacion); continue; }

    if (diaIdx < 0 || diaIdx > 2) continue;
    const dia = dias[diaIdx];

    if (section === 'movilidad') {
      const clean   = line.replace(/^[-•]\s*/, '');
      const ytMatch = /(https?:\/\/\S+)/.exec(clean);
      const nombre  = clean.replace(ytMatch ? ytMatch[0] : '', '').replace(/:\s*$/, '').trim();
      if (nombre) dia.movilidad.push({ nombre, youtubeUrl: ytMatch ? ytMatch[1] : null });
      continue;
    }

    if (section === 'calor') {
      const nombre = line.replace(/^[-•]\s*/, '').trim();
      if (nombre) dia.calor.push({ nombre });
      continue;
    }

    if (section === 'principal') {
      if (!line.includes('|')) continue;
      const ex = parsePrincipalLine(line, dia.principal.length + 1);
      if (ex) dia.principal.push(ex);
    }
  }

  return { dias, periodizacion };
}

// ── Parte principal: "Nombre | NxN | peso" ───────────────────────────────────

function parsePrincipalLine(line, num) {
  const clean  = line.replace(/^\d+\.\s*/, '').trim();
  const parts  = clean.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const serepRe  = /^(\d+)\s*[xX×]\s*(\d+)(["""]?)\s*(por\s+lado|pasos)?$/i;
  const pesoRe   = /^(\d+(?:[.,]\d+)?)\s*(kg|lingotes?)$/i;
  const ytRe     = /^https?:\/\/\S+/;

  let nombre = null, series = null, reps = null, unidad = 'reps';
  let nota = null, peso = null, pesoUnidad = null, youtubeUrl = null;

  for (const part of parts) {
    if (ytRe.test(part)) { youtubeUrl = part; continue; }
    const sRep = serepRe.exec(part);
    if (sRep) {
      series = parseInt(sRep[1], 10);
      reps   = parseInt(sRep[2], 10);
      unidad = /["""]/.test(sRep[3]) ? 'seg' : 'reps';
      nota   = sRep[4]?.trim() || null;
      continue;
    }
    const spes = pesoRe.exec(part);
    if (spes) {
      peso       = parseFloat(spes[1].replace(',', '.'));
      pesoUnidad = /kg/i.test(spes[2]) ? 'kg' : 'lingotes';
      continue;
    }
    if (!nombre) nombre = part;
  }

  if (!nombre || series === null) return null;
  return { num, nombre, series, reps, unidad, peso, pesoUnidad, nota, youtubeUrl };
}

// ── Periodización ─────────────────────────────────────────────────────────────

function extractPeriodLines(text, output) {
  const re = /sem(?:ana)?\s+(\d+)\s*:\s*([^]*?)(?=\s*sem(?:ana)?\s+\d+\s*:|$)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const desc = match[2].trim();
    if (desc) output.push({ semana: parseInt(match[1], 10), descripcion: desc });
  }
}
