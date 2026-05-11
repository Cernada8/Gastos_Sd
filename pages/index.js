import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, getUsuarioActivo } from '../lib/supabase';

export default function LoginPage() {
  const router  = useRouter();
  const [nombre,   setNombre]   = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(true);

  // Si ya hay sesión activa, redirigir
  useEffect(() => {
    getUsuarioActivo().then((u) => {
      if (u) {
        router.replace(u.perfil?.role === 'admin' ? '/dashboard' : '/subir');
      } else {
        setChecking(false);
      }
    });
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Llamar a nuestra API que mapea nombre → email → auth
      const res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre: nombre.trim(), password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      // Establecer la sesión en el cliente de Supabase
      await supabase.auth.setSession({
        access_token:  json.session.access_token,
        refresh_token: json.session.refresh_token,
      });

      // Redirigir según rol
      router.push(json.role === 'admin' ? '/dashboard' : '/subir');

    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#111' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #0f0f0f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#1A1A1A',
        border: '1px solid #2A2A2A',
        borderRadius: '20px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src="/logo.png"
            alt="SD Logo"
            style={{ maxWidth: '160px', maxHeight: '80px', objectFit: 'contain', margin: '0 auto', display: 'block' }}
            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}
          />
          <div style={{ display:'none', fontSize:'32px', fontWeight:800, color:'#D42B2B' }}>SD</div>
          <p style={{ color:'#555', fontSize:'12px', marginTop:'10px', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            Gestión de Facturas
          </p>
        </div>

        <h1 style={{ fontSize:'22px', fontWeight:700, color:'#fff', marginBottom:'4px' }}>
          Bienvenido
        </h1>
        <p style={{ color:'#555', fontSize:'13px', marginBottom:'28px' }}>
          Accede con tu nombre de usuario
        </p>

        <form onSubmit={handleLogin}>
          {/* Nombre */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'12px', fontWeight:500, color:'#888', marginBottom:'7px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Nombre
            </label>
            <input
              type="text"
              className="input-base"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom:'24px' }}>
            <label style={{ display:'block', fontSize:'12px', fontWeight:500, color:'#888', marginBottom:'7px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Contraseña
            </label>
            <input
              type="password"
              className="input-base"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background:'rgba(212,43,43,0.1)', border:'1px solid rgba(212,43,43,0.3)',
              borderRadius:'8px', padding:'11px 14px', marginBottom:'18px',
              fontSize:'13px', color:'#ff6b6b',
              display:'flex', alignItems:'center', gap:'8px',
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width:'100%', justifyContent:'center', padding:'13px', fontSize:'15px' }}
          >
            {loading
              ? <><div className="spinner" style={{ width:16, height:16 }} /> Entrando...</>
              : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:'24px', color:'#383838', fontSize:'12px' }}>
          ¿Problemas para acceder? Contacta con el administrador
        </p>
      </div>
    </div>
  );
}
