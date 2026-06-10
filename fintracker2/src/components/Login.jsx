import { useState } from 'react';

const CORRECT = import.meta.env.VITE_APP_PASSWORD;

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(false);
  const [shake, setShake]       = useState(false);

  function attempt() {
    if (password === CORRECT) {
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') attempt();
    if (error) setError(false);
  }

  return (
    <div style={{
      height: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '40px 36px', width: 340,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        animation: shake ? 'shake 0.4s ease' : 'none'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--text)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px'
          }}>FT</div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>FinTracker</span>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Enter your password to access the dashboard.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', letterSpacing: '.02em' }}>
            Password
          </label>
          <input
            type="password"
            className="fi"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            onKeyDown={handleKey}
            placeholder="Enter password"
            autoFocus
            style={{ borderColor: error ? 'var(--red)' : undefined }}
          />
          {error && (
            <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>
              Incorrect password. Try again.
            </span>
          )}
        </div>

        <button
          onClick={attempt}
          style={{
            width: '100%', background: 'var(--text)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '10px 0',
            fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}
        >
          Unlock
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
