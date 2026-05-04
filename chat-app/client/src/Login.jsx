import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

export default function Login({ onSwitch }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    setError('');
    if (!form.email.trim() || !form.password) return setError('Please fill in all fields');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      if (!cred.user.emailVerified) {
        setError('Please verify your email first. Check your inbox.');
        await auth.signOut();
      }
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
        setError('Invalid email or password.');
      else if (e.code === 'auth/too-many-requests')
        setError('Too many attempts. Try again later.');
      else setError(e.message);
    }
    setLoading(false);
  };

  const inputStyle = (key) => ({
    width: '100%', padding: '14px 16px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${focused === key ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 12, color: '#fff', fontSize: 15,
    outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  });

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', top: -100, left: -100, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', bottom: -80, right: -80, pointerEvents: 'none' }}/>

      <div style={{
        width: '100%', maxWidth: 420, padding: 48,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 26,
            boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
          }}>💬</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Welcome back</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Sign in to NexChat</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Email</label>
          <input placeholder="you@email.com" value={form.email} onChange={e => update('email', e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} style={inputStyle('email')} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Password</label>
          <input type="password" placeholder="Your password" value={form.password} onChange={e => update('password', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} style={inputStyle('password')} />
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} style={{
          width: '100%', padding: 15, border: 'none', borderRadius: 12,
          background: 'linear-gradient(135deg, #6366f1, #ec4899)',
          color: '#fff', fontSize: 15, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
          boxShadow: '0 8px 32px rgba(99,102,241,0.35)', transition: 'opacity 0.2s',
        }}>
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Don't have an account?{' '}
          <span onClick={onSwitch} style={{ color: '#a5b4fc', cursor: 'pointer', fontWeight: 600 }}>Sign up</span>
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}