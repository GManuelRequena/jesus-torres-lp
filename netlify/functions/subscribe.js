exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let nombre, email, objetivo;
  try {
    ({ nombre, email, objetivo } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!email || !nombre) {
    return { statusCode: 400, body: 'Faltan campos requeridos' };
  }

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      email,
      attributes: { FIRSTNAME: nombre, OBJETIVO: objetivo },
      updateEnabled: true,
    }),
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    return { statusCode: 500, body: `Error Brevo: ${error}` };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
