import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase, getUsuarioActivo, cerrarSesion } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function fmtDate(d) { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('es-ES'); }

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const bg = type === 'success' ? '#166534' : '#7f1d1d';
  return (
    <div className="toast-enter" style={{
      position:'fixed', bottom:24, right:24, zIndex:999,
      background:bg, border:`1px solid ${type==='success'?'#16a34a':'#dc2626'}`,
      borderRadius:12, padding:'14px 20px', color:'#fff', fontSize:14,
      display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', maxWidth:340,
    }}>
      <span>{type === 'success' ? '✓' : '✕'}</span><span>{msg}</span>
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:18 }}>×</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL EDITAR
// ─────────────────────────────────────────────────────────────
function ModalEditar({ factura, onClose, onSaved }) {
  const [form, setForm] = useState({
    fecha_factura:  factura.fecha_factura  || '',
    proveedor:      factura.proveedor      || '',
    numero_factura: factura.numero_factura || '',
    base_imponible: String(factura.base_imponible || 0),
    iva_porcentaje: String(factura.iva_porcentaje || 21),
    iva_importe:    String(factura.iva_importe    || 0),
    total:          String(factura.total          || 0),
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'base_imponible' || field === 'iva_porcentaje') {
        const base = parseFloat(next.base_imponible) || 0;
        const pct  = parseFloat(next.iva_porcentaje) || 0;
        const imp  = +(base * pct / 100).toFixed(2);
        next.iva_importe = String(imp);
        next.total       = String(+(base + imp).toFixed(2));
      }
      return next;
    });
  };

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch(`/api/facturas?id=${factura.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          base_imponible: parseFloat(form.base_imponible),
          iva_porcentaje: parseFloat(form.iva_porcentaje),
          iva_importe:    parseFloat(form.iva_importe),
          total:          parseFloat(form.total),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved(); onClose();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>Editar Factura</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <MField label="Fecha"><input type="date" className="input-base" value={form.fecha_factura} onChange={e => handleChange('fecha_factura', e.target.value)} required /></MField>
            <MField label="Proveedor"><input type="text" className="input-base" value={form.proveedor} onChange={e => handleChange('proveedor', e.target.value)} required /></MField>
            <MField label="Nº Factura"><input type="text" className="input-base" value={form.numero_factura} onChange={e => handleChange('numero_factura', e.target.value)} required /></MField>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <MField label="Base (€)"><input type="number" step="0.01" className="input-base" value={form.base_imponible} onChange={e => handleChange('base_imponible', e.target.value)} required /></MField>
              <MField label="IVA %"><input type="number" step="0.01" className="input-base" value={form.iva_porcentaje} onChange={e => handleChange('iva_porcentaje', e.target.value)} required /></MField>
              <MField label="Cuota IVA (€)"><input type="number" step="0.01" className="input-base" value={form.iva_importe} onChange={e => handleChange('iva_importe', e.target.value)} required /></MField>
              <MField label="Total (€)"><input type="number" step="0.01" className="input-base" value={form.total} onChange={e => handleChange('total', e.target.value)} required /></MField>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:24, justifyContent:'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{width:14,height:14}} /> Guardando...</> : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function MField({ label, children }) {
  return <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</label>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// MODAL CONFIRMAR ELIMINAR
// ─────────────────────────────────────────────────────────────
function ModalEliminar({ factura, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/facturas?id=${factura.id}`, { method: 'DELETE' });
    if (res.ok) { onDeleted(); onClose(); }
    else { alert('Error al eliminar'); setDeleting(false); }
  }
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:420, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🗑️</div>
        <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>¿Eliminar factura?</h2>
        <p style={{ color:'#888', fontSize:14, marginBottom:8 }}>
          <strong style={{ color:'#fff' }}>{factura.numero_factura}</strong> — {factura.proveedor}
        </p>
        <p style={{ color:'#666', fontSize:13, marginBottom:28 }}>
          Esta acción borrará el registro y el archivo adjunto. No se puede deshacer.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleDelete} disabled={deleting} style={{ background:'#7f1d1d' }}>
            {deleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART helpers (se inicializan con useEffect)
// ─────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const ref = useRef(null);
  const chart = useRef(null);
  useEffect(() => {
    if (!data || !ref.current || typeof Chart === 'undefined') return;
    if (chart.current) chart.current.destroy();
    chart.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.mes),
        datasets: [{ label:'Gasto (€)', data: data.map(d => d.total),
          backgroundColor: 'rgba(212,43,43,0.7)', borderColor: '#D42B2B',
          borderWidth:1, borderRadius:6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false } },
        scales: {
          x: { grid:{ color:'#1f1f1f' }, ticks:{ color:'#888', font:{ size:11 } } },
          y: { grid:{ color:'#1f1f1f' }, ticks:{ color:'#888', font:{ size:11 },
            callback: v => '€' + Number(v).toLocaleString('es-ES') } },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [data]);
  return <canvas ref={ref} />;
}

function DoughnutChart({ data }) {
  const ref = useRef(null);
  const chart = useRef(null);
  const COLORS = ['#D42B2B','#E05C5C','#8B1A1A','#FF8585','#3A0000'];
  useEffect(() => {
    if (!data || !ref.current || typeof Chart === 'undefined') return;
    if (chart.current) chart.current.destroy();
    chart.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.proveedor),
        datasets: [{ data: data.map(d => d.total),
          backgroundColor: COLORS, borderColor:'#1A1A1A', borderWidth:3 }],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend: { position:'right', labels:{ color:'#aaa', font:{ size:12 }, padding:16, boxWidth:14 } },
        },
        cutout: '65%',
      },
    });
    return () => chart.current?.destroy();
  }, [data]);
  return <canvas ref={ref} />;
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();

  const [checking,  setChecking]  = useState(true);
  const [usuario,   setUsuario]   = useState(null);
  const [facturas,  setFacturas]  = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [toast,     setToast]     = useState(null);

  // Filtros
  const [filtros, setFiltros] = useState({ desde:'', hasta:'', empleado_id:'', proveedor:'' });

  // Modales
  const [modalEditar,   setModalEditar]   = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);

  // Stats derivados
  const totalGasto    = facturas.reduce((a, f) => a + (parseFloat(f.total) || 0), 0);
  const totalIVA      = facturas.reduce((a, f) => a + (parseFloat(f.iva_importe) || 0), 0);
  const totalFacturas = facturas.length;
  const ultimaFactura = facturas[0] || null;

  // Datos para gráficos
  const dataBarras = calcGastosMes(facturas);
  const dataProveedores = calcTopProveedores(facturas);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // ── Proteger ruta ──────────────────────────────────────────
  useEffect(() => {
    getUsuarioActivo().then((u) => {
      if (!u) { router.replace('/'); return; }
      if (u.perfil?.role !== 'admin') { router.replace('/subir'); return; }
      setUsuario(u);
      setChecking(false);
    });
  }, []);

  // ── Cargar empleados para el filtro ───────────────────────
  useEffect(() => {
    if (!checking) {
      supabase.from('perfiles').select('id, nombre, email')
        .then(({ data }) => setEmpleados(data || []));
    }
  }, [checking]);

  // ── Cargar facturas ────────────────────────────────────────
  const cargarFacturas = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('facturas').select('*').order('created_at', { ascending: false });
      if (filtros.desde)       q = q.gte('fecha_factura', filtros.desde);
      if (filtros.hasta)       q = q.lte('fecha_factura', filtros.hasta);
      if (filtros.empleado_id) q = q.eq('empleado_id', filtros.empleado_id);
      if (filtros.proveedor)   q = q.ilike('proveedor', `%${filtros.proveedor}%`);
      const { data, error } = await q;
      if (error) throw error;
      setFacturas(data || []);
    } catch (err) {
      showToast('Error al cargar facturas: ' + err.message, 'error');
    } finally { setLoading(false); }
  }, [filtros]);

  useEffect(() => { if (!checking) cargarFacturas(); }, [checking, filtros]);

  // ── Exportar Excel ─────────────────────────────────────────
  async function handleExportar() {
    const params = new URLSearchParams();
    if (filtros.desde)       params.set('desde', filtros.desde);
    if (filtros.hasta)       params.set('hasta', filtros.hasta);
    if (filtros.empleado_id) params.set('empleado_id', filtros.empleado_id);
    if (filtros.proveedor)   params.set('proveedor', filtros.proveedor);

    const res = await fetch(`/api/exportar-excel?${params.toString()}`);
    if (!res.ok) { showToast('Error al generar el Excel', 'error'); return; }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `facturas_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Excel descargado correctamente');
  }

  if (checking) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
        <div className="spinner" style={{ width:36, height:36 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#111', display:'flex', flexDirection:'column' }}>

      {/* ── HEADER ── */}
      <header style={{
        background:'#1A1A1A', borderBottom:'1px solid #2A2A2A',
        padding:'0 28px', height:64,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:10,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src="/favicon.png" alt="SD" style={{ height:40, objectFit:'contain' }} />
          <div style={{ width:1, height:24, background:'#333' }} />
          <span style={{ color:'#aaa', fontSize:15, fontWeight:500 }}>Panel de Administración</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span className="badge badge-admin">Admin</span>
          <span style={{ color:'#666', fontSize:13 }}>{usuario?.perfil?.nombre || usuario?.email}</span>
          <button className="btn-ghost" onClick={() => router.push('/subir')}>
            ➕ Subir factura
          </button>
          <button className="btn-ghost" onClick={() => { cerrarSesion(); router.push('/'); }}>
            Salir
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ flex:1, padding:'28px', maxWidth:1400, margin:'0 auto', width:'100%' }}>

        {/* Título + acciones */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800 }}>Dashboard</h1>
            <p style={{ color:'#666', fontSize:14, marginTop:2 }}>Gestión de facturas de gastos</p>
          </div>
          <button className="btn-primary" onClick={handleExportar} style={{ gap:8 }}>
            <span>⬇</span> Exportar Excel
          </button>
        </div>

        {/* ── FILTROS ── */}
        <div style={{
          background:'#1A1A1A', border:'1px solid #2A2A2A',
          borderRadius:14, padding:'20px 24px', marginBottom:24,
          display:'flex', flexWrap:'wrap', gap:14, alignItems:'flex-end',
        }}>
          <FilterField label="Desde">
            <input type="date" className="input-base" style={{ width:160 }}
              value={filtros.desde}
              onChange={e => setFiltros(p => ({ ...p, desde: e.target.value }))} />
          </FilterField>
          <FilterField label="Hasta">
            <input type="date" className="input-base" style={{ width:160 }}
              value={filtros.hasta}
              onChange={e => setFiltros(p => ({ ...p, hasta: e.target.value }))} />
          </FilterField>
          <FilterField label="Empleado">
            <select className="input-base" style={{ width:200 }}
              value={filtros.empleado_id}
              onChange={e => setFiltros(p => ({ ...p, empleado_id: e.target.value }))}>
              <option value="">Todos</option>
              {empleados.map(em => (
                <option key={em.id} value={em.id}>{em.nombre || em.email}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Proveedor">
            <input type="text" className="input-base" style={{ width:200 }} placeholder="Buscar proveedor..."
              value={filtros.proveedor}
              onChange={e => setFiltros(p => ({ ...p, proveedor: e.target.value }))} />
          </FilterField>
          <button className="btn-ghost" onClick={() => setFiltros({ desde:'', hasta:'', empleado_id:'', proveedor:'' })}>
            Limpiar filtros
          </button>
        </div>

        {/* ── BENTO GRID ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gridTemplateRows:'auto', gap:20 }}>

          {/* KPIs — fila 1 */}
          <StatCard label="Gasto Total" value={`€ ${fmt(totalGasto)}`} icon="💰" accent />
          <StatCard label="Nº Facturas" value={totalFacturas} icon="🧾" />
          <StatCard label="IVA Soportado" value={`€ ${fmt(totalIVA)}`} icon="📋" />
          <StatCard
            label="Última factura"
            value={ultimaFactura ? ultimaFactura.proveedor : '—'}
            sub={ultimaFactura ? `${fmtDate(ultimaFactura.fecha_factura)} · €${fmt(ultimaFactura.total)}` : ''}
            icon="⏱"
          />

          {/* Gráfico barras — col 1-2, fila 2 */}
          <div className="bento-card" style={{ gridColumn:'span 2' }}>
            <p style={{ fontSize:13, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:16 }}>Gastos por mes</p>
            <div style={{ height:220 }}>
              {dataBarras.length ? <BarChart data={dataBarras} /> : <Empty />}
            </div>
          </div>

          {/* Gráfico proveedores — col 3-4, fila 2 */}
          <div className="bento-card" style={{ gridColumn:'span 2' }}>
            <p style={{ fontSize:13, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:16 }}>Top 5 Proveedores</p>
            <div style={{ height:220 }}>
              {dataProveedores.length ? <DoughnutChart data={dataProveedores} /> : <Empty />}
            </div>
          </div>

          {/* Tabla — span 4 */}
          <div className="bento-card" style={{ gridColumn:'span 4', padding:0, overflow:'hidden' }}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #2A2A2A', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <p style={{ fontSize:15, fontWeight:600 }}>Facturas{loading && <span style={{ marginLeft:12 }}><div className="spinner" style={{ width:14, height:14, display:'inline-block' }} /></span>}</p>
              <span style={{ fontSize:13, color:'#666' }}>{facturas.length} resultado{facturas.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#161616' }}>
                    {['Fecha','Proveedor','Nº Factura','Base','IVA','Total','Empleado','Acciones'].map(h => (
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', color:'#555', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facturas.length === 0 && !loading ? (
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px', color:'#555' }}>No hay facturas para los filtros aplicados</td></tr>
                  ) : facturas.map((f) => (
                    <tr key={f.id} className="table-row-hover" style={{ borderTop:'1px solid #222' }}>
                      <td style={{ padding:'12px 16px', color:'#aaa', whiteSpace:'nowrap' }}>{fmtDate(f.fecha_factura)}</td>
                      <td style={{ padding:'12px 16px', fontWeight:500, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.proveedor}</td>
                      <td style={{ padding:'12px 16px', color:'#aaa', fontFamily:'monospace', fontSize:12 }}>{f.numero_factura}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>€ {fmt(f.base_imponible)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color:'#888' }}>€ {fmt(f.iva_importe)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:600, color:'#fff' }}>€ {fmt(f.total)}</td>
                      <td style={{ padding:'12px 16px', color:'#888', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.empleado_nombre}</td>
                      <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          {f.archivo_url && (
                            <a href={f.archivo_url} target="_blank" rel="noopener noreferrer"
                              title="Ver archivo"
                              style={{ background:'#222', border:'1px solid #333', borderRadius:6, padding:'4px 8px', color:'#aaa', textDecoration:'none', fontSize:14, cursor:'pointer' }}
                              onMouseEnter={e => e.target.style.background='#333'}
                              onMouseLeave={e => e.target.style.background='#222'}>
                              👁
                            </a>
                          )}
                          <button title="Editar"
                            style={{ background:'#222', border:'1px solid #333', borderRadius:6, padding:'4px 8px', color:'#aaa', cursor:'pointer', fontSize:14 }}
                            onMouseEnter={e => e.target.style.background='#333'}
                            onMouseLeave={e => e.target.style.background='#222'}
                            onClick={() => setModalEditar(f)}>✏️</button>
                          <button title="Eliminar"
                            style={{ background:'#222', border:'1px solid #333', borderRadius:6, padding:'4px 8px', color:'#aaa', cursor:'pointer', fontSize:14 }}
                            onMouseEnter={e => { e.target.style.background='#3a0000'; e.target.style.borderColor='#7f1d1d'; }}
                            onMouseLeave={e => { e.target.style.background='#222'; e.target.style.borderColor='#333'; }}
                            onClick={() => setModalEliminar(f)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ── MODALES ── */}
      {modalEditar   && <ModalEditar   factura={modalEditar}   onClose={() => setModalEditar(null)}   onSaved={() => { cargarFacturas(); showToast('Factura actualizada'); }} />}
      {modalEliminar && <ModalEliminar factura={modalEliminar} onClose={() => setModalEliminar(null)} onDeleted={() => { cargarFacturas(); showToast('Factura eliminada'); }} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div className="bento-card" style={{ borderColor: accent ? 'rgba(212,43,43,0.3)' : '#2A2A2A' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontSize:11, fontWeight:600, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>{label}</p>
          <p style={{ fontSize:accent ? 26 : 22, fontWeight:800, color: accent ? '#D42B2B' : '#fff', lineHeight:1 }}>{value}</p>
          {sub && <p style={{ fontSize:12, color:'#666', marginTop:6 }}>{sub}</p>}
        </div>
        <span style={{ fontSize:24, opacity:0.4 }}>{icon}</span>
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#555', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

function Empty() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#555', fontSize:13 }}>Sin datos</div>;
}

// ── Cálculos para gráficos ────────────────────────────────────
function calcGastosMes(facturas) {
  const map = {};
  facturas.forEach(f => {
    if (!f.fecha_factura) return;
    const [y, m] = f.fecha_factura.split('-');
    const key = `${y}-${m}`;
    const label = new Date(parseInt(y), parseInt(m)-1, 1)
      .toLocaleDateString('es-ES', { month:'short', year:'2-digit' });
    map[key] = { mes: label, total: (map[key]?.total || 0) + (parseFloat(f.total) || 0) };
  });
  return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
}

function calcTopProveedores(facturas) {
  const map = {};
  facturas.forEach(f => {
    map[f.proveedor] = (map[f.proveedor] || 0) + (parseFloat(f.total) || 0);
  });
  return Object.entries(map)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5)
    .map(([proveedor, total]) => ({ proveedor, total: +total.toFixed(2) }));
}
