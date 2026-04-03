// Netlify Function: GET /.netlify/functions/routine?docId=<googleDocId>
// Fetches the exported HTML of a Google Doc written in the standard template
// and returns a parsed routine JSON.
//
// Expected doc format:
//   == MOVILIDAD ARTICULAR ==
//   DÍA 1
//   - Nombre: https://youtube.com/...
//   ...
//   == ENTRADA EN CALOR ==
//   DÍA 1
//   - Ejercicio
//   ...
//   == PARTE PRINCIPAL ==
//   DÍA 1
//   1. Nombre | NxN | peso
//   ...
//   == PERIODIZACIÓN ==
//   Sem 1: descripción
//   ...

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const docId = event.queryStringParameters?.docId;
  if (!docId) {
    return { statusCode: 400, body: 'Missing docId' };
  }

  let html;
  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${docId}/export?format=html`
    );
    if (!res.ok) {
      return { statusCode: 502, body: `Google Docs error: ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    return { statusCode: 502, body: `Fetch failed: ${err.message}` };
  }

  const routine = parseRoutine(html);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify(routine),
  };
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
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&[Aa]acute;/g, 'á')
    .replace(/&[Ee]acute;/g, 'é')
    .replace(/&[Ii]acute;/g, 'í')
    .replace(/&[Oo]acute;/g, 'ó')
    .replace(/&[Uu]acute;/g, 'ú')
    .replace(/&[Nn]tilde;/g, 'ñ')
    .replace(/&[Uu]uml;/g, 'ü')
    .replace(/&[Ii]acute;/g, 'Í')
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
    // ── Section headings ───────────────────────────────────────────────────
    if (/==\s*MOVILIDAD/i.test(line))        { section = 'movilidad';  diaIdx = -1; continue; }
    if (/==\s*ENTRADA/i.test(line))          { section = 'calor';      diaIdx = -1; continue; }
    if (/==\s*PARTE\s+PRINCIPAL/i.test(line)){ section = 'principal';  diaIdx = -1; continue; }
    if (/==\s*PERIODIZACI/i.test(line)) {
      section = 'periodizacion';
      // Periodización may be inline on the same line as the heading
      extractPeriodLines(line, periodizacion);
      continue;
    }

    // ── Day headings ───────────────────────────────────────────────────────
    const diaMatch = /^d[ií]a\s*(\d+)/i.exec(line);
    if (diaMatch) {
      diaIdx = parseInt(diaMatch[1], 10) - 1;
      continue;
    }

    if (!section) continue;

    // ── Periodización (standalone lines) ──────────────────────────────────
    if (section === 'periodizacion') {
      extractPeriodLines(line, periodizacion);
      continue;
    }

    if (diaIdx < 0 || diaIdx > 2) continue;
    const dia = dias[diaIdx];

    // ── Movilidad ─────────────────────────────────────────────────────────
    if (section === 'movilidad') {
      const clean    = line.replace(/^[-•]\s*/, '');
      const ytMatch  = /(https?:\/\/\S+)/.exec(clean);
      const nombre   = clean.replace(ytMatch ? ytMatch[0] : '', '').replace(/:\s*$/, '').trim();
      if (nombre) {
        dia.movilidad.push({ nombre, youtubeUrl: ytMatch ? ytMatch[1] : null });
      }
      continue;
    }

    // ── Entrada en calor ──────────────────────────────────────────────────
    if (section === 'calor') {
      const nombre = line.replace(/^[-•]\s*/, '').trim();
      if (nombre) dia.calor.push({ nombre });
      continue;
    }

    // ── Parte principal ───────────────────────────────────────────────────
    if (section === 'principal') {
      if (!line.includes('|')) continue; // skip non-exercise lines
      const ex = parsePrincipalLine(line, dia.principal.length + 1);
      if (ex) dia.principal.push(ex);
    }
  }

  return { dias, periodizacion };
}

// ── Parte principal: "Nombre | NxN | peso" ───────────────────────────────────
// Parts are separated by | in any order.

function parsePrincipalLine(line, num) {
  // Strip leading "N. " if present (Google Docs may preserve or strip numbering)
  const clean = line.replace(/^\d+\.\s*/, '').trim();
  const parts = clean.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  // Identify each part by content
  const serepRe  = /^(\d+)\s*[xX×]\s*(\d+)(["""]?)\s*(por\s+lado|pasos)?$/i;
  const pesoRe   = /^(\d+(?:[.,]\d+)?)\s*(kg|lingotes?)$/i;

  let nombre = null;
  let series = null;
  let reps   = null;
  let unidad = 'reps';
  let nota   = null;
  let peso   = null;
  let pesoUnidad = null;

  for (const part of parts) {
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
      peso      = parseFloat(spes[1].replace(',', '.'));
      pesoUnidad = /kg/i.test(spes[2]) ? 'kg' : 'lingotes';
      continue;
    }
    // Anything else is the exercise name (first unmatched part)
    if (!nombre) nombre = part;
  }

  if (!nombre || series === null) return null;
  return { num, nombre, series, reps, unidad, peso, pesoUnidad, nota };
}

// ── Periodización ─────────────────────────────────────────────────────────────
// Handles "Sem 1: descripción" lines, or all on one line.

function extractPeriodLines(text, output) {
  // Split on "Sem N:" boundaries
  const re = /sem(?:ana)?\s+(\d+)\s*:\s*([^]*?)(?=\s*sem(?:ana)?\s+\d+\s*:|$)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const desc = match[2].trim();
    if (desc) {
      output.push({ semana: parseInt(match[1], 10), descripcion: desc });
    }
  }
}
