const fetch = require('node-fetch');

exports.handler = async function(event, context) {
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
    // Realizar la solicitud a la URL de la imagen
    const response = await fetch(url);
    
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