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
    let response;
    let fetchError = null;
    const fetchTimeoutMs = 5000; // 5 segundos
    try {
      // Implementar timeout manual usando Promise.race
      const controller = new (require('abort-controller'))();
      const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
      response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      // Verificar si la solicitud fue exitosa
      if (!response.ok) {
        throw new Error(`Error al obtener la imagen: ${response.statusText}`);
      }
    } catch (err) {
      fetchError = err;
    }

    let contentType, buffer;
    if (!fetchError && response) {
      // Obtener el tipo de contenido y los bytes de la imagen
      contentType = response.headers.get('content-type');
      buffer = await response.buffer();
    } else {
      // Si fetch falla, intentar leer la imagen local
      const fs = require('fs').promises;
      const path = require('path');
      let triedDefault = false;
      try {
        if (fetchError && fetchError.name === 'AbortError') {
          // Si es un error de timeout, ir directo a default.jpg
          triedDefault = true;
          const defaultImagePath = path.join(__dirname, 'images', 'default.jpg');
          buffer = await fs.readFile(defaultImagePath);
          contentType = 'image/jpeg';
        } else {
          const imagePath = path.join(__dirname, 'images', `${ip}.jpg`);
          buffer = await fs.readFile(imagePath);
          contentType = 'image/jpeg';
        }
      } catch (localErr) {
        // Si tampoco se encuentra la imagen local, intentar con default.jpg (si no se intentó ya)
        if (!triedDefault) {
          try {
            const defaultImagePath = path.join(__dirname, 'images', 'default.jpg');
            buffer = await fs.readFile(defaultImagePath);
            contentType = 'image/jpeg';
          } catch (defaultErr) {
            // Si tampoco se encuentra la imagen default, lanzar error
            throw new Error(`No se pudo recuperar la imagen ni remotamente, ni localmente, ni la imagen por defecto: ${fetchError ? fetchError.message : ''} / ${localErr.message} / ${defaultErr.message}`);
          }
        } else {
          throw new Error(`No se pudo recuperar la imagen ni remotamente, ni la imagen por defecto: ${fetchError ? fetchError.message : ''} / ${localErr.message}`);
        }
      }
    }

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
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error en el proxy: ${error.message}` })
    };
  }
};