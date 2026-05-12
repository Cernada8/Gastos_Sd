import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase, getUsuarioActivo, cerrarSesion } from '../lib/supabase';

// ── Toast ────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const bg = type === 'success' ? '#166534' : type === 'error' ? '#7f1d1d' : '#1e3a5f';
  const border = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb';
  return (
    <div className="toast-enter" style={{
      position:'fixed', bottom:24, right:24, zIndex:99,
      background:bg, border:`1px solid ${border}`,
      borderRadius:12, padding:'14px 20px', color:'#fff', fontSize:14,
      maxWidth:360, display:'flex', alignItems:'center', gap:10,
      boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <span>{type==='success'?'✓':type==='error'?'✕':'ℹ'}</span>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:18 }}>×</button>
    </div>
  );
}

// ── Estado de cada item en la cola ───────────────────────────
// { id, file, status: 'pending'|'extracting'|'reviewing'|'saving'|'saved'|'error', form, error }

const EMPTY_FORM = {
  fecha_factura:'', proveedor:'', numero_factura:'',
  base_imponible:'', iva_porcentaje:'21', iva_importe:'', total:'',
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Icono de estado ──────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'pending')    return <span style={{ color:'#555', fontSize:18 }}>⏳</span>;
  if (status === 'extracting') return <div className="spinner" style={{ width:16, height:16 }} />;
  if (status === 'reviewing')  return <span style={{ color:'#ECC94B', fontSize:18 }}>✏️</span>;
  if (status === 'saving')     return <div className="spinner" style={{ width:16, height:16, borderTopColor:'#48BB78' }} />;
  if (status === 'saved')      return <span style={{ color:'#48BB78', fontSize:18 }}>✓</span>;
  if (status === 'error')      return <span style={{ color:'#D42B2B', fontSize:18 }}>✕</span>;
  return null;
}

function statusLabel(status) {
  if (status === 'pending')    return { text:'En cola',       color:'#555' };
  if (status === 'extracting') return { text:'Extrayendo IA…',color:'#888' };
  if (status === 'reviewing')  return { text:'Revisar datos', color:'#ECC94B' };
  if (status === 'saving')     return { text:'Guardando…',    color:'#48BB78' };
  if (status === 'saved')      return { text:'Guardado',      color:'#48BB78' };
  if (status === 'error')      return { text:'Error',         color:'#D42B2B' };
  return { text:'', color:'#888' };
}

// ── Fila editable de la cola ─────────────────────────────────
function QueueRow({ item, onFormChange, onSave, onRetry }) {
  const { status, form, error, file } = item;
  const sl = statusLabel(status);
  const isReviewing = status === 'reviewing';

  return (
    <div style={{
      background:'#1A1A1A', border:`1px solid ${isReviewing ? '#444' : '#222'}`,
      borderRadius:12, padding:'16px 20px', marginBottom:12,
      transition:'border-color 0.2s',
    }}>
      {/* Fila superior: nombre + estado */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: isReviewing ? 16 : 0 }}>
        <StatusIcon status={status} />
        <span style={{ flex:1, fontSize:13, color:'#ccc', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {file.name}
        </span>
        <span style={{ fontSize:12, fontWeight:600, color: sl.color, whiteSpace:'nowrap' }}>{sl.text}</span>
        {status === 'error' && (
          <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:12 }} onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>

      {/* Error detalle */}
      {status === 'error' && error && (
        <p style={{ color:'#ff6b6b', fontSize:12, marginTop:8, marginLeft:28 }}>{error}</p>
      )}

      {/* Formulario de revisión */}
      {isReviewing && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div style={{ gridColumn:'span 2' }}>
            <MiniLabel>Proveedor</MiniLabel>
            <input type="text" className="input-base"
              value={form.proveedor}
              onChange={e => onFormChange('proveedor', e.target.value)} />
          </div>
          <div>
            <MiniLabel>Fecha</MiniLabel>
            <input type="date" className="input-base"
              value={form.fecha_factura}
              onChange={e => onFormChange('fecha_factura', e.target.value)} />
          </div>
          <div>
            <MiniLabel>Nº Factura</MiniLabel>
            <input type="text" className="input-base"
              value={form.numero_factura}
              onChange={e => onFormChange('numero_factura', e.target.value)} />
          </div>
          <div>
            <MiniLabel>Base (€)</MiniLabel>
            <input type="number" step="0.01" className="input-base"
              value={form.base_imponible}
              onChange={e => onFormChange('base_imponible', e.target.value)} />
          </div>
          <div>
            <MiniLabel>IVA %</MiniLabel>
            <input type="number" step="0.01" className="input-base"
              value={form.iva_porcentaje}
              onChange={e => onFormChange('iva_porcentaje', e.target.value)} />
          </div>
          <div>
            <MiniLabel>Cuota IVA (€)</MiniLabel>
            <input type="number" step="0.01" className="input-base"
              value={form.iva_importe}
              onChange={e => onFormChange('iva_importe', e.target.value)} />
          </div>
          <div>
            <MiniLabel>Total (€)</MiniLabel>
            <input type="number" step="0.01" className="input-base"
              value={form.total}
              onChange={e => onFormChange('total', e.target.value)} />
          </div>
          <div style={{ display:'flex', alignItems:'flex-end' }}>
            <button className="btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={onSave}>
              💾 Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniLabel({ children }) {
  return <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#666', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>{children}</label>;
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────
export default function SubirFactura() {
  const router  = useRouter();
  const fileRef = useRef(null);

  const [usuario,   setUsuario]   = useState(null);
  const [checking,  setChecking]  = useState(true);
  const [dragOver,  setDragOver]  = useState(false);
  const [queue,     setQueue]     = useState([]);   // array de items
  const [toast,     setToast]     = useState(null);
  const processingRef = useRef(false);

  const showToast = (msg, type='success') => setToast({ msg, type });

  // ── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    getUsuarioActivo().then((u) => {
      if (!u) { router.replace('/'); return; }
      setUsuario(u);
      setChecking(false);
    });
  }, []);

  // ── Actualizar item de la cola ───────────────────────────
  const updateItem = useCallback((id, patch) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  // ── Procesar siguiente pendiente ─────────────────────────
  const processNext = useCallback(async (currentQueue) => {
    if (processingRef.current) return;
    const next = currentQueue.find(i => i.status === 'pending');
    if (!next) return;

    processingRef.current = true;
    updateItem(next.id, { status: 'extracting' });

    try {
      const base64 = await fileToBase64(next.file);
      const res = await fetch('/api/extraer-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: next.file.type, nombre: next.file.name }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Error de extracción');

      const form = {
        fecha_factura:  json.fecha_factura  || '',
        proveedor:      json.proveedor      || '',
        numero_factura: json.numero_factura || '',
        base_imponible: json.base_imponible != null ? String(json.base_imponible) : '',
        iva_porcentaje: json.iva_porcentaje != null ? String(json.iva_porcentaje) : '21',
        iva_importe:    json.iva_importe    != null ? String(json.iva_importe)    : '',
        total:          json.total          != null ? String(json.total)          : '',
      };

      updateItem(next.id, { status: 'reviewing', form });
    } catch (err) {
      updateItem(next.id, { status: 'error', error: err.message });
    } finally {
      processingRef.current = false;
      // Procesar siguiente tras 500ms para no saturar la API
      setTimeout(() => {
        setQueue(q => {
          processNext(q);
          return q;
        });
      }, 500);
    }
  }, [updateItem]);

  // ── Cuando cambia la cola, procesar siguiente pendiente ───
  useEffect(() => {
    if (!processingRef.current) processNext(queue);
  }, [queue.length]);

  // ── Añadir archivos a la cola ────────────────────────────
  const addFiles = useCallback((files) => {
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    const valid   = Array.from(files).filter(f => allowed.includes(f.type) && f.size <= 10*1024*1024);
    const invalid = Array.from(files).filter(f => !allowed.includes(f.type) || f.size > 10*1024*1024);

    if (invalid.length) showToast(`${invalid.length} archivo(s) ignorados (formato no válido o >10 MB)`, 'error');
    if (!valid.length)  return;

    const newItems = valid.map(file => ({
      id:     `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      form:   { ...EMPTY_FORM },
      error:  null,
    }));

    setQueue(q => [...q, ...newItems]);
    showToast(`${valid.length} archivo(s) añadido(s) a la cola`, 'info');
  }, []);

  // ── Guardar un item revisado ─────────────────────────────
  const handleSave = useCallback(async (id) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, status:'saving' } : item));

    const item = queue.find(i => i.id === id);
    if (!item) return;

    try {
      const ext      = item.file.name.split('.').pop();
      const filename = `${usuario.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('Facturas')
        .upload(filename, item.file, { contentType: item.file.type, upsert: false });
      if (uploadError) throw new Error('Error al subir: ' + uploadError.message);

      const { data: urlData } = supabase.storage.from('Facturas').getPublicUrl(filename);

      const { error: dbError } = await supabase.from('facturas').insert({
        fecha_factura:   item.form.fecha_factura,
        proveedor:       item.form.proveedor.trim(),
        numero_factura:  item.form.numero_factura.trim(),
        base_imponible:  parseFloat(item.form.base_imponible) || 0,
        iva_porcentaje:  parseFloat(item.form.iva_porcentaje) || 21,
        iva_importe:     parseFloat(item.form.iva_importe)    || 0,
        total:           parseFloat(item.form.total)          || 0,
        empleado_id:     usuario.id,
        empleado_nombre: usuario.perfil?.nombre || usuario.email,
        archivo_url:     urlData.publicUrl,
        archivo_nombre:  item.file.name,
      });
      if (dbError) throw new Error('Error al guardar: ' + dbError.message);

      updateItem(id, { status: 'saved' });
    } catch (err) {
      updateItem(id, { status: 'error', error: err.message });
      showToast(err.message, 'error');
    }
  }, [queue, usuario, updateItem]);

  // ── Reintentar un item con error ─────────────────────────
  const handleRetry = useCallback((id) => {
    updateItem(id, { status: 'pending', error: null, form: { ...EMPTY_FORM } });
    setTimeout(() => setQueue(q => { processNext(q); return q; }), 100);
  }, [updateItem, processNext]);

  // ── Form change ──────────────────────────────────────────
  const handleFormChange = useCallback((id, field, value) => {
    setQueue(q => q.map(item => {
      if (item.id !== id) return item;
      const next = { ...item.form, [field]: value };
      if (field === 'base_imponible' || field === 'iva_porcentaje') {
        const base = parseFloat(next.base_imponible) || 0;
        const pct  = parseFloat(next.iva_porcentaje) || 0;
        const imp  = +(base * pct / 100).toFixed(2);
        next.iva_importe = String(imp);
        next.total       = String(+(base + imp).toFixed(2));
      }
      return { ...item, form: next };
    }));
  }, []);

  // ── Stats ────────────────────────────────────────────────
  const total     = queue.length;
  const saved     = queue.filter(i => i.status === 'saved').length;
  const pending   = queue.filter(i => ['pending','extracting'].includes(i.status)).length;
  const reviewing = queue.filter(i => i.status === 'reviewing').length;
  const errors    = queue.filter(i => i.status === 'error').length;

  if (checking) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
        <div className="spinner" style={{ width:32, height:32 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#111', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <header style={{ background:'#1A1A1A', borderBottom:'1px solid #2A2A2A', position:'sticky', top:0, zIndex:10 }}>
        <div className="header-inner" style={{ width:'100%' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <img src="/favicon.png" alt="SD" style={{ height:36, objectFit:'contain' }} />
            <div style={{ width:1, height:24, background:'#333' }} />
            <span style={{ color:'#888', fontSize:14 }}>Subir facturas</span>
          </div>
          <div className="header-right" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ color:'#666', fontSize:13 }}>{usuario?.perfil?.nombre || usuario?.email}</span>
            {usuario?.perfil?.role === 'admin' && (
              <button className="btn-ghost" onClick={() => router.push('/dashboard')}>📊 Dashboard</button>
            )}
            <button className="btn-ghost" onClick={() => { cerrarSesion(); router.push('/'); }}>Salir</button>
          </div>
        </div>
      </header>

      <main className="main-pad" style={{ flex:1, maxWidth:900 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, marginBottom:4 }}>Subir Facturas</h1>
            <p style={{ color:'#666', fontSize:14 }}>Arrastra uno o varios archivos — se procesarán automáticamente con IA</p>
          </div>
          {total > 0 && (
            <div style={{ display:'flex', gap:16, fontSize:13 }}>
              {saved     > 0 && <span style={{ color:'#48BB78' }}>✓ {saved} guardadas</span>}
              {reviewing > 0 && <span style={{ color:'#ECC94B' }}>✏ {reviewing} para revisar</span>}
              {pending   > 0 && <span style={{ color:'#888'    }}>⏳ {pending} en cola</span>}
              {errors    > 0 && <span style={{ color:'#D42B2B' }}>✕ {errors} errores</span>}
            </div>
          )}
        </div>

        {/* Zona drop */}
        <div
          className={`dropzone${dragOver ? ' drag-over' : ''}`}
          style={{ padding:'36px 24px', textAlign:'center', marginBottom:28,
            display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ fontSize:36, opacity:0.4 }}>⬆</div>
          <p style={{ color:'#aaa', fontWeight:500 }}>Arrastra aquí tus facturas</p>
          <p style={{ color:'#555', fontSize:13 }}>Puedes soltar varios archivos a la vez · JPG · PNG · WEBP · PDF · máx 10 MB c/u</p>
          {total > 0 && (
            <span style={{ marginTop:4, background:'rgba(212,43,43,0.15)', color:'#D42B2B',
              borderRadius:99, padding:'3px 12px', fontSize:12, fontWeight:600 }}>
              + Añadir más archivos
            </span>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf"
          multiple style={{ display:'none' }}
          onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value=''; } }} />

        {/* Cola */}
        {queue.length > 0 && (
          <div>
            {/* Barra de progreso global */}
            {total > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#555', marginBottom:6 }}>
                  <span>{saved} de {total} guardadas</span>
                  <span>{Math.round(saved/total*100)}%</span>
                </div>
                <div style={{ height:4, background:'#222', borderRadius:99 }}>
                  <div style={{ height:'100%', background:'#48BB78', borderRadius:99,
                    width:`${saved/total*100}%`, transition:'width 0.4s' }} />
                </div>
              </div>
            )}

            {/* Limpiar guardadas */}
            {saved > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <button className="btn-ghost" style={{ fontSize:12 }}
                  onClick={() => setQueue(q => q.filter(i => i.status !== 'saved'))}>
                  Limpiar guardadas ({saved})
                </button>
              </div>
            )}

            {queue.map(item => (
              <QueueRow
                key={item.id}
                item={item}
                onFormChange={(field, val) => handleFormChange(item.id, field, val)}
                onSave={() => handleSave(item.id)}
                onRetry={() => handleRetry(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
