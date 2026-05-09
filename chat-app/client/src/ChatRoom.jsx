import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs, where, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, getDoc, setDoc, deleteField, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import ProfileModal from './ProfileModal';
import SpaceBg from './SpaceBg';

const GRADIENTS = [
  ['#818cf8','#4f46e5'],['#f472b6','#db2777'],['#34d399','#059669'],
  ['#fb923c','#ea580c'],['#38bdf8','#0284c7'],['#a78bfa','#7c3aed'],
  ['#fbbf24','#d97706'],['#f87171','#dc2626'],['#6ee7b7','#0d9488'],
  ['#c4b5fd','#8b5cf6'],['#fdba74','#f97316'],['#67e8f9','#06b6d4'],
];

const GROUP_ICONS = ['🌌','🚀','🛸','⭐','🌙','💫','🔭','🌠','🪐','🌊','🔥','💎','🎯','⚡','🎮','🎵','🌈','🦋','🐉','🏆'];

const getGrad = (name='?') => GRADIENTS[(name.charCodeAt(0)+(name.charCodeAt(1)||0)) % GRADIENTS.length];
const getRoomId = (a,b) => [a,b].sort().join('__');

const fmtTime = ts => {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
};
const fmtLastSeen = ts => {
  if (!ts) return 'a while ago';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now()-d.getTime();
  if (diff<60000) return 'just now';
  if (diff<3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff<86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString();
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name='?', size=36, photoURL, avatarColor, online }) {
  const [a,b] = avatarColor!=null ? GRADIENTS[avatarColor%GRADIENTS.length] : getGrad(name);
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{ position:'relative', width:size+4, height:size+4 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`conic-gradient(${a},${b},${a})`, animation:'avatarRingRotate 4s linear infinite' }}/>
        {photoURL
          ? <img src={photoURL} alt="" style={{ position:'absolute', inset:2, width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid #0d0d1f' }}/>
          : <div style={{ position:'absolute', inset:2, width:size, height:size, borderRadius:'50%', background:`linear-gradient(135deg,${a},${b})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:800, color:'#fff', fontFamily:"'Syne',sans-serif" }}>{name[0].toUpperCase()}</div>
        }
      </div>
      {online!=null && <div style={{ position:'absolute', bottom:2, right:2, width:10, height:10, borderRadius:'50%', background:online?'#10b981':'rgba(255,255,255,0.2)', border:'2px solid #0d0d1f', boxShadow:online?'0 0 6px #10b981':'none' }}/>}
    </div>
  );
}

// ── Message ───────────────────────────────────────────────────────────────────
// usersMap is passed in so avatars always reflect the latest profile photo/color
function Message({ msg, isOwn, prevSameUser, onDelete, currentUid, isMobile, usersMap }) {
  const [showActions, setShowActions] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const seen = (msg.seenBy||[]).some(uid=>uid!==currentUid);
  const longPressRef = useRef(null);

  if (msg.system) return (
    <div style={{ textAlign:'center', padding:'8px 0', display:'flex', alignItems:'center', gap:10, opacity:.6 }}>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>{msg.text}</span>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
    </div>
  );

  const [a] = getGrad(msg.senderHandle||'?');

  // ── Live avatar: prefer usersMap data over stale message snapshot ──
  const liveUser = usersMap?.[msg.sender];
  const displayPhoto = liveUser?.photoURL ?? msg.senderPhoto ?? '';
  const displayAvatarColor = liveUser?.avatarColor ?? msg.senderAvatarColor;

  // Long press for mobile
  const handleTouchStart = () => {
    if (!isOwn) return;
    longPressRef.current = setTimeout(() => {
      setShowActions(true);
    }, 500);
  };
  const handleTouchEnd = () => {
    clearTimeout(longPressRef.current);
  };

  const handleTap = () => {
    if (isMobile && isOwn) {
      setShowActions(s => !s);
      setConfirmDel(false);
    }
  };

  return (
    <div
      onMouseEnter={()=>!isMobile && setShowActions(true)}
      onMouseLeave={()=>{ if(!isMobile){setShowActions(false);setConfirmDel(false);} }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
      style={{ display:'flex', gap:isMobile?6:10, flexDirection:isOwn?'row-reverse':'row', marginBottom:prevSameUser?3:14, animation:'msgIn .22s cubic-bezier(0.34,1.56,0.64,1) both', position:'relative' }}>

      <div style={{ width:isMobile?32:40, flexShrink:0, display:'flex', alignItems:'flex-end' }}>
        {!prevSameUser && !isOwn && (
          <Avatar
            name={msg.senderHandle||'?'}
            size={isMobile?28:34}
            photoURL={displayPhoto}
            avatarColor={displayAvatarColor}
          />
        )}
      </div>

      <div style={{ maxWidth:isMobile?'78%':'62%', display:'flex', flexDirection:'column', alignItems:isOwn?'flex-end':'flex-start', gap:3 }}>
        {!prevSameUser && (
          <div style={{ display:'flex', alignItems:'baseline', gap:8, flexDirection:isOwn?'row-reverse':'row' }}>
            <span style={{ fontSize:12, fontWeight:700, color:isOwn?'#a5b4fc':a, fontFamily:"'Syne',sans-serif" }}>{isOwn?'You':`@${msg.senderHandle||'?'}`}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.22)' }}>{fmtTime(msg.timestamp)}</span>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8, flexDirection:isOwn?'row-reverse':'row' }}>
          <div style={{
            padding:isMobile?'8px 12px':'10px 15px',
            borderRadius:isOwn?'20px 20px 5px 20px':'20px 20px 20px 5px',
            background:isOwn
              ? 'linear-gradient(135deg,#3730a3 0%,#6d28d9 50%,#be185d 100%)'
              : 'rgba(255,255,255,0.06)',
            border:isOwn?'none':'1px solid rgba(255,255,255,0.08)',
            color:'#fff', fontSize:isMobile?13:14, lineHeight:1.55, wordBreak:'break-word',
            boxShadow:isOwn?'0 4px 24px rgba(79,70,229,0.35), 0 0 0 1px rgba(129,140,248,0.1)':'0 2px 8px rgba(0,0,0,0.3)',
            transition:'transform .15s',
            transform:showActions&&isOwn?'scale(1.015)':'scale(1)',
            fontFamily:"'DM Sans',sans-serif",
            position:'relative', overflow:'hidden',
            userSelect:'none',
          }}>
            {msg.text}
            {isOwn && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)', backgroundSize:'200%', animation:'shimmer 3s linear infinite' }}/>}
          </div>

          {isOwn && showActions && (
            !confirmDel
              ? <button
                  onClick={(e)=>{e.stopPropagation();setConfirmDel(true);}}
                  style={{ width:32, height:32, borderRadius:10, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.15)', color:'#f87171', cursor:'pointer', fontSize:14, transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  🗑
                </button>
              : <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  <button onClick={(e)=>{e.stopPropagation();onDelete(msg.id);setShowActions(false);setConfirmDel(false);}} style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'rgba(239,68,68,0.7)', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>Delete</button>
                  <button onClick={(e)=>{e.stopPropagation();setConfirmDel(false);setShowActions(false);}} style={{ padding:'5px 8px', borderRadius:8, border:'none', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:11 }}>✕</button>
                </div>
          )}
        </div>

        {isOwn && (
          <div style={{ fontSize:10, color:seen?'#818cf8':'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
            {seen ? <><span style={{color:'#a5b4fc'}}>✓✓</span><span style={{color:'#a5b4fc',fontWeight:600}}>Seen</span></> : <><span>✓</span><span>Sent</span></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots({ users }) {
  if (!users.length) return null;
  const display = users.length === 1
    ? `@${users[0]} is typing`
    : users.length === 2
      ? `@${users[0]} and @${users[1]} are typing`
      : `@${users[0]} and ${users.length-1} others are typing`;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 4px 10px', color:'rgba(255,255,255,0.55)', fontSize:12, animation:'fadeSlideUp .25s both' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'rgba(129,140,248,0.08)', border:'1px solid rgba(129,140,248,0.15)', borderRadius:14 }}>
        <div style={{ display:'flex', gap:3 }}>
          {[0,1,2].map(i=><div key={i} style={{ width:5,height:5,borderRadius:'50%',background:'#a5b4fc',animation:`typingBounce 1.1s ${i*.15}s ease-in-out infinite` }}/>)}
        </div>
        <span style={{ color:'#c7d2fe', fontWeight:600 }}>{display}…</span>
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:"'DM Sans',sans-serif",padding:16 }}>
      <div style={{ width:'100%',maxWidth:wide?560:420,background:'#0c0c1e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:24,padding:0,boxShadow:'0 40px 80px rgba(0,0,0,0.8)',animation:'modalIn .25s cubic-bezier(0.34,1.56,0.64,1) both',position:'relative',overflow:'hidden',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
        <div style={{ position:'absolute',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle,rgba(79,70,229,0.12) 0%,transparent 70%)',top:-60,right:-60,pointerEvents:'none' }}/>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px 16px',position:'relative',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0 }}>
          <h3 style={{ color:'#fff',margin:0,fontSize:17,fontWeight:800,fontFamily:"'Syne',sans-serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.5)',fontSize:18,cursor:'pointer',width:32,height:32,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
        </div>
        <div style={{ position:'relative',overflowY:'auto',padding:'20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

const modalInp = { width:'100%',padding:'11px 14px',boxSizing:'border-box',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:11,color:'#fff',fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif",transition:'border-color .2s' };
function GradBtn({ onClick,disabled,children,full,danger}) {
  return <button onClick={onClick} disabled={disabled} style={{ padding:full?'13px':'8px 16px',width:full?'100%':'auto',background:danger?'linear-gradient(135deg,#7f1d1d,#dc2626)':'linear-gradient(135deg,#3730a3,#be185d)',border:'none',borderRadius:11,color:'#fff',fontWeight:700,cursor:disabled?'not-allowed':'pointer',fontSize:13,fontFamily:"'Syne',sans-serif",opacity:disabled?.6:1,boxShadow:danger?'0 4px 16px rgba(220,38,38,.3)':'0 4px 16px rgba(79,70,229,.35)',transition:'all .15s' }}>{children}</button>;
}

// ── Group Info Modal (full-featured) ──────────────────────────────────────────
function GroupInfoModal({ group, currentUser, presenceMap, onClose, onUpdated, onDeleteGroup, onLeaveGroup }) {
  const [tab, setTab] = useState('info');
  const [name, setName] = useState(group.name || '');
  const [bio, setBio] = useState(group.bio || '');
  const [icon, setIcon] = useState(group.icon || '🌌');
  const [hi, setHi] = useState('');
  const [handles, setHandles] = useState(group.memberHandles || []);
  const [uids, setUids] = useState(group.members || []);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const isOwner = group.createdBy === currentUser.uid;

  const add = async () => {
    const h = hi.trim().toLowerCase().replace('@','');
    if (!h || handles.includes(h)) return setErr('Invalid or already a member');
    try {
      const snap = await getDocs(query(collection(db,'users'), where('handle','==',h)));
      if (snap.empty) return setErr(`@${h} not found`);
      setHandles(p=>[...p,h]); setUids(p=>[...p,snap.docs[0].id]); setHi(''); setErr('');
    } catch(e) { setErr('Search failed'); }
  };

  const removeMember = (idx) => {
    if (uids[idx] === currentUser.uid) return setErr("Can't remove yourself");
    if (uids[idx] === group.createdBy) return setErr("Can't remove group creator");
    setHandles(p=>p.filter((_,j)=>j!==idx));
    setUids(p=>p.filter((_,j)=>j!==idx));
  };

  const save = async () => {
    if (!name.trim()) return setErr('Group name required');
    setLoading(true);
    try {
      await updateDoc(doc(db,'groups',group.id), { name:name.trim(), bio:bio.trim(), icon, members:uids, memberHandles:handles });
      onUpdated({ ...group, name:name.trim(), bio:bio.trim(), icon, members:uids, memberHandles:handles });
    } catch(e) { setErr('Save failed'); }
    setLoading(false);
  };

  const filteredMembers = handles.filter(h => h.toLowerCase().includes(memberSearch.toLowerCase()));

  const tabs = [
    { id:'info', label:'Info', icon:'ℹ️' },
    { id:'members', label:'Members', icon:'👥' },
    ...(isOwner ? [{ id:'settings', label:'Settings', icon:'⚙️' }] : []),
    { id:'danger', label:'Danger', icon:'⚠️' },
  ];

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:"'DM Sans',sans-serif",padding:16 }}>
      <div style={{ width:'100%',maxWidth:520,background:'#0a0a1e',border:'1px solid rgba(255,255,255,0.08)',borderRadius:28,overflow:'visible',maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 60px 120px rgba(0,0,0,0.9)',animation:'modalIn .28s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        
        {/* Header banner */}
        <div style={{ position:'relative',padding:'28px 24px 20px',background:'linear-gradient(135deg,rgba(55,48,163,0.4),rgba(109,40,217,0.3),rgba(190,24,93,0.2))',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,borderRadius:'28px 28px 0 0',overflow:'hidden' }}>
          <div style={{ position:'absolute',inset:0,backgroundImage:'radial-gradient(circle at 20% 50%,rgba(129,140,248,0.15),transparent 60%)',pointerEvents:'none' }}/>
          <button onClick={onClose} style={{ position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',fontSize:18,cursor:'pointer',width:34,height:34,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
          <div style={{ display:'flex',alignItems:'center',gap:16,position:'relative' }}>
            <div style={{ width:64,height:64,borderRadius:20,background:'linear-gradient(135deg,rgba(129,140,248,0.25),rgba(244,114,182,0.2))',border:'1px solid rgba(129,140,248,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,flexShrink:0,boxShadow:'0 8px 32px rgba(79,70,229,0.3)' }}>{icon||'🌌'}</div>
            <div>
              <div style={{ fontSize:20,fontWeight:800,color:'#fff',fontFamily:"'Syne',sans-serif",marginBottom:4 }}>{group.name}</div>
              {group.bio && <div style={{ fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.5,maxWidth:280 }}>{group.bio}</div>}
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:4 }}>{handles.length} members · {isOwner ? '👑 You own this' : 'Member'}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.015)',flexShrink:0,overflowX:'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'12px 16px',border:'none',background:'transparent',color:tab===t.id?'#fff':'rgba(255,255,255,0.35)',fontSize:13,fontWeight:tab===t.id?700:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6,borderBottom:tab===t.id?'2px solid #818cf8':'2px solid transparent',whiteSpace:'nowrap',transition:'all .2s' }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflowY:'auto',padding:'20px 22px 24px',flex:1,borderRadius:'0 0 28px 28px' }}>
          
          {/* INFO TAB */}
          {tab === 'info' && (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>

              {/* ── Icon picker: always rendered, pointer-events gated by isOwner ── */}
              <div>
                <label style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',textTransform:'uppercase',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                  <span>Group Icon</span>
                  {!isOwner && <span style={{ fontSize:10,color:'rgba(255,255,255,0.2)',fontWeight:400,letterSpacing:0,textTransform:'none' }}>Only the owner can change this</span>}
                </label>
                <div style={{ display:'flex',flexWrap:'wrap',gap:8,padding:'14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,pointerEvents:isOwner?'auto':'none',opacity:isOwner?1:0.5 }}>
                  {GROUP_ICONS.map(em => (
                    <button
                      key={em}
                      onClick={()=>{ if(isOwner) setIcon(em); }}
                      style={{
                        width:40,height:40,borderRadius:11,
                        border:icon===em?'2px solid #818cf8':'2px solid transparent',
                        background:icon===em?'rgba(129,140,248,0.2)':'rgba(255,255,255,0.04)',
                        cursor:isOwner?'pointer':'default',
                        fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',
                        transition:'all .15s',
                        transform:icon===em?'scale(1.15)':'scale(1)',
                        boxShadow:icon===em?'0 0 12px rgba(129,140,248,0.5)':'none',
                      }}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Owner-only: name, bio, save ── */}
              {isOwner && (
                <>
                  <div>
                    <label style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:8 }}>Group Name</label>
                    <input value={name} onChange={e=>setName(e.target.value)} style={modalInp} placeholder="Group name…"/>
                  </div>
                  <div>
                    <label style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:8 }}>Group Bio</label>
                    <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} maxLength={200} style={{ ...modalInp,resize:'none',lineHeight:1.6 }} placeholder="What's this group about?…"/>
                    <div style={{ fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'right',marginTop:4 }}>{bio.length}/200</div>
                  </div>
                  {err && <p style={{ color:'#fca5a5',fontSize:13,margin:0 }}>⚠ {err}</p>}
                  <GradBtn onClick={save} disabled={loading} full>{loading ? 'Saving…' : '✦ Save Changes'}</GradBtn>
                </>
              )}

              {/* ── Non-owner: bio read-only ── */}
              {!isOwner && (
                <div style={{ padding:'16px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14 }}>
                  <div style={{ fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.7 }}>
                    {group.bio || <span style={{ fontStyle:'italic',color:'rgba(255,255,255,0.25)' }}>No group bio yet.</span>}
                  </div>
                  <div style={{ marginTop:12,fontSize:12,color:'rgba(255,255,255,0.3)' }}>Created by @{group.memberHandles?.[group.members?.indexOf?.(group.createdBy)] || 'unknown'}</div>
                </div>
              )}
            </div>
          )}

          {/* MEMBERS TAB */}
          {tab === 'members' && (
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              <input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} style={{ ...modalInp,marginBottom:4 }} placeholder="Search members…"/>
              {isOwner && (
                <div style={{ display:'flex',gap:8 }}>
                  <div style={{ position:'relative',flex:1 }}>
                    <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#818cf8',fontWeight:800,fontSize:13 }}>@</span>
                    <input placeholder="add handle…" value={hi} onChange={e=>setHi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} style={{ ...modalInp,paddingLeft:30 }}/>
                  </div>
                  <GradBtn onClick={add}>Add</GradBtn>
                </div>
              )}
              {err && <p style={{ color:'#fca5a5',fontSize:13,margin:0 }}>⚠ {err}</p>}
              <div style={{ display:'flex',flexDirection:'column',gap:6,maxHeight:300,overflowY:'auto' }}>
                {handles.filter(h=>h.toLowerCase().includes(memberSearch.toLowerCase())).map((h,i) => {
                  const uid = uids[i];
                  const isOnline = uid === currentUser.uid || !!presenceMap[uid]?.online;
                  const isCreator = uid === group.createdBy;
                  const isMe = uid === currentUser.uid;
                  return (
                    <div key={h} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:13 }}>
                      <Avatar name={h} size={34} online={isOnline}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:700,color:'#fff',fontFamily:"'Syne',sans-serif" }}>@{h}{isMe?' (you)':''}</div>
                        {isCreator && <div style={{ fontSize:10,color:'#fbbf24',fontWeight:700,letterSpacing:'0.08em' }}>👑 OWNER</div>}
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:isOnline?'#10b981':'rgba(255,255,255,0.15)',boxShadow:isOnline?'0 0 6px #10b981':'none' }}/>
                        {isOwner && !isCreator && !isMe && (
                          <button onClick={()=>removeMember(i)} style={{ padding:'4px 10px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.1)',color:'#f87171',cursor:'pointer',fontSize:11,fontWeight:700,transition:'all .15s' }}>Remove</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isOwner && (
                <GradBtn onClick={save} disabled={loading} full>{loading ? 'Saving…' : '✦ Save Member Changes'}</GradBtn>
              )}
            </div>
          )}

          {/* SETTINGS TAB (owner only) */}
          {tab === 'settings' && isOwner && (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div style={{ padding:'16px',background:'rgba(129,140,248,0.06)',border:'1px solid rgba(129,140,248,0.15)',borderRadius:16 }}>
                <div style={{ fontSize:13,fontWeight:700,color:'#a5b4fc',marginBottom:8 }}>🔒 Group Privacy</div>
                <div style={{ fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.7 }}>This group is <strong style={{color:'#fff'}}>Private</strong>. Only members you add can join and see messages.</div>
              </div>
              <div style={{ padding:'16px',background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.15)',borderRadius:16 }}>
                <div style={{ fontSize:13,fontWeight:700,color:'#fbbf24',marginBottom:8 }}>📋 Group ID</div>
                <div style={{ fontSize:12,color:'rgba(255,255,255,0.4)',fontFamily:'monospace',wordBreak:'break-all' }}>{group.id}</div>
              </div>
              <div style={{ padding:'16px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16 }}>
                <div style={{ fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.6)',marginBottom:8 }}>📅 Created</div>
                <div style={{ fontSize:13,color:'rgba(255,255,255,0.4)' }}>{group.createdAt?.toDate ? group.createdAt.toDate().toLocaleDateString('en',{year:'numeric',month:'long',day:'numeric'}) : 'Unknown'}</div>
              </div>
            </div>
          )}

          {/* DANGER TAB */}
          {tab === 'danger' && (
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              {!isOwner && (
                <div style={{ padding:'18px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:16 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:'#f87171',marginBottom:8 }}>🚪 Leave Group</div>
                  <div style={{ fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:14,lineHeight:1.6 }}>You will lose access to all messages in this group.</div>
                  {!confirmLeave
                    ? <GradBtn danger onClick={()=>setConfirmLeave(true)}>Leave Group</GradBtn>
                    : <div style={{ display:'flex',gap:8 }}>
                        <GradBtn danger onClick={()=>onLeaveGroup(group.id)}>Yes, Leave</GradBtn>
                        <button onClick={()=>setConfirmLeave(false)} style={{ padding:'8px 16px',borderRadius:11,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13 }}>Cancel</button>
                      </div>
                  }
                </div>
              )}
              {isOwner && (
                <div style={{ padding:'18px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:16 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:'#f87171',marginBottom:8 }}>💥 Delete Group</div>
                  <div style={{ fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:14,lineHeight:1.6 }}>This will permanently delete the group and all messages for everyone. This cannot be undone.</div>
                  {!confirmDeleteGroup
                    ? <GradBtn danger onClick={()=>setConfirmDeleteGroup(true)}>Delete Group</GradBtn>
                    : <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                        <div style={{ padding:'12px 14px',background:'rgba(239,68,68,0.12)',borderRadius:12,fontSize:13,color:'#fca5a5',fontWeight:700 }}>⚠️ Are you absolutely sure? This will delete ALL messages.</div>
                        <div style={{ display:'flex',gap:8 }}>
                          <GradBtn danger onClick={()=>onDeleteGroup(group.id)}>Yes, Delete Forever</GradBtn>
                          <button onClick={()=>setConfirmDeleteGroup(false)} style={{ padding:'8px 16px',borderRadius:11,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13 }}>Cancel</button>
                        </div>
                      </div>
                  }
                </div>
              )}
              <div style={{ padding:'16px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:16 }}>
                <div style={{ fontSize:12,color:'rgba(255,255,255,0.25)',lineHeight:1.7 }}>⚠️ Danger zone actions are permanent and irreversible. Please be certain before proceeding.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DM Info / Delete Modal ────────────────────────────────────────────────────
function DMInfoModal({ dm, currentUser, presenceMap, onClose, onDeleteDM }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const partnerPresence = presenceMap[dm.uid] || {};
  const isOnline = !!partnerPresence.online;

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(14px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:"'DM Sans',sans-serif",padding:16 }}>
      <div style={{ width:'100%',maxWidth:400,background:'#0a0a1e',border:'1px solid rgba(255,255,255,0.08)',borderRadius:26,overflow:'hidden',maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 50px 100px rgba(0,0,0,0.9)',animation:'modalIn .25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        
        {/* Header */}
        <div style={{ position:'relative',padding:'28px 24px 20px',background:'linear-gradient(135deg,rgba(55,48,163,0.3),rgba(190,24,93,0.15))',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,textAlign:'center' }}>
          <button onClick={onClose} style={{ position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.09)',color:'rgba(255,255,255,0.5)',fontSize:18,cursor:'pointer',width:32,height:32,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:14 }}>
            <Avatar name={dm.name} size={60} photoURL={dm.photo} avatarColor={dm.avatarColor} online={isOnline}/>
          </div>
          <div style={{ fontSize:20,fontWeight:800,color:'#fff',fontFamily:"'Syne',sans-serif",marginBottom:4 }}>@{dm.name}</div>
          <div style={{ fontSize:12,color:isOnline?'#10b981':'rgba(255,255,255,0.3)' }}>
            {isOnline ? '🟢 Online now' : `⚫ Last seen ${fmtLastSeen(partnerPresence.lastSeen)}`}
          </div>
        </div>

        <div style={{ padding:'20px 22px 24px',display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ padding:'16px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14 }}>
            <div style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8 }}>Direct Message</div>
            <div style={{ fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.7 }}>Messages are private between you and @{dm.name}.</div>
          </div>

          <div style={{ padding:'18px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:16 }}>
            <div style={{ fontSize:14,fontWeight:700,color:'#f87171',marginBottom:8 }}>🗑 Delete Conversation</div>
            <div style={{ fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:14,lineHeight:1.6 }}>Removes this DM from your sidebar. The other person can still see messages.</div>
            {!confirmDelete
              ? <GradBtn danger onClick={()=>setConfirmDelete(true)}>Delete DM</GradBtn>
              : <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  <div style={{ padding:'10px 14px',background:'rgba(239,68,68,0.1)',borderRadius:11,fontSize:13,color:'#fca5a5',fontWeight:600 }}>⚠️ Are you sure?</div>
                  <div style={{ display:'flex',gap:8 }}>
                    <GradBtn danger onClick={()=>onDeleteDM(dm.id)}>Yes, Delete</GradBtn>
                    <button onClick={()=>setConfirmDelete(false)} style={{ padding:'8px 16px',borderRadius:11,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13 }}>Cancel</button>
                  </div>
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function NewDMModal({ currentUser, onStart, onClose }) {
  const [handle,setHandle]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const search=async()=>{ setErr('');setResult(null); const h=handle.trim().toLowerCase().replace('@',''); if(!h||h===currentUser.handle) return setErr('Invalid'); setLoading(true); try { const snap=await getDocs(query(collection(db,'users'),where('handle','==',h))); if(snap.empty) setErr(`@${h} not found`); else setResult({uid:snap.docs[0].id,...snap.docs[0].data()}); } catch(e) { setErr('Search failed'); } setLoading(false); };
  return (
    <Modal title="🛸 New Direct Message" onClose={onClose}>
      <div style={{ display:'flex',gap:8,marginBottom:14 }}>
        <div style={{ position:'relative',flex:1 }}><span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#818cf8',fontWeight:800 }}>@</span><input placeholder="search handle…" value={handle} onChange={e=>setHandle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} style={{...modalInp,paddingLeft:28}}/></div>
        <GradBtn onClick={search} disabled={loading}>{loading?'…':'Find'}</GradBtn>
      </div>
      {err&&<p style={{ color:'#fca5a5',fontSize:13,margin:'0 0 10px' }}>⚠ {err}</p>}
      {result&&<div style={{ display:'flex',alignItems:'center',gap:12,padding:14,background:'rgba(129,140,248,0.08)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:14,flexWrap:'wrap' }}>
        <Avatar name={result.handle} size={44} photoURL={result.photoURL} avatarColor={result.avatarColor}/>
        <div style={{flex:1,minWidth:120}}><div style={{color:'#fff',fontWeight:700,fontSize:14}}>@{result.handle}</div><div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>{result.displayName||''}</div></div>
        <GradBtn onClick={()=>onStart(result)}>Chat →</GradBtn>
      </div>}
    </Modal>
  );
}

function CreateGroupModal({ currentUser, onCreated, onClose }) {
  const [name,setName]=useState('');
  const [selectedIcon,setSelectedIcon]=useState('🌌');
  const [hi,setHi]=useState('');
  const [members,setMembers]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searching,setSearching]=useState(false);
  const [err,setErr]=useState('');
  const add=async()=>{ const h=hi.trim().toLowerCase().replace('@',''); if(!h||h===currentUser.handle||members.find(m=>m.handle===h)) return setErr('Invalid or already added'); setSearching(true); try { const snap=await getDocs(query(collection(db,'users'),where('handle','==',h))); if(snap.empty) setErr(`@${h} not found`); else { setMembers(p=>[...p,{uid:snap.docs[0].id,...snap.docs[0].data()}]); setErr(''); } } catch(e) { setErr('Search failed'); } setHi('');setSearching(false); };
  const create=async()=>{ if(!name.trim()) return setErr('Group name required'); setLoading(true); try { const all=[{uid:currentUser.uid,handle:currentUser.handle},...members]; const ref=await addDoc(collection(db,'groups'),{ name:name.trim(),icon:selectedIcon,bio:'',createdBy:currentUser.uid,members:all.map(m=>m.uid),memberHandles:all.map(m=>m.handle),createdAt:serverTimestamp() }); onCreated({id:ref.id,name:name.trim(),icon:selectedIcon,bio:'',members:all.map(m=>m.uid),memberHandles:all.map(m=>m.handle),createdBy:currentUser.uid}); } catch(e) { setErr('Failed to create group'); } setLoading(false); };
  return (
    <Modal title="🌌 Create Group" onClose={onClose}>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:8,letterSpacing:'0.1em',textTransform:'uppercase' }}>Group Icon</label>
      <div style={{ display:'flex',flexWrap:'wrap',gap:7,marginBottom:16 }}>
        {GROUP_ICONS.map(em=><button key={em} onClick={()=>setSelectedIcon(em)} style={{ width:38,height:38,borderRadius:10,border:selectedIcon===em?'2px solid #818cf8':'2px solid transparent',background:selectedIcon===em?'rgba(129,140,248,0.2)':'rgba(255,255,255,0.04)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',transform:selectedIcon===em?'scale(1.15)':'scale(1)' }}>{em}</button>)}
      </div>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:7,letterSpacing:'0.1em',textTransform:'uppercase' }}>Group Name</label>
      <input placeholder="e.g. Stargazers 🔭" value={name} onChange={e=>setName(e.target.value)} style={{...modalInp,marginBottom:16}}/>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:7,letterSpacing:'0.1em',textTransform:'uppercase' }}>Add Members</label>
      <div style={{ display:'flex',gap:8,marginBottom:10 }}><div style={{ position:'relative',flex:1 }}><span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#818cf8',fontWeight:800 }}>@</span><input placeholder="handle…" value={hi} onChange={e=>setHi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} style={{...modalInp,paddingLeft:28}}/></div><GradBtn onClick={add} disabled={searching}>{searching?'…':'Add'}</GradBtn></div>
      {members.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:12 }}>{members.map(m=><div key={m.uid} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:20 }}><Avatar name={m.handle} size={18} avatarColor={m.avatarColor}/><span style={{ fontSize:12,color:'#c7d2fe' }}>@{m.handle}</span><span onClick={()=>setMembers(p=>p.filter(x=>x.uid!==m.uid))} style={{ cursor:'pointer',color:'rgba(255,255,255,.4)',fontSize:14 }}>×</span></div>)}</div>}
      {err&&<p style={{ color:'#fca5a5',fontSize:13,margin:'0 0 10px' }}>⚠ {err}</p>}
      <GradBtn onClick={create} disabled={loading} full>{loading?'Creating…':'🚀 Create Group'}</GradBtn>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main ChatRoom
// ═══════════════════════════════════════════════════════════════════════════
export default function ChatRoom({ firebaseUser, userProfile: initProfile }) {
  const isMobile = useIsMobile();
  const [userProfile, setUserProfile] = useState(initProfile);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingByRoom, setTypingByRoom] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [dmList, setDmList] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [modal, setModal] = useState(null);
  const [groupInfoTarget, setGroupInfoTarget] = useState(null);
  const [dmInfoTarget, setDmInfoTarget] = useState(null);
  const [presenceMap, setPresenceMap] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [lastReadMap, setLastReadMap] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const typingRef = useRef(null);
  const activeRoomRef = useRef(null);
  const [usersMap, setUsersMap] = useState({});

  // ── usersMap: fetch + real-time sync for ALL DM partners & group members ──
  // This ensures avatars in message bubbles always show the latest profile photo
  useEffect(() => {
    const uids = new Set();
    dmList.forEach(dm => uids.add(dm.uid));
    groupList.forEach(g => (g.members || []).forEach(uid => uids.add(uid)));
    if (!uids.size) return;

    // Initial fetch
    const fetchAll = async () => {
      const map = {};
      for (const uid of uids) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) map[uid] = snap.data();
        } catch (e) {
          console.error('Error fetching user:', e);
        }
      }
      setUsersMap(prev => ({ ...prev, ...map }));
    };
    fetchAll();

    // Real-time listeners so profile photo updates propagate instantly
    const unsubs = [...uids].map(uid =>
      onSnapshot(doc(db, 'users', uid), snap => {
        if (snap.exists()) {
          setUsersMap(prev => ({ ...prev, [uid]: snap.data() }));
        }
      }, err => console.warn('usersMap listener err', err))
    );

    return () => unsubs.forEach(u => u());
  }, [dmList, groupList]);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  const playPing = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.26);
    } catch {}
  };

  // ── Profile sync ──
  const refreshDMData = async (dmArray) => {
    const updated = await Promise.all(
      dmArray.map(async (dm) => {
        try {
          const snap = await getDoc(doc(db, 'users', dm.uid));
          if (snap.exists()) {
            const u = snap.data();
            return {
              ...dm,
              name: u.handle || dm.name,
              photo: u.photoURL || dm.photo,
              avatarColor: u.avatarColor ?? dm.avatarColor,
            };
          }
        } catch (e) {
          console.log("DM refresh error:", e);
        }
        return dm;
      })
    );
    return updated;
  };

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile(p => ({ ...p, ...data }));
          if (data.dms) {
            const refreshedDMs = await refreshDMData(data.dms);
            setDmList(refreshedDMs);
          }
          if (data.lastRead) setLastReadMap(data.lastRead);
        }
      },
      err => console.error('Profile sync error:', err)
    );
    return unsub;
  }, [firebaseUser.uid]);

  // ── Groups sync ──
  useEffect(() => {
    const q = query(collection(db,'groups'), where('members','array-contains',firebaseUser.uid));
    return onSnapshot(q,
      snap => setGroupList(snap.docs.map(d=>({id:d.id,...d.data()}))),
      err => console.error('Groups sync error:', err)
    );
  }, [firebaseUser.uid]);

  // ── Presence: heartbeat ──
  useEffect(() => {
    const ref = doc(db,'users',firebaseUser.uid);
    const setOnline = () => updateDoc(ref,{online:true,lastSeen:serverTimestamp()}).catch(()=>{});
    const setOffline = () => updateDoc(ref,{online:false,lastSeen:serverTimestamp()}).catch(()=>{});
    setOnline();
    const heartbeat = setInterval(setOnline, 25000);
    const handleVisibility = () => document.visibilityState === 'visible' ? setOnline() : setOffline();
    window.addEventListener('beforeunload', setOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', setOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      setOffline();
    };
  }, [firebaseUser.uid]);

  // ── PRESENCE: track all relevant users ──
  useEffect(() => {
    const uids = new Set();
    dmList.forEach(dm => uids.add(dm.uid));
    groupList.forEach(g => (g.members||[]).forEach(uid => uid !== firebaseUser.uid && uids.add(uid)));
    if (uids.size === 0) return;
    const unsubs = [...uids].map(uid =>
      onSnapshot(doc(db, 'users', uid), snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        const lastSeenMs = d.lastSeen?.toDate ? d.lastSeen.toDate().getTime() : 0;
        const isLive = d.online && (Date.now() - lastSeenMs < 60000);
        setPresenceMap(p => ({ ...p, [uid]: { online: isLive, lastSeen: d.lastSeen, handle: d.handle } }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [dmList, groupList, firebaseUser.uid]);

  useEffect(() => {
    const t = setInterval(() => {
      setPresenceMap(p => {
        const next = { ...p };
        Object.keys(next).forEach(uid => {
          const ls = next[uid].lastSeen?.toDate ? next[uid].lastSeen.toDate().getTime() : 0;
          if (next[uid].online && Date.now() - ls > 60000) next[uid] = { ...next[uid], online: false };
        });
        return next;
      });
    }, 20000);
    return () => clearInterval(t);
  }, []);

  // ── TYPING ──
  useEffect(() => {
    const rooms = [
      ...dmList.map(dm => ({ id: dm.id, type: 'dm' })),
      ...groupList.map(g => ({ id: g.id, type: 'group' })),
    ];
    if (!rooms.length) return;
    const unsubs = rooms.map(room => {
      const path = room.type === 'group' ? `groups/${room.id}/typing` : `dms/${room.id}/typing`;
      return onSnapshot(collection(db, path), snap => {
        const now = Date.now();
        const active = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(t => t.uid !== firebaseUser.uid && t.handle && t.at?.toDate && (now - t.at.toDate().getTime() < 5000))
          .map(t => t.handle);
        setTypingByRoom(prev => ({ ...prev, [room.id]: active }));
      }, err => console.warn('typing listen err', err));
    });
    return () => unsubs.forEach(u => u());
  }, [dmList, groupList, firebaseUser.uid]);

  // ── MESSAGES ──
  useEffect(() => {
    if (!activeRoom) return;
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/messages` : `dms/${activeRoom.id}/messages`;
    const q = query(collection(db,path), orderBy('timestamp','asc'));
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d=>({id:d.id,...d.data()}));
      setMessages(msgs);
      msgs.forEach(m => {
        if (m.sender!==firebaseUser.uid && !(m.seenBy||[]).includes(firebaseUser.uid))
          updateDoc(doc(db,path,m.id),{seenBy:arrayUnion(firebaseUser.uid)}).catch(()=>{});
      });
      const last = msgs[msgs.length-1];
      if (last?.timestamp?.toDate) {
        const ts = last.timestamp.toDate().getTime();
        setLastReadMap(prev => ({ ...prev, [activeRoom.id]: ts }));
        setDoc(doc(db,'users',firebaseUser.uid), { lastRead: { [activeRoom.id]: ts } }, { merge: true }).catch(()=>{});
      }
    }, err => console.error('Messages sync error:', err));
  }, [activeRoom, firebaseUser.uid]);

  // ── UNREAD ──
  useEffect(() => {
    const rooms = [
      ...dmList.map(dm => ({ id: dm.id, type: 'dm' })),
      ...groupList.map(g => ({ id: g.id, type: 'group' })),
    ];
    if (!rooms.length) return;
    const unsubs = rooms.map(room => {
      const path = room.type === 'group' ? `groups/${room.id}/messages` : `dms/${room.id}/messages`;
      const q = query(collection(db, path), orderBy('timestamp', 'desc'));
      return onSnapshot(q, snap => {
        let unread = 0;
        let triggered = false;
        const lastRead = lastReadMap[room.id] || 0;
        for (const d of snap.docs) {
          const m = d.data();
          if (m.sender === firebaseUser.uid) break;
          if (!m.timestamp?.toDate) continue;
          const ts = m.timestamp.toDate().getTime();
          if (ts <= lastRead) break;
          unread++;
          triggered = true;
        }
        if (activeRoomRef.current?.id === room.id) unread = 0;
        setUnreadMap(prev => {
          const wasUnread = (prev[room.id] || 0);
          if (triggered && unread > wasUnread && activeRoomRef.current?.id !== room.id) playPing();
          return { ...prev, [room.id]: unread };
        });
      }, () => {});
    });
    return () => unsubs.forEach(u => u());
  }, [dmList, groupList, lastReadMap, firebaseUser.uid]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,typingByRoom]);
  useEffect(() => { if (isMobile && activeRoom) setSidebarOpen(false); }, [activeRoom, isMobile]);
  useEffect(() => { if (activeRoom) setUnreadMap(prev => ({ ...prev, [activeRoom.id]: 0 })); }, [activeRoom]);

  // ── Send ──
  const sendMessage = async () => {
    if (!input.trim()||!activeRoom) return;
    const text = input.trim();
    setInput('');
    clearTyping();
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/messages` : `dms/${activeRoom.id}/messages`;
    try {
      await addDoc(collection(db,path),{
        text, sender:firebaseUser.uid,
        senderHandle:userProfile.handle,
        senderPhoto:userProfile.photoURL||'',
        senderAvatarColor:userProfile.avatarColor??0,
        timestamp:serverTimestamp(), seenBy:[firebaseUser.uid],
      });
    } catch(e) { console.error('Send failed:', e); setInput(text); }
  };

  // ── Typing helpers ──
  const setTypingDoc = async () => {
    if (!activeRoom) return;
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/typing/${firebaseUser.uid}` : `dms/${activeRoom.id}/typing/${firebaseUser.uid}`;
    try { await setDoc(doc(db, path), { handle: userProfile.handle, at: serverTimestamp() }); } catch {}
  };
  const clearTypingDoc = async () => {
    if (!activeRoom) return;
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/typing/${firebaseUser.uid}` : `dms/${activeRoom.id}/typing/${firebaseUser.uid}`;
    try { await deleteDoc(doc(db, path)); } catch {}
  };
  const clearTyping = () => {
    setIsTyping(false);
    clearTimeout(typingRef.current);
    clearTypingDoc();
  };

  const handleInput = e => {
    setInput(e.target.value);
    if (!isTyping && activeRoom && e.target.value.trim()) {
      setIsTyping(true);
      setTypingDoc();
    }
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => {
      setIsTyping(false);
      clearTypingDoc();
    }, 3000);
  };

  useEffect(() => {
    return () => { clearTypingDoc(); };
    // eslint-disable-next-line
  }, [activeRoom]);

  const deleteMsg = async id => {
    if (!activeRoom) return;
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/messages` : `dms/${activeRoom.id}/messages`;
    try { await deleteDoc(doc(db,path,id)); } catch(e) { console.error('Delete failed:', e); }
  };

  const startDM = async (user) => {
    const id = getRoomId(firebaseUser.uid, user.uid);
    const myDM = { id, name: user.handle, uid: user.uid, photo: user.photoURL || '', avatarColor: user.avatarColor ?? 0 };
    const otherDM = { id, name: userProfile.handle, uid: firebaseUser.uid, photo: userProfile.photoURL || '', avatarColor: userProfile.avatarColor ?? 0 };
    try {
      if (!dmList.find(d => d.id === id)) {
        await setDoc(doc(db, 'users', firebaseUser.uid), { dms: arrayUnion(myDM) }, { merge: true });
      }
      await setDoc(doc(db, 'users', user.uid), { dms: arrayUnion(otherDM) }, { merge: true });
    } catch (e) { console.error("Error creating DM:", e); }
    setActiveRoom({ type: 'dm', id, name: user.handle, uid: user.uid });
    setModal(null);
  };

  // ── Delete DM ──
  const deleteDM = async (dmId) => {
    try {
      const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userSnap.exists()) {
        const currentDms = userSnap.data().dms || [];
        const updatedDms = currentDms.filter(d => d.id !== dmId);
        await updateDoc(doc(db, 'users', firebaseUser.uid), { dms: updatedDms });
      }
    } catch(e) { console.error('Delete DM failed:', e); }
    if (activeRoom?.id === dmId) setActiveRoom(null);
    setDmList(p => p.filter(d => d.id !== dmId));
    setModal(null);
    setDmInfoTarget(null);
  };

  // ── Delete Group ──
  const deleteGroup = async (groupId) => {
    try {
      const path = `groups/${groupId}/messages`;
      const snap = await getDocs(collection(db, path));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      await deleteDoc(doc(db, 'groups', groupId));
    } catch(e) { console.error('Delete group failed:', e); }
    if (activeRoom?.id === groupId) setActiveRoom(null);
    setGroupList(p => p.filter(g => g.id !== groupId));
    setModal(null);
    setGroupInfoTarget(null);
  };

  // ── Leave Group ──
  const leaveGroup = async (groupId) => {
    const group = groupList.find(g => g.id === groupId);
    if (!group) return;
    try {
      const newMembers = (group.members || []).filter(uid => uid !== firebaseUser.uid);
      const newHandles = (group.memberHandles || []).filter(h => h !== userProfile.handle);
      await updateDoc(doc(db, 'groups', groupId), { members: newMembers, memberHandles: newHandles });
    } catch(e) { console.error('Leave group failed:', e); }
    if (activeRoom?.id === groupId) setActiveRoom(null);
    setGroupList(p => p.filter(g => g.id !== groupId));
    setModal(null);
    setGroupInfoTarget(null);
  };

  const signOut = () => { updateDoc(doc(db,'users',firebaseUser.uid),{online:false,lastSeen:serverTimestamp()}).catch(()=>{}); auth.signOut(); };

  const dmPartnerOnline = (dmUid) => !!presenceMap[dmUid]?.online;
  const activeDmPartnerUid = activeRoom?.type==='dm' ? (activeRoom.uid || dmList.find(d=>d.id===activeRoom.id)?.uid) : null;
  const isOtherOnline = activeDmPartnerUid ? dmPartnerOnline(activeDmPartnerUid) : false;
  const activeGroupOnlineCount = activeRoom?.type==='group'
    ? (groupList.find(g=>g.id===activeRoom.id)?.members||[]).filter(uid => uid===firebaseUser.uid || presenceMap[uid]?.online).length
    : 0;
  const activeTypingUsers = activeRoom ? (typingByRoom[activeRoom.id] || []) : [];

  // Sidebar item
  const SItem = ({ label, isActive, onClick, isDM, isGroup, dm, group, onInfo }) => {
    const [a] = isDM ? getGrad(label) : ['#818cf8','#6366f1'];
    const unread = unreadMap[isDM ? dm.id : group.id] || 0;
    const hasUnread = unread > 0 && !isActive;
    const typingHere = (typingByRoom[isDM ? dm.id : group.id] || []).filter(h => h !== userProfile.handle);
    const onlineHere = isDM ? dmPartnerOnline(dm.uid) : false;
    const groupObj = isGroup ? group : null;

    return (
      <div style={{ display:'flex',alignItems:'center',gap:2,marginBottom:3 }}>
        <div onClick={onClick} style={{
          flex:1,display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:13,cursor:'pointer',
          background: isActive ? 'linear-gradient(135deg,rgba(55,48,163,0.3),rgba(190,24,93,0.15))' : hasUnread ? 'linear-gradient(135deg,rgba(129,140,248,0.12),rgba(244,114,182,0.06))' : 'transparent',
          border: isActive ? '1px solid rgba(129,140,248,0.25)' : hasUnread ? '1px solid rgba(129,140,248,0.18)' : '1px solid transparent',
          transition:'all .18s',position:'relative',overflow:'hidden',
        }}>
          {isActive&&<div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent)',backgroundSize:'200%',animation:'shimmer 3s linear infinite' }}/>}
          {hasUnread && <div style={{ position:'absolute',left:0,top:'20%',bottom:'20%',width:3,borderRadius:2,background:'linear-gradient(to bottom,#818cf8,#f472b6)',boxShadow:'0 0 8px #818cf8' }}/>}
          {isDM
            ? <Avatar
                name={label}
                size={26}
                avatarColor={usersMap[dm.uid]?.avatarColor ?? dm.avatarColor}
                photoURL={usersMap[dm.uid]?.photoURL || dm.photo}
                online={onlineHere}
              />
            : isGroup
              ? <div style={{ width:28,height:28,borderRadius:9,background:'linear-gradient(135deg,rgba(129,140,248,0.25),rgba(244,114,182,0.15))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:groupObj?.icon?18:14,fontWeight:800,color:'#a5b4fc',flexShrink:0 }}>{groupObj?.icon||label[0]}</div>
              : <span style={{ color:isActive?'#818cf8':'rgba(255,255,255,0.25)',fontWeight:800,fontSize:16 }}>#</span>
          }
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
            <span style={{ fontSize:13,fontWeight:isActive||hasUnread?700:500,color:isActive?'#fff':hasUnread?'#e0e7ff':'rgba(255,255,255,0.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Syne',sans-serif" }}>{label}</span>
            {typingHere.length > 0 && !isActive && (
              <span style={{ fontSize:10,color:'#a5b4fc',fontStyle:'italic',display:'flex',alignItems:'center',gap:4 }}>
                <span style={{ display:'inline-flex',gap:2 }}>{[0,1,2].map(i=><span key={i} style={{ width:3,height:3,borderRadius:'50%',background:'#a5b4fc',animation:`typingBounce 1.1s ${i*.15}s ease-in-out infinite` }}/>)}</span>
                {typingHere.length===1?`@${typingHere[0]} typing`:`${typingHere.length} typing`}
              </span>
            )}
          </div>
          {hasUnread && (
            <div style={{ minWidth:18,height:18,padding:'0 6px',borderRadius:10,background:'linear-gradient(135deg,#4f46e5,#be185d)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#fff',boxShadow:'0 0 12px rgba(129,140,248,0.5)',animation:'unreadPulse 1.6s ease-in-out infinite' }}>{unread > 99 ? '99+' : unread}</div>
          )}
        </div>
        {/* Info button */}
        <button onClick={(e)=>{e.stopPropagation();onInfo();}} title={isDM?'DM Info':'Group Info'} style={{ width:28,height:28,borderRadius:9,border:'none',background:'transparent',color:'rgba(255,255,255,0.2)',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s' }}
          onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.6)'}
          onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.2)'}>
          ⋯
        </button>
      </div>
    );
  };

  const sidebarWidth = isMobile ? 280 : 252;
  const showSidebar = !isMobile || sidebarOpen;
  const totalUnread = Object.values(unreadMap).reduce((a,b)=>a+b, 0);

  return (
    <div style={{ height:'100dvh', display:'flex', background:'#07070f', fontFamily:"'DM Sans',sans-serif", color:'#fff', overflow:'hidden', position:'relative' }}>
      <SpaceBg intensity="full"/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{overflow:hidden;overscroll-behavior:none;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px;}
        @keyframes avatarRingRotate{to{transform:rotate(360deg)}}
        @keyframes msgIn{from{opacity:0;transform:translateY(10px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.88) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes orbitSpin1{to{transform:rotate(360deg)}}
        @keyframes orbitSpin2{to{transform:rotate(-360deg)}}
        @keyframes coreGlow{0%,100%{box-shadow:0 0 30px rgba(79,70,229,.6)}50%{box-shadow:0 0 55px rgba(79,70,229,.9),0 0 80px rgba(219,39,119,.4)}}
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes unreadPulse{0%,100%{transform:scale(1);box-shadow:0 0 12px rgba(129,140,248,0.5)}50%{transform:scale(1.08);box-shadow:0 0 16px rgba(244,114,182,0.7)}}
        @keyframes orbitalSpin{to{transform:rotate(360deg)}}
        input::placeholder{color:rgba(255,255,255,0.2);}
        textarea::placeholder{color:rgba(255,255,255,0.2);}
        input,textarea{font-size:16px!important;}
        @media(min-width:768px){input,textarea{font-size:14px!important;}}
        .send-btn{transition:all .2s;}
        .send-btn:hover:not(:disabled){transform:scale(1.08);}
      `}</style>

      {showProfile && <ProfileModal firebaseUser={firebaseUser} profile={userProfile} onClose={()=>setShowProfile(false)} onUpdated={p=>{setUserProfile(p);setShowProfile(false);}}/>}
      {modal==='newDM' && <NewDMModal currentUser={{...userProfile,uid:firebaseUser.uid}} onStart={startDM} onClose={()=>setModal(null)}/>}
      {modal==='createGroup' && <CreateGroupModal currentUser={{...userProfile,uid:firebaseUser.uid}} onCreated={g=>{setGroupList(p=>[...p,g]);setActiveRoom({type:'group',id:g.id,name:g.name,icon:g.icon});setModal(null);}} onClose={()=>setModal(null)}/>}
      {modal==='groupInfo' && groupInfoTarget && (
        <GroupInfoModal
          group={groupInfoTarget}
          currentUser={{...userProfile,uid:firebaseUser.uid}}
          presenceMap={presenceMap}
          onClose={()=>{setModal(null);setGroupInfoTarget(null);}}
          onUpdated={g=>{
            setGroupList(p=>p.map(x=>x.id===g.id?g:x));
            setActiveRoom(r=>r?.id===g.id?{...r,name:g.name,icon:g.icon}:r);
            setGroupInfoTarget(g);
          }}
          onDeleteGroup={deleteGroup}
          onLeaveGroup={leaveGroup}
        />
      )}
      {modal==='dmInfo' && dmInfoTarget && (
        <DMInfoModal
          dm={dmInfoTarget}
          currentUser={{...userProfile,uid:firebaseUser.uid}}
          presenceMap={presenceMap}
          onClose={()=>{setModal(null);setDmInfoTarget(null);}}
          onDeleteDM={deleteDM}
        />
      )}

      {isMobile && sidebarOpen && (
        <div onClick={()=>setSidebarOpen(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',zIndex:99 }}/>
      )}

      {/* ── Sidebar ── */}
      <div style={{
        width:sidebarWidth, flexShrink:0,
        background:'rgba(10,10,25,0.95)',
        borderRight:'1px solid rgba(255,255,255,0.06)',
        display:'flex',flexDirection:'column',position:isMobile?'fixed':'relative',
        height:'100dvh', left:0, top:0,
        transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)',
        transition: isMobile ? 'transform .28s ease' : 'none',
        zIndex:100,
        backdropFilter:'blur(20px)',
        overflow:'hidden',
      }}>
        <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',height:'100%' }}>
          <div style={{ padding:'18px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ position:'relative', width:52, height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ position:'absolute', width:52, height:52, borderRadius:'50%', border:'1px solid rgba(129,140,248,0.3)', animation:'orbitSpin1 12s linear infinite' }}>
                    <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:7, height:7, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 10px #818cf8, 0 0 20px rgba(129,140,248,.5)' }}/>
                  </div>
                  <div style={{ position:'absolute', width:38, height:38, borderRadius:'50%', border:'1px solid rgba(244,114,182,0.22)', animation:'orbitSpin2 8s linear infinite' }}>
                    <div style={{ position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)', width:5, height:5, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 8px #f472b6' }}/>
                  </div>
                  <div style={{ position:'absolute', width:26, height:26, borderRadius:'50%', border:'1px dashed rgba(52,211,153,0.18)', animation:'orbitSpin1 5s linear infinite' }}>
                    <div style={{ position:'absolute', bottom:-2, right:1, width:4, height:4, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 6px #34d399' }}/>
                  </div>
                  <div style={{ width:20, height:20, borderRadius:7, background:'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, animation:'coreGlow 2.5s ease-in-out infinite', position:'relative', zIndex:3, boxShadow:'0 0 20px rgba(79,70,229,.5)' }}>💬</div>
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:17, letterSpacing:'-0.5px', fontFamily:"'Syne',sans-serif", background:'linear-gradient(135deg,#e0e7ff,#a5b4fc,#fbcfe8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1.1 }}>NexChat</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,.25)', letterSpacing:'0.14em', textTransform:'uppercase', marginTop:2 }}>
                    {totalUnread > 0 ? <span style={{ color:'#a5b4fc' }}>● {totalUnread} unread</span> : 'V4.0 beta'}
                  </div>
                </div>
              </div>
              {isMobile && (
                <button onClick={()=>setSidebarOpen(false)} style={{ background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',width:34,height:34,borderRadius:10,color:'#fff',fontSize:18,cursor:'pointer' }}>×</button>
              )}
            </div>
          </div>

          <div style={{ flex:1,overflowY:'auto',padding:'12px 10px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px',marginBottom:6 }}>
              <span style={{ fontSize:9,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:'0.12em',textTransform:'uppercase' }}>Direct Messages</span>
              <button onClick={()=>setModal('newDM')} style={{ background:'none',border:'none',color:'#818cf8',fontSize:20,cursor:'pointer',lineHeight:1,padding:'0 2px' }}>+</button>
            </div>
            {dmList.length===0&&<p style={{ fontSize:12,color:'rgba(255,255,255,.2)',padding:'2px 4px 10px',fontStyle:'italic' }}>Click + to start a DM</p>}
            {dmList.map(dm=>(
              <SItem
                key={dm.id}
                label={usersMap[dm.uid]?.handle || dm.name}
                isActive={activeRoom?.id === dm.id}
                onClick={() => setActiveRoom({
                  type: 'dm',
                  id: dm.id,
                  name: usersMap[dm.uid]?.handle || dm.name,
                  uid: dm.uid
                })}
                isDM
                dm={dm}
                onInfo={() => {
                  setDmInfoTarget(dm);
                  setModal('dmInfo');
                }}
              />
            ))}

            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px',margin:'14px 0 6px' }}>
              <span style={{ fontSize:9,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:'0.12em',textTransform:'uppercase' }}>Groups</span>
              <button onClick={()=>setModal('createGroup')} style={{ background:'none',border:'none',color:'#818cf8',fontSize:20,cursor:'pointer',lineHeight:1,padding:'0 2px' }}>+</button>
            </div>
            {groupList.length===0&&<p style={{ fontSize:12,color:'rgba(255,255,255,.2)',padding:'2px 4px 8px',fontStyle:'italic' }}>Click + to create a group</p>}
            {groupList.map(g=>(
              <SItem
                key={g.id} label={g.name}
                isActive={activeRoom?.id===g.id}
                onClick={()=>setActiveRoom({type:'group',id:g.id,name:g.name,icon:g.icon})}
                isGroup group={g}
                onInfo={()=>{ setGroupInfoTarget(g); setModal('groupInfo'); }}
              />
            ))}
          </div>

          <div style={{ padding:'12px 14px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:10,cursor:'pointer',background:'rgba(255,255,255,0.02)' }} onClick={()=>setShowProfile(true)}>
            <Avatar name={userProfile.handle} size={32} photoURL={userProfile.photoURL} avatarColor={userProfile.avatarColor} online={true}/>
            <div style={{ flex:1,overflow:'hidden' }}>
              <div style={{ fontSize:13,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:"'Syne',sans-serif" }}>{userProfile.displayName||`@${userProfile.handle}`}</div>
              <div style={{ fontSize:10,color:'#10b981' }}>● Online · Edit profile</div>
            </div>
            <button onClick={e=>{e.stopPropagation();signOut();}} title="Sign out" style={{ background:'none',border:'none',color:'rgba(255,255,255,.25)',cursor:'pointer',fontSize:15,padding:4 }}>⏻</button>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative',width:isMobile?'100%':'auto' }}>
        <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',height:'100%' }}>
          {!activeRoom ? (
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,padding:20 }}>
              {isMobile && (
                <button onClick={()=>setSidebarOpen(true)} style={{ position:'absolute',top:16,left:16,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',width:40,height:40,borderRadius:11,color:'#fff',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>☰</button>
              )}
              <div style={{ position:'relative', width:isMobile?96:120, height:isMobile?96:120, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ position:'absolute', width:'100%', height:'100%', borderRadius:'50%', border:'1px solid rgba(129,140,248,0.2)', animation:'orbitSpin1 12s linear infinite' }}>
                  <div style={{ position:'absolute', top:-5, left:'50%', transform:'translateX(-50%)', width:10, height:10, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 14px #818cf8, 0 0 28px rgba(129,140,248,.5)' }}/>
                </div>
                <div style={{ position:'absolute', width:'73%', height:'73%', borderRadius:'50%', border:'1px solid rgba(244,114,182,0.18)', animation:'orbitSpin2 8s linear infinite' }}>
                  <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:8, height:8, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 10px #f472b6' }}/>
                </div>
                <div style={{ position:'absolute', width:'52%', height:'52%', borderRadius:'50%', border:'1px dashed rgba(52,211,153,0.15)', animation:'orbitSpin1 5s linear infinite' }}>
                  <div style={{ position:'absolute', bottom:-3, right:3, width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 8px #34d399' }}/>
                </div>
                <div style={{ width:isMobile?32:40, height:isMobile?32:40, borderRadius:13, background:'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:isMobile?15:18, animation:'coreGlow 2.5s ease-in-out infinite', zIndex:2, boxShadow:'0 0 30px rgba(79,70,229,.5)' }}>💬</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <h2 style={{ fontSize:isMobile?20:26,fontWeight:800,fontFamily:"'Syne',sans-serif",background:'linear-gradient(135deg,#e0e7ff,#a5b4fc,#fbcfe8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 8px' }}>Welcome to NexChat</h2>
                <p style={{ color:'rgba(255,255,255,.3)',fontSize:isMobile?12:14,padding:'0 12px' }}>Open a DM or create a group to start chatting across the cosmos</p>
              </div>
              <div style={{ display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center' }}>
                <button onClick={()=>setModal('newDM')} style={{ padding:'11px 22px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.25)',borderRadius:14,color:'#a5b4fc',cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif" }}>🛸 New DM</button>
                <button onClick={()=>setModal('createGroup')} style={{ padding:'11px 22px',background:'rgba(219,39,119,0.1)',border:'1px solid rgba(219,39,119,0.2)',borderRadius:14,color:'#f9a8d4',cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif" }}>🌌 Create Group</button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding:isMobile?'10px 14px':'14px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:isMobile?10:14,background:'rgba(7,7,15,0.85)',backdropFilter:'blur(16px)',flexShrink:0 }}>
                {isMobile && (
                  <button onClick={()=>setSidebarOpen(true)} style={{ background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',width:36,height:36,borderRadius:10,color:'#fff',fontSize:18,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',position:'relative' }}>
                    ☰
                    {totalUnread > 0 && <span style={{ position:'absolute',top:-4,right:-4,minWidth:16,height:16,padding:'0 4px',borderRadius:8,background:'linear-gradient(135deg,#4f46e5,#be185d)',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center' }}>{totalUnread > 9 ? '9+' : totalUnread}</span>}
                  </button>
                )}
                {/* Clickable header for info */}
                <div
                  onClick={()=>{
                    if (activeRoom.type==='group') {
                      const g = groupList.find(x=>x.id===activeRoom.id);
                      if (g) { setGroupInfoTarget(g); setModal('groupInfo'); }
                    } else {
                      const dm = dmList.find(d=>d.id===activeRoom.id);
                      if (dm) { setDmInfoTarget(dm); setModal('dmInfo'); }
                    }
                  }}
                  style={{ display:'flex',alignItems:'center',gap:isMobile?10:14,flex:1,minWidth:0,cursor:'pointer' }}>
                  {activeRoom.type==='dm'
                    ? (() => {
                        const dmPartner = dmList.find(d=>d.id===activeRoom.id);
                        const livePartner = dmPartner ? usersMap[dmPartner.uid] : null;
                        return (
                          <Avatar
                            name={activeRoom.name}
                            size={isMobile?34:40}
                            online={isOtherOnline}
                            photoURL={livePartner?.photoURL || dmPartner?.photo}
                            avatarColor={livePartner?.avatarColor ?? dmPartner?.avatarColor}
                          />
                        );
                      })()
                    : <div style={{ width:isMobile?36:42,height:isMobile?36:42,borderRadius:14,background:'linear-gradient(135deg,rgba(129,140,248,0.2),rgba(244,114,182,0.15))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:isMobile?18:22,flexShrink:0,border:'1px solid rgba(129,140,248,0.2)' }}>{activeRoom.icon || groupList.find(g=>g.id===activeRoom.id)?.icon || activeRoom.name[0]}</div>
                  }
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:800,fontSize:isMobile?15:17,fontFamily:"'Syne',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{activeRoom.type==='dm'?`@${activeRoom.name}`:activeRoom.name}</div>
                    <div style={{ fontSize:11,color:'rgba(255,255,255,.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {activeRoom.type==='dm'
                        ? isOtherOnline ? <span style={{color:'#10b981'}}>🟢 Online now</span> : `⚫ Last seen ${fmtLastSeen(presenceMap[activeDmPartnerUid]?.lastSeen)}`
                        : `🌌 ${groupList.find(g=>g.id===activeRoom.id)?.members?.length||0} members · ${activeGroupOnlineCount} online`
                      }
                    </div>
                  </div>
                </div>
                {/* Info button in header */}
                <button
                  onClick={()=>{
                    if (activeRoom.type==='group') {
                      const g = groupList.find(x=>x.id===activeRoom.id);
                      if (g) { setGroupInfoTarget(g); setModal('groupInfo'); }
                    } else {
                      const dm = dmList.find(d=>d.id===activeRoom.id);
                      if (dm) { setDmInfoTarget(dm); setModal('dmInfo'); }
                    }
                  }}
                  style={{ padding:isMobile?'7px 10px':'8px 16px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:11,color:'#a5b4fc',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:"'Syne',sans-serif",flexShrink:0,display:'flex',alignItems:'center',gap:6 }}>
                  {activeRoom.type==='group' ? <>ℹ️{!isMobile && ' Group Info'}</> : <>ℹ️{!isMobile && ' Info'}</>}
                </button>
              </div>

              <div style={{ flex:1,overflowY:'auto',padding:isMobile?'14px 12px':'20px 24px',WebkitOverflowScrolling:'touch' }}>
                {messages.length===0&&(
                  <div style={{ textAlign:'center',color:'rgba(255,255,255,.2)',marginTop:60,animation:'fadeSlideUp .4s both' }}>
                    <div style={{ fontSize:44,marginBottom:14 }}>{activeRoom.type==='dm'?'🛸':'🌌'}</div>
                    <div style={{ fontSize:isMobile?14:16,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:6,padding:'0 12px' }}>{activeRoom.type==='dm'?`Start a transmission with @${activeRoom.name}`:`Welcome to ${activeRoom.name}`}</div>
                    <div style={{ fontSize:13,color:'rgba(255,255,255,.15)' }}>The universe is waiting for your message</div>
                  </div>
                )}
                {messages.map((msg,i)=>{
                  const prev=messages[i-1];
                  const prevSame=prev&&!prev.system&&prev.sender===msg.sender;
                  return (
                    <Message
                      key={msg.id}
                      msg={msg}
                      isOwn={msg.sender===firebaseUser.uid}
                      prevSameUser={prevSame}
                      onDelete={deleteMsg}
                      currentUid={firebaseUser.uid}
                      isMobile={isMobile}
                      usersMap={usersMap}
                    />
                  );
                })}
                <TypingDots users={activeTypingUsers}/>
                <div ref={bottomRef}/>
              </div>

              <div style={{ padding:isMobile?'10px 12px':'14px 20px',borderTop:'1px solid rgba(255,255,255,0.06)',background:'rgba(7,7,15,0.85)',backdropFilter:'blur(16px)',flexShrink:0,paddingBottom:isMobile?'calc(10px + env(safe-area-inset-bottom))':'14px' }}>
                <div style={{ display:'flex',gap:8,alignItems:'center',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'5px 5px 5px 16px',boxShadow:'0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(129,140,248,0.04)',transition:'border-color .2s',borderColor:input.trim()?'rgba(129,140,248,0.2)':'rgba(255,255,255,0.08)' }}>
                  <input value={input} onChange={handleInput} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&!isMobile&&sendMessage()} placeholder={activeRoom.type==='dm'?`@${activeRoom.name}…`:`Message ${activeRoom.name}…`} style={{ flex:1,background:'transparent',border:'none',outline:'none',color:'#fff',fontFamily:"'DM Sans',sans-serif",minWidth:0 }}/>
                  <button className="send-btn" onClick={sendMessage} disabled={!input.trim()} style={{
                    width:isMobile?38:44,height:isMobile?38:44,borderRadius:13,border:'none',
                    background:input.trim()?'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)':'rgba(255,255,255,0.05)',
                    color:input.trim()?'#fff':'rgba(255,255,255,.2)',
                    cursor:input.trim()?'pointer':'not-allowed',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:isMobile?16:18,flexShrink:0,
                    boxShadow:input.trim()?'0 4px 20px rgba(79,70,229,.5), 0 0 0 1px rgba(129,140,248,0.2)':'none',
                    position:'relative',overflow:'hidden',
                  }}>
                    🚀
                    {input.trim()&&<div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)',backgroundSize:'200%',animation:'shimmer 2s linear infinite' }}/>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}