// API Route: GET /api/exportar-excel
// Genera un .xlsx con las facturas filtradas usando ExcelJS
// Parámetros opcionales: desde, hasta, empleado_id, proveedor

import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const config = { api: { bodyParser: false } };

// Colores corporativos SD
const COLOR_ROJO     = 'FFD42B2B';
const COLOR_OSCURO   = 'FF1A1A1A';
const COLOR_GRIS     = 'FF2A2A2A';
const COLOR_BLANCO   = 'FFFFFFFF';
const COLOR_GRIS_CLR = 'FFE0E0E0';
const COLOR_FILA_PAR = 'FFF5F5F5';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { desde, hasta, empleado_id, proveedor } = req.query;

  try {
    // ── 1. Obtener datos ──────────────────────────────────────
    let q = supabaseAdmin
      .from('facturas')
      .select('fecha_factura, proveedor, numero_factura, base_imponible, iva_porcentaje, iva_importe, total, empleado_nombre, created_at')
      .order('fecha_factura', { ascending: false });

    if (desde)       q = q.gte('fecha_factura', desde);
    if (hasta)       q = q.lte('fecha_factura', hasta);
    if (empleado_id) q = q.eq('empleado_id', empleado_id);
    if (proveedor)   q = q.ilike('proveedor', `%${proveedor}%`);

    const { data: facturas, error } = await q;
    if (error) throw error;

    // ── 2. Crear workbook ────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Gastos App SD';
    wb.created  = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Facturas', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
    });

    // ── 3. Fila 1: Logo / Título ─────────────────────────────
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'GESTIÓN DE FACTURAS — SD';
    titleCell.font  = { bold: true, size: 16, color: { argb: COLOR_BLANCO } };
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROJO } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    // ── 4. Fila 2: Info de exportación ───────────────────────
    ws.mergeCells('A2:I2');
    const infoCell = ws.getCell('A2');
    const periodoStr = desde || hasta
      ? `Período: ${desde || '—'} al ${hasta || '—'}`
      : 'Todas las fechas';
    infoCell.value = `Exportado: ${new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} | ${periodoStr} | ${facturas.length} facturas`;
    infoCell.font  = { size: 10, color: { argb: 'FFaaaaaa' }, italic: true };
    infoCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_OSCURO } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    // ── 5. Cabeceras ─────────────────────────────────────────
    const HEADERS = [
      { header: 'Fecha Factura',  key: 'fecha',    width: 14 },
      { header: 'Proveedor',      key: 'prov',     width: 30 },
      { header: 'Nº Factura',     key: 'num',      width: 18 },
      { header: 'Base Imponible', key: 'base',     width: 16 },
      { header: 'IVA %',          key: 'ivapct',   width: 8  },
      { header: 'Cuota IVA',      key: 'ivaimp',   width: 14 },
      { header: 'Total',          key: 'total',    width: 16 },
      { header: 'Empleado',       key: 'empleado', width: 22 },
      { header: 'Fecha Subida',   key: 'subida',   width: 16 },
    ];

    ws.columns = HEADERS.map(h => ({ key: h.key, width: h.width }));

    const headerRow = ws.getRow(3);
    HEADERS.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h.header;
      cell.font  = { bold: true, size: 11, color: { argb: COLOR_BLANCO } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLOR_ROJO } },
      };
    });
    ws.getRow(3).height = 28;

    // ── 6. Filas de datos ─────────────────────────────────────
    let totalBase = 0, totalIVAImp = 0, totalTotal = 0;

    facturas.forEach((f, idx) => {
      const row    = ws.addRow({});
      const isEven = idx % 2 === 0;
      const bgColor = isEven ? 'FFFFFFFF' : COLOR_FILA_PAR;

      // Fecha factura
      const cFecha = row.getCell(1);
      cFecha.value = f.fecha_factura ? new Date(f.fecha_factura + 'T00:00:00') : null;
      cFecha.numFmt = 'dd/mm/yyyy';

      // Proveedor
      row.getCell(2).value = f.proveedor || '';

      // Nº Factura
      const cNum = row.getCell(3);
      cNum.value = f.numero_factura || '';
      cNum.font  = { color: { argb: 'FF666666' }, italic: true };

      // Base imponible
      const cBase = row.getCell(4);
      cBase.value  = parseFloat(f.base_imponible) || 0;
      cBase.numFmt = '#,##0.00 €';
      cBase.alignment = { horizontal: 'right' };

      // IVA %
      const cIvaPct = row.getCell(5);
      cIvaPct.value  = parseFloat(f.iva_porcentaje) || 0;
      cIvaPct.numFmt = '0.00"%"';
      cIvaPct.alignment = { horizontal: 'center' };

      // Cuota IVA
      const cIvaImp = row.getCell(6);
      cIvaImp.value  = parseFloat(f.iva_importe) || 0;
      cIvaImp.numFmt = '#,##0.00 €';
      cIvaImp.alignment = { horizontal: 'right' };

      // Total
      const cTotal = row.getCell(7);
      cTotal.value  = parseFloat(f.total) || 0;
      cTotal.numFmt = '#,##0.00 €';
      cTotal.font   = { bold: true };
      cTotal.alignment = { horizontal: 'right' };

      // Empleado
      row.getCell(8).value = f.empleado_nombre || '';

      // Fecha subida
      const cSubida = row.getCell(9);
      cSubida.value  = f.created_at ? new Date(f.created_at) : null;
      cSubida.numFmt = 'dd/mm/yyyy hh:mm';
      cSubida.font   = { color: { argb: 'FFaaaaaa' }, size: 10 };

      // Fondo alternado
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).fill = { type:'pattern', pattern:'solid', fgColor:{ argb: bgColor } };
      }

      row.height = 20;

      totalBase    += parseFloat(f.base_imponible) || 0;
      totalIVAImp  += parseFloat(f.iva_importe)    || 0;
      totalTotal   += parseFloat(f.total)          || 0;
    });

    // ── 7. Fila de totales ─────────────────────────────────────
    ws.addRow({}); // espaciado
    const totalRow = ws.addRow({});
    const tLabel   = totalRow.getCell(2);
    tLabel.value = 'TOTALES';
    tLabel.font  = { bold: true, size: 12, color: { argb: COLOR_BLANCO } };

    const tBase = totalRow.getCell(4);
    tBase.value  = totalBase;
    tBase.numFmt = '#,##0.00 €';
    tBase.font   = { bold: true, size: 12, color: { argb: COLOR_BLANCO } };

    const tIvaImp = totalRow.getCell(6);
    tIvaImp.value  = totalIVAImp;
    tIvaImp.numFmt = '#,##0.00 €';
    tIvaImp.font   = { bold: true, size: 12, color: { argb: COLOR_BLANCO } };

    const tTotal = totalRow.getCell(7);
    tTotal.value  = totalTotal;
    tTotal.numFmt = '#,##0.00 €';
    tTotal.font   = { bold: true, size: 14, color: { argb: COLOR_BLANCO } };

    for (let c = 1; c <= 9; c++) {
      totalRow.getCell(c).fill = { type:'pattern', pattern:'solid', fgColor:{ argb: COLOR_ROJO } };
    }
    totalRow.height = 28;

    // ── 8. Serializar y enviar ────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const fecha  = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="facturas_${fecha}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);

  } catch (err) {
    console.error('[exportar-excel] Error:', err);
    return res.status(500).json({ error: err.message || 'Error al generar el Excel' });
  }
}
