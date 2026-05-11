// API Route: POST /api/extraer-factura
// Recibe un archivo en base64, lo envía a Claude API con visión
// y devuelve los datos estructurados de la factura
//
// SEGURIDAD: esta ruta llama a la API de Anthropic desde el servidor.
// La API key NUNCA se expone al frontend.

import Anthropic from '@anthropic-ai/sdk';

// Deshabilitar el body parser de Next.js para este route
// (recibimos JSON con base64, así que lo re-habilitamos)
export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un asistente especializado en extracción de datos de facturas españolas.
Analiza la imagen o documento proporcionado y extrae EXACTAMENTE los siguientes campos.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin explicaciones.`;

const USER_PROMPT = `Extrae los datos de esta factura y devuelve un JSON con exactamente esta estructura:
{
  "fecha_factura": "YYYY-MM-DD",
  "proveedor": "Nombre completo del emisor/proveedor",
  "numero_factura": "Número de factura tal como aparece",
  "base_imponible": número_decimal,
  "iva_porcentaje": número_decimal,
  "iva_importe": número_decimal,
  "total": número_decimal
}

Reglas:
- fecha_factura: formato ISO 8601 (YYYY-MM-DD). Si no aparece fecha, usa null.
- base_imponible, iva_importe, total: números decimales sin símbolo de moneda.
- iva_porcentaje: el porcentaje como número (ej: 21, 10, 4).
- Si algún campo no se puede determinar, usa null.
- Si hay múltiples tipos de IVA, usa el mayoritario o el del total.
- SOLO devuelve el JSON, nada más.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { base64, mimeType, nombre } = req.body;

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Faltan los campos base64 y mimeType' });
  }

  // Tipos soportados por Claude vision
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!tiposPermitidos.includes(mimeType)) {
    return res.status(400).json({ error: `Tipo de archivo no soportado: ${mimeType}` });
  }

  try {
    let content;

    if (mimeType === 'application/pdf') {
      // PDFs: usar tipo document de Claude
      content = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        },
        { type: 'text', text: USER_PROMPT },
      ];
    } else {
      // Imágenes: usar tipo image
      content = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
        { type: 'text', text: USER_PROMPT },
      ];
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const rawText = message.content[0]?.text || '';

    // Limpiar posible markdown code block
    const jsonText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let datos;
    try {
      datos = JSON.parse(jsonText);
    } catch {
      console.error('Claude devolvió JSON inválido:', rawText);
      return res.status(422).json({ error: 'La IA no pudo extraer datos válidos del documento', raw: rawText });
    }

    // Sanitizar y devolver
    return res.status(200).json({
      fecha_factura:  datos.fecha_factura  || null,
      proveedor:      datos.proveedor      || '',
      numero_factura: datos.numero_factura || '',
      base_imponible: typeof datos.base_imponible === 'number' ? datos.base_imponible : null,
      iva_porcentaje: typeof datos.iva_porcentaje === 'number' ? datos.iva_porcentaje : 21,
      iva_importe:    typeof datos.iva_importe    === 'number' ? datos.iva_importe    : null,
      total:          typeof datos.total          === 'number' ? datos.total          : null,
    });

  } catch (err) {
    console.error('[extraer-factura] Error:', err);
    const statusCode = err.status || 500;
    return res.status(statusCode).json({ error: err.message || 'Error interno del servidor' });
  }
}
