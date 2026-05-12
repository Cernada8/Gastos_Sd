import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase, getUsuarioActivo, cerrarSesion } from '../lib/supabase';

// ── Toast helper ────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, []);
  const bg = type === 'success' ? '#166534' : type === 'error' ? '#7f1d1d' : '#1e3a5f';
  const border = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb';
  return (
    <div className="toast-enter" style={{
      position:'fixed', bottom:24, right:24, zIndex:99,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '14px 20px',
      color:'#fff', fontSize:14, maxWidth:320,
      display:'flex', alignItems:'center', gap:10,
      boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <span>{type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span>{msg}</span>
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:18 }}>×</button>
    </div>
  );
}

const EMPTY_FORM = {
  fecha_factura: '', proveedor: '', numero_factura: '',
  base_imponible: '', iva_porcentaje: '21', iva_importe: '', total: '',
};

export default function SubirFactura() {
  const router = useRouter();
  const fileRef   = useRef(null);
  const dropRef   = useRef(null);

  const [usuario,    setUsuario]    = useState(null);
  const [checking,   setChecking]   = useState(true);
  const [file,       setFile]       = useState(null);
  const [preview,    setPreview]    = useState(null);  // URL preview
  const [dragOver,   setDragOver]   = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [extracted,  setExtracted]  = useState(false);
  const [toast,      setToast]      = useState(null);

  // Proteger ruta
  useEffect(() => {
    getUsuarioActivo().then((u) => {
      if (!u) { router.replace('/'); return; }
      setUsuario(u);
      setChecking(false);
    });
  }, []);

  // Limpiar preview al desmontar
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // ── Procesar archivo seleccionado ──────────────────────────
  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selectedFile.type)) {
      showToast('Formato no válido. Sube un JPG, PNG, WEBP o PDF.', 'error');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast('El archivo supera el límite de 10 MB.', 'error');
      return;
    }

    setFile(selectedFile);
    setExtracted(false);
    setForm(EMPTY_FORM);

    // Preview
    if (selectedFile.type !== 'application/pdf') {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview('pdf');
    }

    // Extraer con Claude
    setExtracting(true);
    try {
      // Convertir a base64
      const base64 = await fileToBase64(selectedFile);
      const res = await fetch('/api/extraer-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: selectedFile.type, nombre: selectedFile.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al extraer datos');
      setForm({
        fecha_factura:  json.fecha_factura  || '',
        proveedor:      json.proveedor      || '',
        numero_factura: json.numero_factura || '',
        base_imponible: json.base_imponible != null ? String(json.base_imponible) : '',
        iva_porcentaje: json.iva_porcentaje != null ? String(json.iva_porcentaje) : '21',
        iva_importe:    json.iva_importe    != null ? String(json.iva_importe)    : '',
        total:          json.total          != null ? String(json.total)          : '',
      });
      setExtracted(true);
      showToast('Datos extraídos correctamente. Revisa y guarda.', 'success');
    } catch (err) {
      showToast(err.message || 'Error al procesar el archivo con IA.', 'error');
    } finally {
      setExtracting(false);
    }
  }, []);

  // ── Drag & Drop ────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = ()  => setDragOver(false);
  const onDrop      = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Campo IVA auto-calcula ──────────────────────────────────
  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const base = parseFloat(next.base_imponible) || 0;
      const pct  = parseFloat(next.iva_porcentaje) || 0;
      if (field === 'base_imponible' || field === 'iva_porcentaje') {
        const imp = +(base * pct / 100).toFixed(2);
        next.iva_importe = String(imp);
        next.total       = String(+(base + imp).toFixed(2));
      }
      return next;
    });
  };

  // ── Guardar factura ────────────────────────────────────────
  async function handleGuardar(e) {
    e.preventDefault();
    if (!file) { showToast('Primero selecciona un archivo.', 'error'); return; }

    setSaving(true);
    try {
      // 1. Subir archivo a Supabase Storage
      const ext      = file.name.split('.').pop();
      const filename = `${usuario.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('Facturas')
        .upload(filename, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error('Error al subir el archivo: ' + uploadError.message);

      // 2. Obtener URL pública
      const { data: urlData } = supabase.storage.from('Facturas').getPublicUrl(filename);
      const archivo_url = urlData.publicUrl;

      // 3. Insertar en BD
      const payload = {
        fecha_factura:   form.fecha_factura,
        proveedor:       form.proveedor.trim(),
        numero_factura:  form.numero_factura.trim(),
        base_imponible:  parseFloat(form.base_imponible) || 0,
        iva_porcentaje:  parseFloat(form.iva_porcentaje) || 21,
        iva_importe:     parseFloat(form.iva_importe)    || 0,
        total:           parseFloat(form.total)          || 0,
        empleado_id:     usuario.id,
        empleado_nombre: usuario.perfil?.nombre || usuario.email,
        archivo_url,
        archivo_nombre: file.name,
      };

      const { error: dbError } = await supabase.from('facturas').insert(payload);
      if (dbError) throw new Error('Error al guardar en base de datos: ' + dbError.message);

      showToast('¡Factura guardada correctamente!', 'success');
      // Reset
      setFile(null); setPreview(null); setForm(EMPTY_FORM); setExtracted(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

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
      <header style={{
        background:'#1A1A1A', borderBottom:'1px solid #2A2A2A',
        padding:'0 24px', height:64,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:10,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src="/logo.png" alt="SD" style={{ height:36, objectFit:'contain' }}
            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
          <span style={{ display:'none', fontWeight:800, color:'#D42B2B', fontSize:22 }}>SD</span>
          <div style={{ width:1, height:24, background:'#333' }} />
          <span style={{ color:'#888', fontSize:14 }}>Subir factura</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#666', fontSize:13 }}>{usuario?.perfil?.nombre || usuario?.email}</span>
          {usuario?.perfil?.role === 'admin' && (
            <button className="btn-ghost" onClick={() => router.push('/dashboard')}>
              📊 Dashboard
            </button>
          )}
          <button className="btn-ghost" onClick={() => { cerrarSesion(); router.push('/'); }}>
            Salir
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex:1, padding:'32px 24px', maxWidth:1000, margin:'0 auto', width:'100%' }}>
        <h1 style={{ fontSize:24, fontWeight:700, marginBottom:8 }}>Nueva Factura</h1>
        <p style={{ color:'#666', fontSize:14, marginBottom:32 }}>
          Sube la imagen o PDF de tu factura. La IA extraerá los datos automáticamente.
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>

          {/* ── Zona de subida ── */}
          <div>
            <div
              ref={dropRef}
              className={`dropzone${dragOver ? ' drag-over' : ''}`}
              style={{ padding:'40px 24px', textAlign:'center', minHeight:280,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              {extracting ? (
                <>
                  <div className="spinner" style={{ width:40, height:40, marginBottom:16 }} />
                  <p style={{ color:'#aaa', fontSize:14 }}>Analizando con IA...</p>
                  <p style={{ color:'#555', fontSize:12, marginTop:6 }}>Claude está extrayendo los datos</p>
                </>
              ) : preview && preview !== 'pdf' ? (
                <img src={preview} alt="preview"
                  style={{ maxHeight:220, maxWidth:'100%', borderRadius:8, objectFit:'contain' }} />
              ) : preview === 'pdf' ? (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
                  <p style={{ color:'#aaa', fontSize:14 }}>{file?.name}</p>
                  <p style={{ color:'#555', fontSize:12, marginTop:4 }}>PDF cargado</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:40, marginBottom:16, opacity:0.4 }}>⬆</div>
                  <p style={{ color:'#aaa', fontWeight:500, marginBottom:6 }}>
                    Arrastra aquí tu factura
                  </p>
                  <p style={{ color:'#555', fontSize:13 }}>o haz clic para seleccionar</p>
                  <p style={{ color:'#444', fontSize:12, marginTop:12 }}>JPG · PNG · WEBP · PDF · máx 10 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              style={{ display:'none' }}
              onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
            />
            {file && !extracting && (
              <button
                className="btn-ghost"
                style={{ marginTop:12, width:'100%', justifyContent:'center' }}
                onClick={() => { setFile(null); setPreview(null); setForm(EMPTY_FORM); setExtracted(false); }}
              >
                ✕ Cambiar archivo
              </button>
            )}
          </div>

          {/* ── Formulario ── */}
          <div>
            <div style={{
              background:'#1A1A1A', border:'1px solid #2A2A2A',
              borderRadius:16, padding:28,
              opacity: extracted || !file ? 1 : 0.4,
              pointerEvents: extracted || !file ? 'auto' : 'none',
            }}>
              {!extracted && !file && (
                <p style={{ color:'#555', textAlign:'center', padding:'40px 0', fontSize:14 }}>
                  Sube un archivo para<br />rellenar automáticamente
                </p>
              )}
              {(extracted || file) && (
                <form onSubmit={handleGuardar}>
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                    <Field label="Fecha de factura">
                      <input type="date" className="input-base"
                        value={form.fecha_factura}
                        onChange={(e) => handleFormChange('fecha_factura', e.target.value)}
                        required />
                    </Field>

                    <Field label="Proveedor / Emisor">
                      <input type="text" className="input-base" placeholder="Nombre empresa"
                        value={form.proveedor}
                        onChange={(e) => handleFormChange('proveedor', e.target.value)}
                        required />
                    </Field>

                    <Field label="Número de factura">
                      <input type="text" className="input-base" placeholder="FAC-2024-001"
                        value={form.numero_factura}
                        onChange={(e) => handleFormChange('numero_factura', e.target.value)}
                        required />
                    </Field>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <Field label="Base imponible (€)">
                        <input type="number" step="0.01" className="input-base" placeholder="0.00"
                          value={form.base_imponible}
                          onChange={(e) => handleFormChange('base_imponible', e.target.value)}
                          required />
                      </Field>
                      <Field label="IVA (%)">
                        <input type="number" step="0.01" className="input-base" placeholder="21"
                          value={form.iva_porcentaje}
                          onChange={(e) => handleFormChange('iva_porcentaje', e.target.value)}
                          required />
                      </Field>
                      <Field label="Cuota IVA (€)">
                        <input type="number" step="0.01" className="input-base" placeholder="0.00"
                          value={form.iva_importe}
                          onChange={(e) => handleFormChange('iva_importe', e.target.value)}
                          required />
                      </Field>
                      <Field label="Total (€)">
                        <input type="number" step="0.01" className="input-base" placeholder="0.00"
                          value={form.total}
                          onChange={(e) => handleFormChange('total', e.target.value)}
                          required />
                      </Field>
                    </div>

                    {extracted && (
                      <div style={{
                        background:'rgba(72,187,120,0.08)', border:'1px solid rgba(72,187,120,0.2)',
                        borderRadius:8, padding:'10px 14px', fontSize:13, color:'#48BB78',
                        display:'flex', alignItems:'center', gap:8,
                      }}>
                        ✓ Datos extraídos por IA — revisa antes de guardar
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={saving || extracting}
                      style={{ justifyContent:'center', padding:'13px', fontSize:15 }}
                    >
                      {saving
                        ? <><div className="spinner" style={{ width:16, height:16 }} /> Guardando...</>
                        : '💾 Guardar factura'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// Convierte File a base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
