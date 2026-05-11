import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, getUsuarioActivo } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(true);

  // Si ya hay sesión activa, redirigir
  useEffect(() => {
    getUsuarioActivo().then((u) => {
      if (u) {
        const destino = u.perfil?.role === 'admin' ? '/dashboard' : '/subir';
        router.replace(destino);
      } else {
        setChecking(false);
      }
    });
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError('Credenciales incorrectas. Revisa tu email y contraseña.');
      setLoading(false);
      return;
    }

    // Obtener perfil y redirigir según rol
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const destino = perfil?.role === 'admin' ? '/dashboard' : '/subir';
    router.push(destino);
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
      {/* Card de login */}
      <div style={{
        background: '#1A1A1A',
        border: '1px solid #2A2A2A',
        borderRadius: '20px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src="/logo.png"
            alt="SD Logo"
            style={{ maxWidth: '160px', maxHeight: '80px', objectFit: 'contain', margin: '0 auto' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <div style={{ display: 'none', fontSize: '28px', fontWeight: 800, color: '#D42B2B' }}>SD</div>
          <p style={{ color: '#555', fontSize: '13px', marginTop: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Gestión de Facturas
          </p>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
          Bienvenido
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>
          Accede con tu cuenta corporativa
        </p>

        <form onSubmit={handleLogin}>
          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#aaa', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              className="input-base"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#aaa', marginBottom: '8px' }}>
              Contraseña
            </label>
            <input
              type="password"
              className="input-base"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(212,43,43,0.1)',
              border: '1px solid rgba(212,43,43,0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#ff6b6b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '15px' }}
          >
            {loading ? <><div className="spinner" style={{ width:16, height:16 }} /> Accediendo...</> : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '28px', color: '#444', fontSize: '12px' }}>
          ¿Problemas con tu cuenta? Contacta con tu administrador
        </p>
      </div>
    </div>
  );
}
