import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import SpaceBg from './SpaceBg';

const inp = (focused, key) => ({
  width:'100%', padding:'13px 14px 13px 44px', boxSizing:'border-box',
  background: focused===key ? 'rgba(129,140,248,0.08)' : 'rgba(255,255,255,0.04)',
  border:`1px solid ${focused===key?'rgba(129,140,248,0.5)':'rgba(255,255,255,0.08)'}`,
  borderRadius:14, color:'#fff', fontSize:16, outline:'none',
  fontFamily:"'DM Sans',sans-serif", transition:'all 0.25s',
  boxShadow: focused===key ? '0 0 0 3px rgba(129,140,248,0.1), 0 0 20px rgba(129,140,248,0.08)' : 'none',
});

export default function Login({ onSwitch }) {
  const [form, setForm] = useState({ email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900);
  const update = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!form.email.trim() || !form.password) return setError('Please fill in all fields');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      if (!cred.user.emailVerified) {
        setError('Email not verified. Check your inbox for the verification link.');
        await auth.signOut();
      }
    } catch(e) {
      if (['auth/user-not-found','auth/wrong-password','auth/invalid-credential'].includes(e.code))
        setError('Invalid email or password.');
      else if (e.code==='auth/too-many-requests') setError('Too many attempts. Try again later.');
      else setError(e.message);
    }
    setLoading(false);
  };

  const sendReset = async () => {
    if (!form.email.trim()) return setError('Enter your email first');
    try { await sendPasswordResetEmail(auth, form.email.trim()); setResetSent(true); setError(''); }
    catch(e) { setError('Could not send reset email. Check the address.'); }
  };

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:isMobile?'column':'row', fontFamily:"'DM Sans',sans-serif", position:'relative', overflow:'hidden', background:'#07070f' }}>
      <SpaceBg intensity="full"/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input::placeholder{color:rgba(255,255,255,0.2);}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #0d0d1f inset!important;-webkit-text-fill-color:#fff!important;}
        @keyframes orbitSpin1{to{transform:rotate(360deg)}}
        @keyframes orbitSpin2{to{transform:rotate(-360deg)}}
        @keyframes coreGlow{0%,100%{box-shadow:0 0 40px rgba(79,70,229,.6)}50%{box-shadow:0 0 70px rgba(79,70,229,.9),0 0 100px rgba(219,39,119,.4)}}
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spinBtn{to{transform:rotate(360deg)}}
        @keyframes twinkleFeature{0%,100%{opacity:.6}50%{opacity:1}}
        .login-btn{transition:all .2s;}
        .login-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 48px rgba(79,70,229,.55)!important;}
        .login-btn:active:not(:disabled){transform:translateY(0);}
      `}</style>

      {/* Branding */}
      {!isMobile && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 48px', position:'relative', zIndex:1 }}>
          <div style={{ position:'relative', width:160, height:160, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:44 }}>
            <div style={{ position:'absolute', width:160, height:160, borderRadius:'50%', border:'1px solid rgba(129,140,248,0.2)', animation:'orbitSpin1 12s linear infinite' }}>
              <div style={{ position:'absolute', top:-5, left:'50%', transform:'translateX(-50%)', width:10, height:10, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 16px #818cf8, 0 0 32px rgba(129,140,248,.5)' }}/>
            </div>
            <div style={{ position:'absolute', width:120, height:120, borderRadius:'50%', border:'1px solid rgba(244,114,182,0.18)', animation:'orbitSpin2 8s linear infinite' }}>
              <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:8, height:8, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 12px #f472b6' }}/>
            </div>
            <div style={{ position:'absolute', width:86, height:86, borderRadius:'50%', border:'1px dashed rgba(52,211,153,0.15)', animation:'orbitSpin1 5s linear infinite' }}>
              <div style={{ position:'absolute', bottom:-3, right:4, width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 8px #34d399' }}/>
            </div>
            <div style={{ width:68, height:68, borderRadius:20, background:'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, animation:'coreGlow 2.5s ease-in-out infinite', position:'relative', zIndex:3, boxShadow:'0 0 50px rgba(79,70,229,.5)' }}>💬</div>
          </div>

          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:58, fontWeight:800, letterSpacing:'-2.5px', lineHeight:1, marginBottom:16, textAlign:'center', background:'linear-gradient(135deg,#e0e7ff 10%,#a5b4fc 45%,#f472b6 80%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'fadeSlideUp .7s .2s both' }}>Nex<br/>Chat</h1>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, lineHeight:1.7, textAlign:'center', maxWidth:300, marginBottom:44, animation:'fadeSlideUp .7s .4s both', opacity:0 }}>
            Connect across the cosmos. Find anyone by their unique @handle.
          </p>

          {[
            { icon:'🛸', title:'Real-time messaging', desc:'Zero lag, instant delivery' },
            { icon:'🌌', title:'Groups & DMs', desc:'Public rooms & private chats' },
            { icon:'🔭', title:'@Handle identity', desc:'Your unique cosmic address' },
            { icon:'⭐', title:'Seen receipts', desc:'Know when messages land' },
          ].map((f,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 18px', borderRadius:14, marginBottom:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', width:'100%', maxWidth:320, animation:`fadeSlideUp .6s ${.6+i*.1}s both`, opacity:0 }}>
              <span style={{ fontSize:20, animation:`twinkleFeature ${2+i*.3}s ease-in-out infinite` }}>{f.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.8)', fontFamily:"'Syne',sans-serif" }}>{f.title}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isMobile && <div style={{ width:1, background:'linear-gradient(to bottom,transparent,rgba(255,255,255,0.07) 20%,rgba(255,255,255,0.07) 80%,transparent)', flexShrink:0, position:'relative', zIndex:1 }}/>}

      {/* Form */}
      <div style={{ width:isMobile?'100%':500, flex:isMobile?1:'none', display:'flex', alignItems:'center', justifyContent:'center', padding:isMobile?'30px 18px':'48px 40px', position:'relative', zIndex:1 }}>
        <div style={{
          width:'100%', maxWidth:400,
          background:'rgba(13,13,26,0.85)', backdropFilter:'blur(32px)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:24, padding:isMobile?28:44,
          boxShadow:'0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
          animation:'scaleIn .5s cubic-bezier(0.34,1.56,0.64,1) both',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,70,229,0.12) 0%,transparent 70%)', top:-60, right:-60, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:150, height:150, borderRadius:'50%', background:'radial-gradient(circle,rgba(219,39,119,0.08) 0%,transparent 70%)', bottom:-40, left:-40, pointerEvents:'none' }}/>

          <div style={{ position:'relative', zIndex:1 }}>
            {isMobile && (
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ position:'relative', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'1px solid rgba(129,140,248,0.3)', animation:'orbitSpin1 12s linear infinite' }}>
                    <div style={{ position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)', width:6, height:6, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 8px #818cf8' }}/>
                  </div>
                  <div style={{ width:22, height:22, borderRadius:7, background:'linear-gradient(135deg,#3730a3,#be185d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, animation:'coreGlow 2.5s ease-in-out infinite' }}>💬</div>
                </div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, background:'linear-gradient(135deg,#e0e7ff,#a5b4fc,#f472b6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>NexChat</div>
              </div>
            )}

            <div style={{ fontSize:10, fontWeight:700, color:'#818cf8', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10, fontFamily:"'Syne',sans-serif" }}>MISSION CONTROL</div>
            <h2 style={{ fontSize:isMobile?24:30, fontWeight:800, color:'#fff', letterSpacing:'-0.5px', margin:'0 0 8px', fontFamily:"'Syne',sans-serif" }}>Welcome back</h2>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13, marginBottom:28 }}>Sign in to re-enter the cosmos</p>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8, letterSpacing:'0.12em', textTransform:'uppercase' }}>Email Address</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, opacity:.5 }}>✉</span>
                <input type="email" autoComplete="email" placeholder="you@cosmos.io" value={form.email} onChange={e=>update('email',e.target.value)} onFocus={()=>setFocused('email')} onBlur={()=>setFocused(null)} style={inp(focused,'email')}/>
              </div>
            </div>

            <div style={{ marginBottom:8 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8, letterSpacing:'0.12em', textTransform:'uppercase' }}>Password</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, opacity:.5 }}>🔒</span>
                <input type={showPass?'text':'password'} autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={e=>update('password',e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} onFocus={()=>setFocused('password')} onBlur={()=>setFocused(null)} style={{...inp(focused,'password'), paddingRight:44}}/>
                <button onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:15, padding:4 }}>{showPass?'🙈':'👁'}</button>
              </div>
            </div>

            <div style={{ textAlign:'right', marginBottom:20 }}>
              <span onClick={sendReset} style={{ fontSize:12, color:'#a5b4fc', cursor:'pointer', fontWeight:600 }}>Forgot password?</span>
            </div>

            {resetSent && <div style={{ background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:12, padding:'10px 14px', marginBottom:14, color:'#6ee7b7', fontSize:13 }}>✓ Reset email sent! Check your inbox.</div>}
            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'10px 14px', marginBottom:14, color:'#fca5a5', fontSize:13, display:'flex', gap:8 }}>⚠ {error}</div>}

            <button className="login-btn" onClick={handleLogin} disabled={loading} style={{
              width:'100%', padding:15, border:'none', borderRadius:14,
              background:loading?'rgba(255,255,255,0.07)':'linear-gradient(135deg,#3730a3 0%,#6d28d9 50%,#be185d 100%)',
              color:loading?'rgba(255,255,255,.4)':'#fff',
              fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer',
              fontFamily:"'Syne',sans-serif",
              boxShadow:loading?'none':'0 8px 32px rgba(79,70,229,.45)',
              position:'relative', overflow:'hidden',
            }}>
              {loading
                ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}><span style={{ width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',display:'inline-block',animation:'spinBtn .7s linear infinite' }}/>Launching…</span>
                : '🚀 Launch →'
              }
              {!loading && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)', backgroundSize:'200%', animation:'shimmer 2.5s linear infinite' }}/>}
            </button>

            <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'rgba(255,255,255,.35)' }}>
              New to NexChat?{' '}
              <span onClick={onSwitch} style={{ color:'#a5b4fc', cursor:'pointer', fontWeight:700 }}>Create account →</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}