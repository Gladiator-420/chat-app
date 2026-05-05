import { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { db } from './firebase';

const AVATAR_GRADIENTS = [
  ['#818cf8','#4f46e5'],['#f472b6','#db2777'],['#34d399','#059669'],
  ['#fb923c','#ea580c'],['#38bdf8','#0284c7'],['#a78bfa','#7c3aed'],
  ['#fbbf24','#d97706'],['#f87171','#dc2626'],['#6ee7b7','#0d9488'],
  ['#c4b5fd','#8b5cf6'],['#fdba74','#f97316'],['#67e8f9','#06b6d4'],
];

const THEMES = [
  { name:'Nebula',    bg:'linear-gradient(135deg,#0d0820,#1e1040,#0d0820)', accent:'#818cf8', banner:'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(167,139,250,0.2),rgba(219,39,119,0.1))',  nebula:'rgba(99,102,241,0.18)' },
  { name:'Aurora',   bg:'linear-gradient(135deg,#031a0e,#0a2e1a,#031a0e)', accent:'#34d399', banner:'linear-gradient(135deg,rgba(52,211,153,0.25),rgba(6,182,212,0.2),rgba(99,102,241,0.1))',   nebula:'rgba(52,211,153,0.15)' },
  { name:'Solar',    bg:'linear-gradient(135deg,#1a0f00,#2d1800,#1a0f00)', accent:'#fbbf24', banner:'linear-gradient(135deg,rgba(251,191,36,0.25),rgba(249,115,22,0.2),rgba(239,68,68,0.1))',   nebula:'rgba(251,191,36,0.12)' },
  { name:'Cosmic',   bg:'linear-gradient(135deg,#030318,#0a0a2e,#030318)', accent:'#60a5fa', banner:'linear-gradient(135deg,rgba(96,165,250,0.2),rgba(129,140,248,0.15),rgba(167,139,250,0.1))', nebula:'rgba(96,165,250,0.13)' },
];

/* ─── Starfield canvas ─────────────────────────────────── */
function Starfield({ accent }) {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      o: Math.random() * 0.7 + 0.2,
      speed: Math.random() * 0.015 + 0.005,
      phase: Math.random() * Math.PI * 2,
    }));
    let frame;
    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const pulse = Math.sin(t * s.speed + s.phase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.o * pulse})`;
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}/>;
}

/* ─── Orbital ring decoration ─────────────────────────── */
function OrbitalRings({ accent }) {
  return (
    <div style={{ position:'absolute', right:-30, top:-30, width:160, height:160, pointerEvents:'none', opacity:0.35 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          position:'absolute', inset: i*18, borderRadius:'50%',
          border:`1px solid ${accent}`,
          opacity: 1 - i*0.25,
          animation:`orbitalSpin ${6+i*3}s linear infinite ${i%2?'reverse':''}`,
        }}>
          <div style={{
            position:'absolute', width:6, height:6, borderRadius:'50%',
            background:accent, boxShadow:`0 0 8px ${accent}`,
            top:'50%', left:0, marginTop:-3, marginLeft:-3,
          }}/>
        </div>
      ))}
    </div>
  );
}

/* ─── Avatar ───────────────────────────────────────────── */
function Avatar({ profile, size = 80 }) {
  const [a, b] = AVATAR_GRADIENTS[profile.avatarColor ?? 0];
  const letter = (profile.displayName || profile.handle || '?')[0].toUpperCase();
  return (
    <div style={{ position:'relative', width:size+12, height:size+12, flexShrink:0 }}>
      {/* Outer glow */}
      <div style={{ position:'absolute', inset:-6, borderRadius:'50%', background:`radial-gradient(circle,${a}44,transparent 70%)`, filter:'blur(6px)' }}/>
      {/* Spinning conic ring */}
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`conic-gradient(${a},${b},${a})`, animation:'avatarRingRotate 4s linear infinite' }}/>
      {/* Inner gap */}
      <div style={{ position:'absolute', inset:3, borderRadius:'50%', background:'#080814' }}/>
      {profile.photoURL
        ? <img src={profile.photoURL} alt="" style={{ position:'absolute', inset:5, width:size, height:size, borderRadius:'50%', objectFit:'cover' }}/>
        : <div style={{ position:'absolute', inset:5, width:size, height:size, borderRadius:'50%', background:`linear-gradient(135deg,${a},${b})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:800, color:'#fff', fontFamily:"'Syne',sans-serif", letterSpacing:'-0.02em' }}>{letter}</div>
      }
    </div>
  );
}

/* ─── Holographic input ────────────────────────────────── */
const holoInput = {
  width:'100%', boxSizing:'border-box',
  padding:'11px 16px',
  background:'rgba(255,255,255,0.04)',
  border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:14,
  color:'#fff',
  fontSize:14,
  outline:'none',
  fontFamily:"'DM Sans',sans-serif",
  transition:'border-color .2s, box-shadow .2s',
};

/* ─── Section card ─────────────────────────────────────── */
function SectionCard({ icon, label, children }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18, padding:'18px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.4),transparent)' }}/>
      <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:12, letterSpacing:'0.1em', textTransform:'uppercase' }}>
        <span style={{ fontSize:14 }}>{icon}</span>{label}
      </label>
      {children}
    </div>
  );
}

/* ─── Stat pill ────────────────────────────────────────── */
function StatPill({ icon, value, label, accent }) {
  return (
    <div style={{ flex:1, padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, textAlign:'center', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${accent},transparent)` }}/>
      <div style={{ fontSize:18, marginBottom:2 }}>{icon}</div>
      <div style={{ fontSize:16, fontWeight:800, color:'#fff', fontFamily:"'Syne',sans-serif" }}>{value ?? '—'}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginTop:2 }}>{label}</div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────── */
export default function ProfileModal({ firebaseUser, profile: initProfile, onClose, onUpdated }) {
  const [profile, setProfile]         = useState(initProfile);
  const [tab, setTab]                 = useState('info');
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState({
    displayName: initProfile.displayName || '',
    bio:         initProfile.bio         || '',
    location:    initProfile.location    || '',
    website:     initProfile.website     || '',
    twitter:     initProfile.twitter     || '',
    github:      initProfile.github      || '',
    avatarColor: initProfile.avatarColor ?? 0,
    theme:       initProfile.theme       ?? 0,
  });
  const [saving, setSaving]           = useState(false);
  const [photoFile, setPhotoFile]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoError, setPhotoError]   = useState('');
  const [inputFocus, setInputFocus]   = useState(null);
  const fileRef = useRef();
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const activeTheme = THEMES[editing ? form.theme : profile.theme ?? 0];

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Image must be under 5MB'); return; }
    setPhotoError('');
    setPhotoFile(file);
    const r = new FileReader();
    r.onload = ev => setPhotoPreview(ev.target.result);
    r.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setUploadProgress(0);
    try {
      let photoURL = profile.photoURL || '';
      if (photoFile) {
        try {
          setUploadProgress(20);
          const storage = getStorage();
          const sRef = storageRef(storage, `avatars/${firebaseUser.uid}`);
          await uploadBytes(sRef, photoFile);
          setUploadProgress(80);
          photoURL = await getDownloadURL(sRef);
          setUploadProgress(100);
          await updateProfile(firebaseUser, { photoURL, displayName: form.displayName.trim() });
        } catch(e) { console.warn('Photo upload skipped:', e.message); }
      }
      const updates = {
        displayName: form.displayName.trim(),
        bio:         form.bio.trim(),
        location:    form.location.trim(),
        website:     form.website.trim(),
        twitter:     form.twitter.trim().replace('@',''),
        github:      form.github.trim().replace('@',''),
        avatarColor: form.avatarColor,
        theme:       form.theme,
        updatedAt:   serverTimestamp(),
        ...(photoURL && { photoURL }),
      };
      await updateDoc(doc(db, 'users', firebaseUser.uid), updates);
      const updated = { ...profile, ...updates, photoURL: photoURL || profile.photoURL };
      setProfile(updated);
      onUpdated(updated);
      setEditing(false); setPhotoFile(null); setPhotoPreview(null); setUploadProgress(0);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const cancelEdit = () => {
    setEditing(false); setPhotoFile(null); setPhotoPreview(null); setPhotoError('');
    setForm({
      displayName: profile.displayName||'', bio: profile.bio||'',
      location: profile.location||'', website: profile.website||'',
      twitter: profile.twitter||'', github: profile.github||'',
      avatarColor: profile.avatarColor??0, theme: profile.theme??0,
    });
  };

  const previewProfile = { ...profile, avatarColor: form.avatarColor, photoURL: photoPreview || profile.photoURL };

  const focusStyle = (key) => inputFocus === key
    ? { borderColor:`${activeTheme.accent}88`, boxShadow:`0 0 0 3px ${activeTheme.accent}22, inset 0 0 20px rgba(129,140,248,0.04)` }
    : {};

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:400,
      background:'rgba(0,0,0,0.9)',
      backdropFilter:'blur(20px) saturate(150%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'DM Sans',sans-serif", padding:20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        @keyframes avatarRingRotate  { to { transform: rotate(360deg) } }
        @keyframes modalIn           { from { opacity:0; transform:scale(0.84) translateY(28px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes fadeSlideUp       { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes shimmer           { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes orbitalSpin       { to { transform: rotate(360deg) } }
        @keyframes scanline          { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
        @keyframes pulseGlow         { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes borderFlow        { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes bannerFloat       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes nebulaShift       { 0%,100%{opacity:0.6;transform:scale(1) rotate(0deg)} 50%{opacity:1;transform:scale(1.05) rotate(2deg)} }

        .pm-scroll::-webkit-scrollbar        { width: 4px }
        .pm-scroll::-webkit-scrollbar-track  { background: transparent }
        .pm-scroll::-webkit-scrollbar-thumb  { background: rgba(129,140,248,0.3); border-radius:4px }

        .pm-tab:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.75) !important }
        .pm-tab-active { position: relative }
        .pm-tab-active::after {
          content:''; position:absolute; bottom:0; left:16px; right:16px; height:2px;
          background: linear-gradient(90deg, #818cf8, #f472b6);
          border-radius:2px;
        }

        .pm-save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(79,70,229,.55) !important;
        }
        .pm-save-btn:active:not(:disabled) { transform: translateY(0px) }

        .pm-color-swatch:hover { transform: scale(1.15) !important }
        .pm-theme-card:hover   { border-color: rgba(255,255,255,0.2) !important; transform: translateY(-1px) }

        .pm-input:focus { outline: none }
        .pm-input::placeholder { color: rgba(255,255,255,0.2) }

        .pm-social-link:hover { color: #c4b5fd !important }

        .scan-overlay {
          position:absolute; inset:0; overflow:hidden; border-radius:inherit; pointer-events:none;
        }
        .scan-overlay::after {
          content:''; position:absolute; left:0; right:0; height:60px;
          background:linear-gradient(to bottom,transparent,rgba(129,140,248,0.04),transparent);
          animation: scanline 5s linear infinite;
        }
      `}</style>

      <div style={{
        width:'100%', maxWidth:580,
        maxHeight:'92vh',
        background:'#07071a',
        border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:28,
        overflow:'hidden',
        boxShadow:'0 60px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(129,140,248,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation:'modalIn .38s cubic-bezier(0.34,1.56,0.64,1) both',
        position:'relative',
        display:'flex', flexDirection:'column',
      }}>

        {/* ── Scanline overlay ── */}
        <div className="scan-overlay"/>

        {/* ── Banner ── */}
        <div style={{
          height:148, position:'relative', overflow:'hidden', flexShrink:0,
          background: activeTheme.banner,
        }}>
          <Starfield accent={activeTheme.accent}/>
          {/* Deep nebula blobs */}
          <div style={{ position:'absolute', width:260, height:260, borderRadius:'50%', background:`radial-gradient(circle,${activeTheme.nebula},transparent 70%)`, top:-60, left:-40, animation:'nebulaShift 8s ease-in-out infinite', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:200, height:200, borderRadius:'50%', background:`radial-gradient(circle,${activeTheme.nebula},transparent 70%)`, top:-40, right:-20, animation:'nebulaShift 10s ease-in-out infinite reverse', pointerEvents:'none' }}/>
          {/* Grid overlay */}
          <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)`, backgroundSize:'28px 28px', pointerEvents:'none' }}/>
          {/* Orbital decoration */}
          <OrbitalRings accent={activeTheme.accent}/>
          {/* Scanline glow band */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:40, background:'linear-gradient(to top,rgba(7,7,26,0.8),transparent)' }}/>
          {/* Close btn */}
          <button onClick={onClose} style={{
            position:'absolute', top:14, right:14, width:38, height:38,
            borderRadius:13,
            background:'rgba(0,0,0,0.55)',
            border:'1px solid rgba(255,255,255,0.12)',
            color:'rgba(255,255,255,0.7)',
            fontSize:20, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(12px)',
            transition:'all .2s',
            zIndex:10,
          }}>×</button>
          {/* Theme badge */}
          <div style={{
            position:'absolute', top:14, left:16,
            padding:'4px 12px',
            borderRadius:20,
            background:'rgba(0,0,0,0.45)',
            border:`1px solid ${activeTheme.accent}55`,
            backdropFilter:'blur(8px)',
            fontSize:11, fontWeight:700, color:activeTheme.accent,
            letterSpacing:'0.1em', textTransform:'uppercase',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:activeTheme.accent, boxShadow:`0 0 6px ${activeTheme.accent}`, animation:'pulseGlow 2s ease-in-out infinite' }}/>
            {activeTheme.name}
          </div>
        </div>

        {/* ── Avatar + action row ── */}
        <div style={{ padding:'0 24px 0', marginTop:-56, display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:14, flexShrink:0 }}>
          <div style={{ position:'relative', cursor:editing ? 'pointer' : 'default', zIndex:2 }} onClick={editing ? () => fileRef.current.click() : undefined}>
            <Avatar profile={editing ? previewProfile : profile} size={86}/>
            {editing && (
              <div style={{
                position:'absolute', inset:5, borderRadius:'50%',
                background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
              }}>
                <span style={{ fontSize:20 }}>📷</span>
                <span style={{ fontSize:8, color:'#fff', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase' }}>CHANGE</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display:'none' }}/>
          </div>

          <div style={{ display:'flex', gap:8, paddingBottom:10, zIndex:2 }}>
            {editing ? (
              <>
                <button onClick={cancelEdit} style={{
                  padding:'9px 18px', borderRadius:12,
                  border:'1px solid rgba(255,255,255,0.1)',
                  background:'rgba(255,255,255,0.04)',
                  color:'rgba(255,255,255,0.5)', fontSize:13, cursor:'pointer', fontWeight:600,
                  transition:'all .2s',
                }}>Cancel</button>
                <button className="pm-save-btn" onClick={save} disabled={saving} style={{
                  padding:'9px 24px', borderRadius:12, border:'none',
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed,#be185d)',
                  backgroundSize:'200%',
                  color:'#fff', fontSize:13,
                  cursor:saving ? 'not-allowed' : 'pointer',
                  fontWeight:700, opacity:saving ? .7 : 1,
                  boxShadow:'0 6px 24px rgba(79,70,229,.45)',
                  position:'relative', overflow:'hidden',
                  transition:'all .25s',
                }}>
                  {saving
                    ? (uploadProgress > 0 && uploadProgress < 100 ? `Uploading ${uploadProgress}%…` : 'Saving…')
                    : '✦ Save Changes'}
                  {!saving && <div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)',backgroundSize:'200%',animation:'shimmer 2s linear infinite' }}/>}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={{
                padding:'9px 20px', borderRadius:12,
                border:`1px solid ${activeTheme.accent}55`,
                background:`${activeTheme.accent}15`,
                color:activeTheme.accent, fontSize:13, cursor:'pointer', fontWeight:700,
                transition:'all .2s',
                backdropFilter:'blur(8px)',
              }}>✦ Edit Profile</button>
            )}
          </div>
        </div>

        {photoError && (
          <div style={{ margin:'0 24px 12px', padding:'9px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, color:'#fca5a5', fontSize:12, flexShrink:0 }}>
            ⚠ {photoError}
          </div>
        )}

        {/* ── Identity block ── */}
        <div style={{ padding:'0 24px 16px', flexShrink:0 }}>
          {editing
            ? <input className="pm-input" value={form.displayName} onChange={e => update('displayName', e.target.value)}
                onFocus={()=>setInputFocus('name')} onBlur={()=>setInputFocus(null)}
                placeholder="Display name"
                style={{ ...holoInput, fontSize:22, fontWeight:800, fontFamily:"'Syne',sans-serif", marginBottom:8, ...focusStyle('name') }}/>
            : <h2 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 6px', fontFamily:"'Syne',sans-serif", letterSpacing:'-0.02em' }}>{profile.displayName || profile.handle}</h2>
          }
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, color:activeTheme.accent, fontWeight:700 }}>@{profile.handle}</span>
            <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.2)' }}/>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>
              Since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en',{month:'long',year:'numeric'}) : '—'}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.2)', backdropFilter:'blur(4px)' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px #10b981', animation:'pulseGlow 2s ease-in-out infinite' }}/>
              <span style={{ fontSize:11, color:'#34d399', fontWeight:700, letterSpacing:'0.06em' }}>ONLINE</span>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        {!editing && (
          <div style={{ display:'flex', gap:8, padding:'0 24px 16px', flexShrink:0, animation:'fadeSlideUp .3s both' }}>
            <StatPill icon="💬" value={profile.messageCount ?? 0} label="Messages" accent={activeTheme.accent}/>
            <StatPill icon="🌟" value={profile.reputation   ?? 0} label="Reputation" accent={activeTheme.accent}/>
            <StatPill icon="🚀" value={profile.roomsJoined  ?? 0} label="Rooms" accent={activeTheme.accent}/>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{
          display:'flex', gap:0, padding:'0 24px', flexShrink:0,
          borderTop:'1px solid rgba(255,255,255,0.05)',
          borderBottom:'1px solid rgba(255,255,255,0.05)',
          background:'rgba(255,255,255,0.02)',
        }}>
          {[
            { id:'info',       label:'Info',       icon:'🪐' },
            { id:'social',     label:'Social',     icon:'🌐' },
            { id:'appearance', label:'Appearance', icon:'🎨' },
          ].map(t => (
            <button
              key={t.id}
              className={`pm-tab ${tab === t.id ? 'pm-tab-active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{
                padding:'13px 18px', border:'none',
                background:'transparent',
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.38)',
                fontSize:13, fontWeight: tab === t.id ? 700 : 500,
                cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
                transition:'all .2s',
                display:'flex', alignItems:'center', gap:7,
              }}
            >
              <span style={{ fontSize:15 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="pm-scroll" style={{ overflowY:'auto', padding:'20px 24px 28px', animation:'fadeSlideUp .2s both' }}>

          {/* INFO */}
          {tab === 'info' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <SectionCard icon="🌌" label="About / Bio">
                {editing
                  ? <>
                      <textarea className="pm-input" value={form.bio} onChange={e => update('bio',e.target.value)}
                        onFocus={()=>setInputFocus('bio')} onBlur={()=>setInputFocus(null)}
                        placeholder="Tell the universe about yourself…" maxLength={200} rows={3}
                        style={{ ...holoInput, resize:'none', lineHeight:1.6, ...focusStyle('bio') }}/>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.25)', textAlign:'right', marginTop:5 }}>{form.bio.length}/200</div>
                    </>
                  : <p style={{ color:profile.bio?'rgba(255,255,255,0.72)':'rgba(255,255,255,0.2)', fontSize:14, lineHeight:1.75, margin:0, fontStyle:profile.bio?'normal':'italic' }}>{profile.bio||'No bio yet.'}</p>
                }
              </SectionCard>

              <SectionCard icon="📍" label="Location">
                {editing
                  ? <input className="pm-input" value={form.location} onChange={e=>update('location',e.target.value)}
                      onFocus={()=>setInputFocus('loc')} onBlur={()=>setInputFocus(null)}
                      placeholder="Planet Earth, Solar System"
                      style={{ ...holoInput, ...focusStyle('loc') }}/>
                  : <p style={{ color:profile.location?'rgba(255,255,255,0.65)':'rgba(255,255,255,0.2)', fontSize:14, margin:0, fontStyle:profile.location?'normal':'italic' }}>{profile.location||'Unknown corner of the universe'}</p>
                }
              </SectionCard>

              <SectionCard icon="🔗" label="Website">
                {editing
                  ? <input className="pm-input" value={form.website} onChange={e=>update('website',e.target.value)}
                      onFocus={()=>setInputFocus('web')} onBlur={()=>setInputFocus(null)}
                      placeholder="https://yoursite.com"
                      style={{ ...holoInput, ...focusStyle('web') }}/>
                  : profile.website
                    ? <a href={profile.website} target="_blank" rel="noreferrer" className="pm-social-link"
                        style={{ color:activeTheme.accent, fontSize:14, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                        {profile.website} <span style={{ opacity:.6 }}>↗</span>
                      </a>
                    : <p style={{ color:'rgba(255,255,255,0.2)', fontSize:14, margin:0, fontStyle:'italic' }}>Not set</p>
                }
              </SectionCard>
            </div>
          )}

          {/* SOCIAL */}
          {tab === 'social' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'twitter', icon:'🐦', label:'Twitter / X', prefix:'twitter.com/' },
                { key:'github',  icon:'🐙', label:'GitHub',      prefix:'github.com/'  },
              ].map(s => (
                <SectionCard key={s.key} icon={s.icon} label={s.label}>
                  {editing ? (
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)', fontSize:14, fontWeight:700, zIndex:1 }}>@</span>
                      <input className="pm-input" value={form[s.key]} onChange={e=>update(s.key,e.target.value)}
                        onFocus={()=>setInputFocus(s.key)} onBlur={()=>setInputFocus(null)}
                        placeholder="username"
                        style={{ ...holoInput, paddingLeft:32, ...focusStyle(s.key) }}/>
                    </div>
                  ) : (
                    profile[s.key]
                      ? <a href={`https://${s.prefix}${profile[s.key]}`} target="_blank" rel="noreferrer" className="pm-social-link"
                          style={{ color:activeTheme.accent, fontSize:14, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                          @{profile[s.key]} <span style={{ opacity:.5 }}>↗</span>
                        </a>
                      : <p style={{ color:'rgba(255,255,255,.2)', fontSize:14, margin:0, fontStyle:'italic' }}>Not connected</p>
                  )}
                </SectionCard>
              ))}

              <div style={{ padding:'14px 18px', background:'rgba(129,140,248,0.05)', border:'1px solid rgba(129,140,248,0.12)', borderRadius:16, marginTop:4 }}>
                <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13, margin:0, lineHeight:1.65 }}>
                  🔒 Social links are only visible to people you message
                </p>
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {tab === 'appearance' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Avatar color picker */}
              <SectionCard icon="🎨" label="Avatar Color">
                <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                  {AVATAR_GRADIENTS.map(([a, b], i) => (
                    <button key={i} className="pm-color-swatch" onClick={() => editing && update('avatarColor', i)} style={{
                      width:42, height:42, borderRadius:13,
                      background:`linear-gradient(135deg,${a},${b})`,
                      border: form.avatarColor === i ? '2.5px solid #fff' : '2.5px solid transparent',
                      cursor: editing ? 'pointer' : 'default',
                      boxShadow: form.avatarColor === i ? `0 0 22px ${a}88, 0 0 0 4px ${a}22` : 'none',
                      transform: form.avatarColor === i ? 'scale(1.18)' : 'scale(1)',
                      transition:'all .2s',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {form.avatarColor === i && <span style={{ color:'#fff', fontSize:17, textShadow:'0 1px 6px rgba(0,0,0,0.6)' }}>✓</span>}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* Theme selector */}
              <SectionCard icon="🌌" label="Chat Theme">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {THEMES.map((t, i) => {
                    const isActive = (editing ? form.theme : profile.theme ?? 0) === i;
                    return (
                      <button key={i} className="pm-theme-card" onClick={() => editing && update('theme', i)} style={{
                        padding:'14px 16px', borderRadius:16,
                        background: t.banner,
                        border:`1px solid ${isActive ? t.accent : 'rgba(255,255,255,0.07)'}`,
                        cursor: editing ? 'pointer' : 'default',
                        boxShadow: isActive ? `0 0 28px ${t.accent}44, inset 0 0 20px ${t.accent}08` : 'none',
                        transition:'all .22s',
                        position:'relative', overflow:'hidden', textAlign:'left',
                      }}>
                        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle at 30% 50%,${t.nebula},transparent 60%)`, pointerEvents:'none' }}/>
                        <div style={{ fontSize:13, fontWeight:800, color:'#fff', fontFamily:"'Syne',sans-serif", marginBottom:6, position:'relative' }}>{t.name}</div>
                        <div style={{ width:'70%', height:3, borderRadius:2, background:`linear-gradient(90deg,${t.accent},${t.accent}44)`, position:'relative' }}/>
                        {isActive && (
                          <div style={{ position:'absolute', top:9, right:10, width:20, height:20, borderRadius:7, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Live preview */}
              <SectionCard icon="👁" label="Preview">
                <div style={{
                  padding:'14px 16px',
                  background:'rgba(255,255,255,0.02)',
                  border:'1px solid rgba(255,255,255,0.06)',
                  borderRadius:16,
                  display:'flex', alignItems:'center', gap:16,
                  position:'relative', overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg,${activeTheme.nebula},transparent)`, pointerEvents:'none' }}/>
                  <Avatar profile={editing ? previewProfile : { ...profile, theme: form.theme }} size={52}/>
                  <div style={{ position:'relative' }}>
                    <div style={{ fontWeight:800, fontSize:16, color:'#fff', fontFamily:"'Syne',sans-serif", letterSpacing:'-0.01em' }}>
                      {form.displayName || profile.handle}
                    </div>
                    <div style={{ fontSize:13, color:AVATAR_GRADIENTS[form.avatarColor][0], fontWeight:600, marginTop:1 }}>@{profile.handle}</div>
                    {form.bio && <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:4, lineHeight:1.5 }}>{form.bio.slice(0,60)}{form.bio.length>60?'…':''}</div>}
                  </div>
                </div>
                {!editing && (
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.22)', fontStyle:'italic', margin:'12px 0 0', textAlign:'center' }}>
                    Click ✦ Edit Profile to customise your appearance
                  </p>
                )}
              </SectionCard>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}