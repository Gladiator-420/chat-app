import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import SpaceBg from './SpaceBg';

const inp = (focused, key) => ({
  width:'100%', padding:'13px 14px 13px 44px', boxSizing:'border-box',
  background:focused===key?'rgba(129,140,248,0.08)':'rgba(255,255,255,0.04)',
  border:`1px solid ${focused===key?'rgba(129,140,248,0.5)':'rgba(255,255,255,0.08)'}`,
  borderRadius:14, color:'#fff', fontSize:16, outline:'none',
  fontFamily:"'DM Sans',sans-serif", transition:'all 0.25s',
  boxShadow:focused===key?'0 0 0 3px rgba(129,140,248,0.1)':'none',
});

export default function Signup({ onSwitch }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ email:'', password:'', handle:'', displayName:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [handleStatus, setHandleStatus] = useState(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900);
  const update = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const checkHandle = async (val) => {
    const h = val.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if (h.length < 3) { setHandleStatus(null); return; }
    setCheckingHandle(true);
    try {
      const snap = await getDocs(query(collection(db,'users'),where('handle','==',h)));
      setHandleStatus(snap.empty ? 'available' : 'taken');
    } catch(e) { setHandleStatus(null); }
    setCheckingHandle(false);
  };

  const pwStrength = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strength = pwStrength(form.password);
  const strengthLabel = ['','Weak','Fair','Good','Strong','Excellent'][strength];
  const strengthColor = ['','#ef4444','#f59e0b','#3b82f6','#10b981','#34d399'][strength];

  const next = async () => {
    setError('');
    if (step === 0) {
      if (!form.email.trim()) return setError('Email is required');
      if (form.password.length < 6) return setError('Password must be at least 6 characters');
      setStep(1);
    } else if (step === 1) {
      const h = form.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
      if (h.length < 3) return setError('Handle must be 3+ characters');
      if (!form.displayName.trim()) return setError('Display name is required');
      if (handleStatus === 'taken') return setError(`@${h} is already taken`);
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db,'users'),where('handle','==',h)));
        if (!snap.empty) { setLoading(false); return setError(`@${h} is already taken`); }
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await sendEmailVerification(cred.user);
        await setDoc(doc(db,'users',cred.user.uid), {
          uid:cred.user.uid, email:form.email.trim().toLowerCase(),
          handle:h, displayHandle:form.handle.trim(),
          displayName:form.displayName.trim(),
          bio:'', avatarColor:Math.floor(Math.random()*8),
          location:'', website:'', photoURL:'',
          createdAt:Date.now(), online:false, dms:[],
        });
        setStep(2);
      } catch(e) {
        if (e.code==='auth/email-already-in-use') setError('Email already registered.');
        else setError(e.message);
      }
      setLoading(false);
    }
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
        @keyframes coreGlow{0%,100%{box-shadow:0 0 40px rgba(219,39,119,.5)}50%{box-shadow:0 0 70px rgba(219,39,119,.8),0 0 100px rgba(79,70,229,.3)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spinBtn{to{transform:rotate(360deg)}}
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes msgIn{from{opacity:0;transform:translateY(10px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes borderGlow{0%,100%{border-color:rgba(129,140,248,0.2)}50%{border-color:rgba(219,39,119,0.4)}}
        .signup-btn{transition:all .2s;}
        .signup-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 48px rgba(219,39,119,.45)!important;}
      `}</style>

      {/* Branding (desktop only) */}
      {!isMobile && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 48px', position:'relative', zIndex:1 }}>
          <div style={{ position:'relative', width:150, height:150, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:40 }}>
            <div style={{ position:'absolute', width:150, height:150, borderRadius:'50%', border:'1px solid rgba(244,114,182,0.2)', animation:'orbitSpin2 10s linear infinite' }}>
              <div style={{ position:'absolute', top:-5, left:'50%', transform:'translateX(-50%)', width:10, height:10, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 16px #f472b6' }}/>
            </div>
            <div style={{ position:'absolute', width:110, height:110, borderRadius:'50%', border:'1px solid rgba(129,140,248,0.2)', animation:'orbitSpin1 7s linear infinite' }}>
              <div style={{ position:'absolute', bottom:-4, right:6, width:8, height:8, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 12px #818cf8' }}/>
            </div>
            <div style={{ position:'absolute', width:78, height:78, borderRadius:'50%', border:'1px dashed rgba(251,191,36,0.15)', animation:'orbitSpin2 4s linear infinite' }}>
              <div style={{ position:'absolute', top:2, right:-3, width:6, height:6, borderRadius:'50%', background:'#fbbf24', boxShadow:'0 0 8px #fbbf24' }}/>
            </div>
            <div style={{ width:62, height:62, borderRadius:18, background:'linear-gradient(135deg,#be185d,#7c3aed,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, animation:'coreGlow 2s ease-in-out infinite', zIndex:3, boxShadow:'0 0 50px rgba(219,39,119,.4)' }}>💬</div>
          </div>

          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:52, fontWeight:800, letterSpacing:'-2px', lineHeight:1, marginBottom:14, textAlign:'center', background:'linear-gradient(135deg,#fbcfe8 10%,#f472b6 40%,#a5b4fc 80%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'fadeSlideUp .7s .2s both' }}>
            Join the<br/>Cosmos
          </h1>
          <p style={{ color:'rgba(255,255,255,.35)', fontSize:14, lineHeight:1.7, textAlign:'center', maxWidth:280, marginBottom:40, animation:'fadeSlideUp .7s .4s both', opacity:0 }}>
            Claim your @handle and start messaging across the universe
          </p>

          <div style={{ width:'100%', maxWidth:300, background:'rgba(13,13,26,0.7)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:16, animation:'fadeSlideUp .7s .6s both', opacity:0, backdropFilter:'blur(16px)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.3)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:12 }}>Live Preview</div>
            {[
              { h:'nova_42', msg:'Welcome to NexChat! 🌠', own:false, delay:'0s' },
              { h:'you', msg:'Finally found my @handle 🚀', own:true, delay:'0.4s' },
              { h:'stardust_k', msg:'Space awaits! ✨', own:false, delay:'0.8s' },
            ].map((m,i) => (
              <div key={i} style={{ display:'flex', gap:8, flexDirection:m.own?'row-reverse':'row', marginBottom:8, animation:`msgIn .4s ${m.delay} both` }}>
                <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${['#818cf8','#f472b6','#34d399'][i]},${['#6d28d9','#be185d','#059669'][i]})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>
                  {m.h[0].toUpperCase()}
                </div>
                <div style={{ maxWidth:'75%' }}>
                  {!m.own && <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginBottom:3, fontWeight:700 }}>@{m.h}</div>}
                  <div style={{ padding:'7px 11px', borderRadius:m.own?'12px 12px 3px 12px':'12px 12px 12px 3px', background:m.own?'linear-gradient(135deg,#4f46e5,#be185d)':'rgba(255,255,255,.07)', color:'#fff', fontSize:12, border:m.own?'none':'1px solid rgba(255,255,255,.07)' }}>
                    {m.msg}
                  </div>
                  {m.own && <div style={{ textAlign:'right', fontSize:9, color:'#818cf8', marginTop:2 }}>✓✓ Seen</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isMobile && <div style={{ width:1, background:'linear-gradient(to bottom,transparent,rgba(255,255,255,0.07) 20%,rgba(255,255,255,0.07) 80%,transparent)', flexShrink:0, position:'relative', zIndex:1 }}/>}

      {/* Form */}
      <div style={{ width:isMobile?'100%':500, flex:isMobile?1:'none', display:'flex', alignItems:'center', justifyContent:'center', padding:isMobile?'30px 18px':'48px 40px', position:'relative', zIndex:1 }}>
        <div style={{
          width:'100%', maxWidth:400,
          background:'rgba(13,13,26,0.85)', backdropFilter:'blur(32px)',
          border:'1px solid rgba(255,255,255,0.08)', borderRadius:24, padding:isMobile?28:44,
          boxShadow:'0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation:'scaleIn .5s cubic-bezier(0.34,1.56,0.64,1) both',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(219,39,119,0.1) 0%,transparent 70%)', top:-60, right:-60, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:150, height:150, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,70,229,0.07) 0%,transparent 70%)', bottom:-40, left:-40, pointerEvents:'none' }}/>

          <div style={{ position:'relative', zIndex:1 }}>
            {isMobile && (
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                <div style={{ position:'relative', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'1px solid rgba(244,114,182,0.3)', animation:'orbitSpin2 10s linear infinite' }}>
                    <div style={{ position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)', width:6, height:6, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 8px #f472b6' }}/>
                  </div>
                  <div style={{ width:22, height:22, borderRadius:7, background:'linear-gradient(135deg,#be185d,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, animation:'coreGlow 2s ease-in-out infinite' }}>💬</div>
                </div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, background:'linear-gradient(135deg,#fbcfe8,#f472b6,#a5b4fc)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Join NexChat</div>
              </div>
            )}

            <div style={{ display:'flex', gap:6, marginBottom:24 }}>
              {['Account','Identity','Done!'].map((s,i) => (
                <div key={i} style={{ flex:1 }}>
                  <div style={{ height:3, borderRadius:3, background:i<=step?'linear-gradient(90deg,#4f46e5,#db2777)':'rgba(255,255,255,0.08)', transition:'background .4s', marginBottom:5 }}/>
                  <div style={{ fontSize:10, color:i<=step?'#a5b4fc':'rgba(255,255,255,.25)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{s}</div>
                </div>
              ))}
            </div>

            {step === 0 && (
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10, fontFamily:"'Syne',sans-serif" }}>STEP 1 / 2</div>
                <h2 style={{ fontSize:isMobile?22:27, fontWeight:800, color:'#fff', margin:'0 0 6px', fontFamily:"'Syne',sans-serif" }}>Create account</h2>
                <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginBottom:24 }}>Set up your cosmic credentials</p>

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.4)', marginBottom:7, letterSpacing:'0.12em', textTransform:'uppercase' }}>Email</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:.5 }}>✉</span>
                    <input type="email" autoComplete="email" placeholder="you@cosmos.io" value={form.email} onChange={e=>update('email',e.target.value)} onFocus={()=>setFocused('email')} onBlur={()=>setFocused(null)} style={inp(focused,'email')}/>
                  </div>
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.4)', marginBottom:7, letterSpacing:'0.12em', textTransform:'uppercase' }}>Password</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:.5 }}>🔒</span>
                    <input type={showPass?'text':'password'} autoComplete="new-password" placeholder="Min. 6 characters" value={form.password} onChange={e=>update('password',e.target.value)} onKeyDown={e=>e.key==='Enter'&&next()} onFocus={()=>setFocused('password')} onBlur={()=>setFocused(null)} style={{...inp(focused,'password'), paddingRight:44}}/>
                    <button onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,255,255,.35)', cursor:'pointer', fontSize:14, padding:4 }}>{showPass?'🙈':'👁'}</button>
                  </div>
                  {form.password.length > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ display:'flex', gap:3, marginBottom:4 }}>
                        {[1,2,3,4,5].map(i=><div key={i} style={{ flex:1, height:3, borderRadius:3, background:strength>=i?strengthColor:'rgba(255,255,255,0.08)', transition:'background .3s' }}/>)}
                      </div>
                      <span style={{ fontSize:11, color:strengthColor, fontWeight:600 }}>{strengthLabel}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'#818cf8', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10, fontFamily:"'Syne',sans-serif" }}>STEP 2 / 2</div>
                <h2 style={{ fontSize:isMobile?22:27, fontWeight:800, color:'#fff', margin:'0 0 6px', fontFamily:"'Syne',sans-serif" }}>Your identity</h2>
                <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, marginBottom:24 }}>How the universe knows you</p>

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.4)', marginBottom:7, letterSpacing:'0.12em', textTransform:'uppercase' }}>Display Name</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:.5 }}>🌟</span>
                    <input placeholder="Your name in the stars" value={form.displayName} onChange={e=>update('displayName',e.target.value)} onFocus={()=>setFocused('name')} onBlur={()=>setFocused(null)} style={inp(focused,'name')}/>
                  </div>
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.4)', marginBottom:7, letterSpacing:'0.12em', textTransform:'uppercase' }}>Unique Handle</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#818cf8', fontWeight:800, fontSize:15 }}>@</span>
                    <input placeholder="your_handle" value={form.handle} onChange={e=>{ update('handle',e.target.value); checkHandle(e.target.value); }} onFocus={()=>setFocused('handle')} onBlur={()=>setFocused(null)} style={inp(focused,'handle')}/>
                    <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:14 }}>
                      {checkingHandle ? '⟳' : handleStatus==='available' ? <span style={{color:'#34d399'}}>✓</span> : handleStatus==='taken' ? <span style={{color:'#f87171'}}>✗</span> : null}
                    </span>
                  </div>
                  <p style={{ fontSize:11, color:handleStatus==='available'?'#34d399':handleStatus==='taken'?'#f87171':'rgba(255,255,255,.25)', marginTop:5 }}>
                    {handleStatus==='available'?'✓ Handle available!':handleStatus==='taken'?'✗ Handle taken, try another':'Letters, numbers & underscores only'}
                  </p>
                </div>
              </>
            )}

            {step === 2 && (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:52, marginBottom:16, animation:'coreGlow 2s ease-in-out infinite', display:'inline-block' }}>🚀</div>
                <h2 style={{ color:'#fff', fontSize:isMobile?20:22, fontWeight:800, margin:'0 0 10px', fontFamily:"'Syne',sans-serif" }}>You're almost in!</h2>
                <p style={{ color:'rgba(255,255,255,.45)', fontSize:14, lineHeight:1.7, marginBottom:22, wordBreak:'break-word' }}>
                  Verification sent to<br/><strong style={{color:'#a5b4fc'}}>{form.email}</strong>
                </p>
                <div style={{ background:'rgba(129,140,248,0.07)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:14, padding:'14px 18px', marginBottom:24, animation:'borderGlow 3s ease-in-out infinite' }}>
                  <div style={{ color:'rgba(255,255,255,.4)', fontSize:11, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>Your cosmic handle</div>
                  <div style={{ color:'#a5b4fc', fontWeight:800, fontSize:isMobile?18:22, fontFamily:"'Syne',sans-serif", wordBreak:'break-all' }}>@{form.handle.trim().toLowerCase()}</div>
                </div>
                <button onClick={onSwitch} className="signup-btn" style={{ width:'100%', padding:14, border:'none', borderRadius:14, background:'linear-gradient(135deg,#3730a3,#be185d)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:"'Syne',sans-serif", boxShadow:'0 8px 32px rgba(79,70,229,.4)' }}>
                  🚀 Go to Sign In
                </button>
              </div>
            )}

            {step < 2 && (
              <>
                {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'10px 14px', marginBottom:14, color:'#fca5a5', fontSize:13 }}>⚠ {error}</div>}
                <button className="signup-btn" onClick={next} disabled={loading} style={{
                  width:'100%', padding:15, border:'none', borderRadius:14,
                  background:loading?'rgba(255,255,255,0.07)':'linear-gradient(135deg,#3730a3 0%,#6d28d9 50%,#be185d 100%)',
                  color:loading?'rgba(255,255,255,.4)':'#fff',
                  fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer',
                  fontFamily:"'Syne',sans-serif", position:'relative', overflow:'hidden',
                  boxShadow:loading?'none':'0 8px 32px rgba(79,70,229,.45)',
                }}>
                  {loading
                    ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}><span style={{ width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',display:'inline-block',animation:'spinBtn .7s linear infinite' }}/>Creating…</span>
                    : step===0 ? 'Continue →' : '🌌 Create Account →'}
                  {!loading && <div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)',backgroundSize:'200%',animation:'shimmer 2.5s linear infinite' }}/>}
                </button>
                {step===1 && <button onClick={()=>{setStep(0);setError('');}} style={{ width:'100%', marginTop:10, padding:11, border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, background:'transparent', color:'rgba(255,255,255,.4)', fontSize:13, cursor:'pointer' }}>← Back</button>}
                <p style={{ textAlign:'center', marginTop:18, fontSize:13, color:'rgba(255,255,255,.35)' }}>
                  Have an account?{' '}<span onClick={onSwitch} style={{ color:'#a5b4fc', cursor:'pointer', fontWeight:700 }}>Sign in</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}