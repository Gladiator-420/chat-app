import { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';

export default function Signup({ onSwitch }) {
  const [form, setForm] = useState({ email: '', password: '', handle: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = async () => {
    setError('');
    const handle = form.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!handle || handle.length < 3) return setError('Handle must be at least 3 characters (letters, numbers, _)');
    if (!form.email.trim()) return setError('Email is required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');

    setLoading(true);
    try {
      // Check if handle is already taken
      const q = query(collection(db, 'users'), where('handle', '==', handle));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setLoading(false);
        return setError(`@${handle} is already taken. Try another.`);
      }

      // Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);

      // Send verification email
      await sendEmailVerification(cred.user);

      // Save user profile in Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: form.email.trim().toLowerCase(),
        handle,
        displayHandle: form.handle.trim(),
        createdAt: Date.now(),
        bio: '',
      });

      setDone(true);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setError('This email is already registered.');
      else if (e.code === 'auth/invalid-email') setError('Invalid email address.');
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
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', top: -100, left: -100, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', bottom: -80, right: -80, pointerEvents: 'none' }}/>

      <div style={{
        width: '100%', maxWidth: 440, padding: 48,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {done ? (
          // Verification sent screen
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Check your email!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
              We sent a verification link to <strong style={{ color: '#fff' }}>{form.email}</strong>. Click it to activate your account.
            </p>
            <div style={{
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 24,
              color: 'rgba(255,255,255,0.7)', fontSize: 14,
            }}>
              Your handle: <strong style={{ color: '#a5b4fc' }}>@{form.handle.trim().toLowerCase()}</strong>
            </div>
            <button onClick={onSwitch} style={{
              width: '100%', padding: 14, border: 'none', borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Go to Login →
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 26,
                boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
              }}>💬</div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Create account</h1>
              <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Join NexChat today</p>
            </div>

            {/* Handle */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Unique Handle
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: '#6366f1', fontWeight: 700, fontSize: 16, pointerEvents: 'none',
                }}>@</span>
                <input
                  placeholder="your_handle"
                  value={form.handle}
                  onChange={e => update('handle', e.target.value)}
                  onFocus={() => setFocused('handle')}
                  onBlur={() => setFocused(null)}
                  style={{ ...inputStyle('handle'), paddingLeft: 32 }}
                />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                This is how others will find and message you
              </p>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                placeholder="you@email.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                style={inputStyle('email')}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                style={inputStyle('password')}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                color: '#fca5a5', fontSize: 13,
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSignup}
              disabled={loading}
              style={{
                width: '100%', padding: 15, border: 'none', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
                boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>

            {/* Switch to login */}
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Already have an account?{' '}
              <span onClick={onSwitch} style={{ color: '#a5b4fc', cursor: 'pointer', fontWeight: 600 }}>
                Sign in
              </span>
            </p>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}