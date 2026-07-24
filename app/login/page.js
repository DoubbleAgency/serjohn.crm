'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError('Login inválido. Verifique o email e a palavra-passe.');
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Serjohn CRM</h1>
        <p className="sub">Plataforma interna — leads e stock</p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            Palavra-passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
