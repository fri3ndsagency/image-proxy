const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  // Obtener la URL de la imagen desde los parámetros de consulta
  const { url } = event.queryStringParameters || {};

  // Verificar si se proporcionó una URL
  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Se requiere el parámetro URL' })
    };
  }

  try {
    // Leer variables de entorno
    const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER;
    const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS;
    const BASIC_AUTH_IPS = (process.env.BASIC_AUTH_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);

    // Obtener la IP de destino de la URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const dns = require('dns').promises;
    let ip;
    try {
      const addresses = await dns.lookup(hostname);
      ip = addresses.address;
    } catch (e) {
      ip = null;
    }

    // Construir encabezados para la solicitud
    const headers = {};
    // Agregar autenticación básica solo si la IP está en la lista
    if (ip && BASIC_AUTH_IPS.includes(ip) && BASIC_AUTH_USER && BASIC_AUTH_PASS) {
      const basicAuth = Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    // Realizar la solicitud a la URL de la imagen con encabezados
    const response = await fetch(url, { headers });

    // Verificar si la solicitud fue exitosa
    if (!response.ok) {
      throw new Error(`Error al obtener la imagen: ${response.statusText}`);
    }

    // Obtener el tipo de contenido y los bytes de la imagen
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();

    // Devolver la imagen con los encabezados adecuados
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=60', // Caché de 1 minuto
        'Access-Control-Allow-Origin': '*' // Permitir CORS
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error en el proxy: ${error.message}` })
    };
  }
};