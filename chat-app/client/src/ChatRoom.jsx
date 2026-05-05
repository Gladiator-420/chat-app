import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs, where, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import socket from './socket';
import ProfileModal from './ProfileModal';
import SpaceBg from './SpaceBg';

const GRADIENTS = [
  ['#818cf8','#4f46e5'],['#f472b6','#db2777'],['#34d399','#059669'],
  ['#fb923c','#ea580c'],['#38bdf8','#0284c7'],['#a78bfa','#7c3aed'],
  ['#fbbf24','#d97706'],['#f87171','#dc2626'],['#6ee7b7','#0d9488'],
  ['#c4b5fd','#8b5cf6'],['#fdba74','#f97316'],['#67e8f9','#06b6d4'],
];

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
function Message({ msg, isOwn, prevSameUser, onDelete, currentUid }) {
  const [hovered, setHovered] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const seen = (msg.seenBy||[]).some(uid=>uid!==currentUid);

  if (msg.system) return (
    <div style={{ textAlign:'center', padding:'8px 0', display:'flex', alignItems:'center', gap:10, opacity:.6 }}>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>{msg.text}</span>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
    </div>
  );

  const [a] = getGrad(msg.senderHandle||'?');
  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>{setHovered(false);setConfirmDel(false);}}
      style={{ display:'flex', gap:10, flexDirection:isOwn?'row-reverse':'row', marginBottom:prevSameUser?3:14, animation:'msgIn .22s cubic-bezier(0.34,1.56,0.64,1) both', position:'relative' }}>

      <div style={{ width:40, flexShrink:0, display:'flex', alignItems:'flex-end' }}>
        {!prevSameUser && !isOwn && <Avatar name={msg.senderHandle||'?'} size={34} photoURL={msg.senderPhoto} avatarColor={msg.senderAvatarColor}/>}
      </div>

      <div style={{ maxWidth:'62%', display:'flex', flexDirection:'column', alignItems:isOwn?'flex-end':'flex-start', gap:3 }}>
        {!prevSameUser && (
          <div style={{ display:'flex', alignItems:'baseline', gap:8, flexDirection:isOwn?'row-reverse':'row' }}>
            <span style={{ fontSize:12, fontWeight:700, color:isOwn?'#a5b4fc':a, fontFamily:"'Syne',sans-serif" }}>{isOwn?'You':`@${msg.senderHandle||'?'}`}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.22)' }}>{fmtTime(msg.timestamp)}</span>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8, flexDirection:isOwn?'row-reverse':'row' }}>
          <div style={{
            padding:'10px 15px',
            borderRadius:isOwn?'20px 20px 5px 20px':'20px 20px 20px 5px',
            background:isOwn
              ? 'linear-gradient(135deg,#3730a3 0%,#6d28d9 50%,#be185d 100%)'
              : 'rgba(255,255,255,0.06)',
            border:isOwn?'none':'1px solid rgba(255,255,255,0.08)',
            color:'#fff', fontSize:14, lineHeight:1.55, wordBreak:'break-word',
            boxShadow:isOwn?'0 4px 24px rgba(79,70,229,0.35), 0 0 0 1px rgba(129,140,248,0.1)':'0 2px 8px rgba(0,0,0,0.3)',
            transition:'transform .15s',
            transform:hovered?'scale(1.015)':'scale(1)',
            fontFamily:"'DM Sans',sans-serif",
            position:'relative', overflow:'hidden',
          }}>
            {msg.text}
            {isOwn && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)', backgroundSize:'200%', animation:'shimmer 3s linear infinite' }}/>}
          </div>

          {isOwn && hovered && (
            !confirmDel
              ? <button onClick={()=>setConfirmDel(true)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'rgba(239,68,68,0.15)', color:'#f87171', cursor:'pointer', fontSize:13, transition:'all .15s' }}>🗑</button>
              : <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>onDelete(msg.id)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'rgba(239,68,68,0.7)', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>Delete</button>
                  <button onClick={()=>setConfirmDel(false)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:11 }}>Cancel</button>
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
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0 8px', color:'rgba(255,255,255,0.4)', fontSize:12 }}>
      <div style={{ display:'flex', gap:3 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:5,height:5,borderRadius:'50%',background:'#818cf8',animation:`typingBounce 1.1s ${i*.15}s ease-in-out infinite` }}/>)}
      </div>
      {users.slice(0,2).join(', ')} {users.length===1?'is':'are'} typing…
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:"'DM Sans',sans-serif",padding:20 }}>
      <div style={{ width:'100%',maxWidth:420,background:'#0c0c1e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:24,padding:28,boxShadow:'0 40px 80px rgba(0,0,0,0.7)',animation:'modalIn .25s cubic-bezier(0.34,1.56,0.64,1) both',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle,rgba(79,70,229,0.1) 0%,transparent 70%)',top:-60,right:-60,pointerEvents:'none' }}/>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22,position:'relative' }}>
          <h3 style={{ color:'#fff',margin:0,fontSize:17,fontWeight:800,fontFamily:"'Syne',sans-serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.35)',fontSize:22,cursor:'pointer' }}>×</button>
        </div>
        <div style={{ position:'relative' }}>{children}</div>
      </div>
    </div>
  );
}

const modalInp = { width:'100%',padding:'11px 14px 11px 32px',boxSizing:'border-box',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:11,color:'#fff',fontSize:13,outline:'none',fontFamily:"'DM Sans',sans-serif" };
function GradBtn({ onClick,disabled,children,full }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding:full?'13px':'0 16px',width:full?'100%':'auto',height:full?'auto':40,background:'linear-gradient(135deg,#3730a3,#be185d)',border:'none',borderRadius:11,color:'#fff',fontWeight:700,cursor:disabled?'not-allowed':'pointer',fontSize:13,fontFamily:"'Syne',sans-serif",opacity:disabled?.6:1,boxShadow:'0 4px 16px rgba(79,70,229,.35)',transition:'all .15s' }}>{children}</button>;
}

// ── New DM ────────────────────────────────────────────────────────────────────
function NewDMModal({ currentUser, onStart, onClose }) {
  const [handle,setHandle]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const search=async()=>{ setErr('');setResult(null); const h=handle.trim().toLowerCase().replace('@',''); if(!h||h===currentUser.handle) return setErr('Invalid'); setLoading(true); const snap=await getDocs(query(collection(db,'users'),where('handle','==',h))); if(snap.empty) setErr(`@${h} not found`); else setResult({uid:snap.docs[0].id,...snap.docs[0].data()}); setLoading(false); };
  return (
    <Modal title="🛸 New Direct Message" onClose={onClose}>
      <div style={{ display:'flex',gap:8,marginBottom:14 }}>
        <div style={{ position:'relative',flex:1 }}><span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#818cf8',fontWeight:800 }}>@</span><input placeholder="search handle…" value={handle} onChange={e=>setHandle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} style={modalInp}/></div>
        <GradBtn onClick={search} disabled={loading}>{loading?'…':'Find'}</GradBtn>
      </div>
      {err&&<p style={{ color:'#fca5a5',fontSize:13,margin:'0 0 10px' }}>⚠ {err}</p>}
      {result&&<div style={{ display:'flex',alignItems:'center',gap:12,padding:14,background:'rgba(129,140,248,0.08)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:14 }}>
        <Avatar name={result.handle} size={44} photoURL={result.photoURL} avatarColor={result.avatarColor}/>
        <div style={{flex:1}}><div style={{color:'#fff',fontWeight:700,fontSize:14}}>@{result.handle}</div><div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>{result.displayName||''}</div></div>
        <GradBtn onClick={()=>onStart(result)}>Chat →</GradBtn>
      </div>}
    </Modal>
  );
}

// ── Create Group ──────────────────────────────────────────────────────────────
function CreateGroupModal({ currentUser, onCreated, onClose }) {
  const [name,setName]=useState('');
  const [hi,setHi]=useState('');
  const [members,setMembers]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searching,setSearching]=useState(false);
  const [err,setErr]=useState('');
  const add=async()=>{ const h=hi.trim().toLowerCase().replace('@',''); if(!h||h===currentUser.handle||members.find(m=>m.handle===h)) return setErr('Invalid or already added'); setSearching(true); const snap=await getDocs(query(collection(db,'users'),where('handle','==',h))); if(snap.empty) setErr(`@${h} not found`); else setMembers(p=>[...p,{uid:snap.docs[0].id,...snap.docs[0].data()}]); setHi('');setSearching(false);setErr(''); };
  const create=async()=>{ if(!name.trim()) return setErr('Group name required'); setLoading(true); const all=[{uid:currentUser.uid,handle:currentUser.handle},...members]; const ref=await addDoc(collection(db,'groups'),{ name:name.trim(),createdBy:currentUser.uid,members:all.map(m=>m.uid),memberHandles:all.map(m=>m.handle),createdAt:serverTimestamp() }); onCreated({id:ref.id,name:name.trim(),members:all.map(m=>m.uid),memberHandles:all.map(m=>m.handle),createdBy:currentUser.uid}); setLoading(false); };
  return (
    <Modal title="🌌 Create Group" onClose={onClose}>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:7,letterSpacing:'0.1em',textTransform:'uppercase' }}>Group Name</label>
      <input placeholder="e.g. Stargazers 🔭" value={name} onChange={e=>setName(e.target.value)} style={{...modalInp,paddingLeft:14,marginBottom:16}}/>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:7,letterSpacing:'0.1em',textTransform:'uppercase' }}>Add Members</label>
      <div style={{ display:'flex',gap:8,marginBottom:10 }}><div style={{ position:'relative',flex:1 }}><span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#818cf8',fontWeight:800 }}>@</span><input placeholder="handle…" value={hi} onChange={e=>setHi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} style={modalInp}/></div><GradBtn onClick={add} disabled={searching}>{searching?'…':'Add'}</GradBtn></div>
      {members.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:12 }}>{members.map(m=><div key={m.uid} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:20 }}><Avatar name={m.handle} size={18} avatarColor={m.avatarColor}/><span style={{ fontSize:12,color:'#c7d2fe' }}>@{m.handle}</span><span onClick={()=>setMembers(p=>p.filter(x=>x.uid!==m.uid))} style={{ cursor:'pointer',color:'rgba(255,255,255,.4)',fontSize:14 }}>×</span></div>)}</div>}
      {err&&<p style={{ color:'#fca5a5',fontSize:13,margin:'0 0 10px' }}>⚠ {err}</p>}
      <GradBtn onClick={create} disabled={loading} full>{loading?'Creating…':'🚀 Create Group'}</GradBtn>
    </Modal>
  );
}

// ── Edit Group ────────────────────────────────────────────────────────────────
function EditGroupModal({ group, currentUser, onClose, onUpdated }) {
  const [name,setName]=useState(group.name);
  const [hi,setHi]=useState('');
  const [handles,setHandles]=useState(group.memberHandles||[]);
  const [uids,setUids]=useState(group.members||[]);
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const add=async()=>{ const h=hi.trim().toLowerCase().replace('@',''); if(!h||handles.includes(h)) return setErr('Invalid or already added'); const snap=await getDocs(query(collection(db,'users'),where('handle','==',h))); if(snap.empty) return setErr(`@${h} not found`); setHandles(p=>[...p,h]);setUids(p=>[...p,snap.docs[0].id]);setHi('');setErr(''); };
  const save=async()=>{ setLoading(true); await updateDoc(doc(db,'groups',group.id),{name:name.trim(),members:uids,memberHandles:handles}); onUpdated({...group,name:name.trim(),members:uids,memberHandles:handles}); setLoading(false);onClose(); };
  return (
    <Modal title="✏️ Edit Group" onClose={onClose}>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:7,letterSpacing:'0.1em',textTransform:'uppercase' }}>Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} style={{...modalInp,paddingLeft:14,marginBottom:16}}/>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:7,letterSpacing:'0.1em',textTransform:'uppercase' }}>Members</label>
      <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:10 }}>{handles.map((h,i)=><div key={h} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:20 }}><span style={{ fontSize:12,color:'#c7d2fe' }}>@{h}</span>{uids[i]!==currentUser.uid&&<span onClick={()=>{setHandles(p=>p.filter((_,j)=>j!==i));setUids(p=>p.filter((_,j)=>j!==i));}} style={{ cursor:'pointer',color:'rgba(255,255,255,.4)',fontSize:14 }}>×</span>}</div>)}</div>
      <div style={{ display:'flex',gap:8,marginBottom:14 }}><div style={{ position:'relative',flex:1 }}><span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#818cf8',fontWeight:800 }}>@</span><input placeholder="add handle…" value={hi} onChange={e=>setHi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} style={modalInp}/></div><GradBtn onClick={add}>Add</GradBtn></div>
      {err&&<p style={{ color:'#fca5a5',fontSize:13,margin:'0 0 10px' }}>⚠ {err}</p>}
      <GradBtn onClick={save} disabled={loading} full>{loading?'Saving…':'Save Changes'}</GradBtn>
    </Modal>
  );
}

// ── Main ChatRoom ─────────────────────────────────────────────────────────────
export default function ChatRoom({ firebaseUser, userProfile: initProfile }) {
  const [userProfile, setUserProfile] = useState(initProfile);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [dmList, setDmList] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [modal, setModal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [onlineSet, setOnlineSet] = useState(new Set());
  const [showProfile, setShowProfile] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const bottomRef = useRef(null);
  const typingRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db,'groups'), where('members','array-contains',firebaseUser.uid));
    return onSnapshot(q, snap => setGroupList(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [firebaseUser.uid]);

  useEffect(() => {
    const ref = doc(db,'users',firebaseUser.uid);
    updateDoc(ref,{online:true,lastSeen:serverTimestamp()}).catch(()=>{});
    const off = ()=>updateDoc(ref,{online:false,lastSeen:serverTimestamp()}).catch(()=>{});
    window.addEventListener('beforeunload',off);
    return ()=>{window.removeEventListener('beforeunload',off);off();};
  }, [firebaseUser.uid]);

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
    });
  }, [activeRoom, firebaseUser.uid]);

  useEffect(() => {
    if (!activeRoom) return;
    socket.connect();
    socket.emit('join_room',{username:userProfile.handle,room:activeRoom.id});
    socket.on('user_typing',({username:u})=>setTypingUsers(p=>[...new Set([...p,u])]));
    socket.on('user_stop_typing',({username:u})=>setTypingUsers(p=>p.filter(x=>x!==u)));
    socket.on('room_count',c=>setOnlineCount(c));
    return ()=>{ ['user_typing','user_stop_typing','room_count'].forEach(e=>socket.off(e)); socket.disconnect(); };
  }, [activeRoom, userProfile.handle]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,typingUsers]);

  useEffect(() => {
    if (!activeRoom||activeRoom.type!=='dm') return;
    getDocs(query(collection(db,'users'),where('handle','==',activeRoom.name))).then(snap=>{
      if (!snap.empty) setLastSeenMap(p=>({...p,[activeRoom.name]:snap.docs[0].data().lastSeen}));
    });
  }, [activeRoom]);

  const sendMessage = async () => {
    if (!input.trim()||!activeRoom) return;
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/messages` : `dms/${activeRoom.id}/messages`;
    await addDoc(collection(db,path),{
      text:input.trim(), sender:firebaseUser.uid,
      senderHandle:userProfile.handle,
      senderPhoto:userProfile.photoURL||'',
      senderAvatarColor:userProfile.avatarColor??0,
      timestamp:serverTimestamp(), seenBy:[firebaseUser.uid],
    });
    socket.emit('send_message',{room:activeRoom.id,message:input.trim()});
    setInput('');
    setIsTyping(false);
    socket.emit('stop_typing',{room:activeRoom.id,username:userProfile.handle});
    clearTimeout(typingRef.current);
  };

  const handleInput = e => {
    setInput(e.target.value);
    if (!isTyping) { setIsTyping(true); socket.emit('typing',{room:activeRoom.id,username:userProfile.handle}); }
    clearTimeout(typingRef.current);
    typingRef.current=setTimeout(()=>{ setIsTyping(false); socket.emit('stop_typing',{room:activeRoom.id,username:userProfile.handle}); },1500);
  };

  const deleteMsg = async id => {
    if (!activeRoom) return;
    const path = activeRoom.type==='group' ? `groups/${activeRoom.id}/messages` : `dms/${activeRoom.id}/messages`;
    await deleteDoc(doc(db,path,id));
  };

  const startDM = user => {
    const id=getRoomId(firebaseUser.uid,user.uid);
    if (!dmList.find(d=>d.id===id)) setDmList(p=>[...p,{id,name:user.handle,uid:user.uid,photo:user.photoURL,avatarColor:user.avatarColor}]);
    setActiveRoom({type:'dm',id,name:user.handle});
    setModal(null);
  };

  const signOut = ()=>{ updateDoc(doc(db,'users',firebaseUser.uid),{online:false,lastSeen:serverTimestamp()}).catch(()=>{}); auth.signOut(); };

  const isOtherOnline = activeRoom?.type==='dm' && onlineSet.has(activeRoom.name);

  const SItem = ({ label, isActive, onClick, isDM, isGroup, extra }) => {
    const [a] = isDM ? getGrad(label) : ['#818cf8','#6366f1'];
    return (
      <div onClick={onClick} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:13,cursor:'pointer',background:isActive?'linear-gradient(135deg,rgba(55,48,163,0.3),rgba(190,24,93,0.15))':'transparent',border:isActive?`1px solid rgba(129,140,248,0.2)`:'1px solid transparent',marginBottom:3,transition:'all .18s',position:'relative',overflow:'hidden' }}>
        {isActive&&<div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent)',backgroundSize:'200%',animation:'shimmer 3s linear infinite' }}/>}
        {isDM
          ? <div style={{position:'relative'}}><Avatar name={label} size={26} avatarColor={dmList.find(d=>d.name===label)?.avatarColor} online={onlineSet.has(label)}/></div>
          : isGroup
            ? <div style={{ width:28,height:28,borderRadius:9,background:'linear-gradient(135deg,rgba(129,140,248,0.25),rgba(244,114,182,0.15))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#a5b4fc',flexShrink:0 }}>{label[0]}</div>
            : <span style={{ color:isActive?'#818cf8':'rgba(255,255,255,0.25)',fontWeight:800,fontSize:16 }}>#</span>
        }
        <span style={{ fontSize:13,fontWeight:isActive?700:400,color:isActive?'#fff':'rgba(255,255,255,0.5)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Syne',sans-serif" }}>{label}</span>
        {extra}
      </div>
    );
  };

  return (
    <div style={{ height:'100vh', display:'flex', background:'#07070f', fontFamily:"'DM Sans',sans-serif", color:'#fff', overflow:'hidden', position:'relative' }}>
      <SpaceBg intensity="full"/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
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
        input::placeholder{color:rgba(255,255,255,0.2);}
        .send-btn{transition:all .2s;}
        .send-btn:hover:not(:disabled){transform:scale(1.08);}
      `}</style>

      {showProfile && <ProfileModal firebaseUser={firebaseUser} profile={userProfile} onClose={()=>setShowProfile(false)} onUpdated={p=>{setUserProfile(p);setShowProfile(false);}}/>}
      {modal==='newDM' && <NewDMModal currentUser={{...userProfile,uid:firebaseUser.uid}} onStart={startDM} onClose={()=>setModal(null)}/>}
      {modal==='createGroup' && <CreateGroupModal currentUser={{...userProfile,uid:firebaseUser.uid}} onCreated={g=>{setGroupList(p=>[...p,g]);setActiveRoom({type:'group',id:g.id,name:g.name});setModal(null);}} onClose={()=>setModal(null)}/>}
      {modal==='editGroup' && editTarget && <EditGroupModal group={editTarget} currentUser={{...userProfile,uid:firebaseUser.uid}} onClose={()=>{setModal(null);setEditTarget(null);}} onUpdated={g=>{setGroupList(p=>p.map(x=>x.id===g.id?g:x));setActiveRoom(r=>r?.id===g.id?{...r,name:g.name}:r);}}/>}

      {/* ── Sidebar ── */}
      <div style={{ width:252,flexShrink:0,background:'rgba(255,255,255,0.025)',borderRight:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',height:'100%' }}>

          {/* ── Logo — full rotating planet system ── */}
          <div style={{ padding:'18px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>

              {/* Planet orrery — same as Login but scaled to 52px */}
              <div style={{ position:'relative', width:52, height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {/* Outer ring — indigo dot */}
                <div style={{
                  position:'absolute', width:52, height:52, borderRadius:'50%',
                  border:'1px solid rgba(129,140,248,0.3)',
                  animation:'orbitSpin1 12s linear infinite',
                }}>
                  <div style={{
                    position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)',
                    width:7, height:7, borderRadius:'50%',
                    background:'#818cf8',
                    boxShadow:'0 0 10px #818cf8, 0 0 20px rgba(129,140,248,.5)',
                  }}/>
                </div>
                {/* Mid ring — pink dot */}
                <div style={{
                  position:'absolute', width:38, height:38, borderRadius:'50%',
                  border:'1px solid rgba(244,114,182,0.22)',
                  animation:'orbitSpin2 8s linear infinite',
                }}>
                  <div style={{
                    position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)',
                    width:5, height:5, borderRadius:'50%',
                    background:'#f472b6',
                    boxShadow:'0 0 8px #f472b6',
                  }}/>
                </div>
                {/* Inner dashed ring — green dot */}
                <div style={{
                  position:'absolute', width:26, height:26, borderRadius:'50%',
                  border:'1px dashed rgba(52,211,153,0.18)',
                  animation:'orbitSpin1 5s linear infinite',
                }}>
                  <div style={{
                    position:'absolute', bottom:-2, right:1,
                    width:4, height:4, borderRadius:'50%',
                    background:'#34d399',
                    boxShadow:'0 0 6px #34d399',
                  }}/>
                </div>
                {/* Core */}
                <div style={{
                  width:20, height:20, borderRadius:7,
                  background:'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10,
                  animation:'coreGlow 2.5s ease-in-out infinite',
                  position:'relative', zIndex:3,
                  boxShadow:'0 0 20px rgba(79,70,229,.5)',
                }}>💬</div>
              </div>

              {/* Wordmark */}
              <div>
                <div style={{
                  fontWeight:800, fontSize:17, letterSpacing:'-0.5px',
                  fontFamily:"'Syne',sans-serif",
                  background:'linear-gradient(135deg,#e0e7ff,#a5b4fc,#fbcfe8)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  lineHeight:1.1,
                }}>NexChat</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.25)', letterSpacing:'0.14em', textTransform:'uppercase', marginTop:2 }}>Space Edition</div>
              </div>
            </div>
          </div>

          {/* Nav list */}
          <div style={{ flex:1,overflowY:'auto',padding:'12px 10px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px',marginBottom:6 }}>
              <span style={{ fontSize:9,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:'0.12em',textTransform:'uppercase' }}>Direct Messages</span>
              <button onClick={()=>setModal('newDM')} style={{ background:'none',border:'none',color:'#818cf8',fontSize:20,cursor:'pointer',lineHeight:1,padding:'0 2px' }}>+</button>
            </div>
            {dmList.length===0&&<p style={{ fontSize:12,color:'rgba(255,255,255,.2)',padding:'2px 4px 10px',fontStyle:'italic' }}>Click + to start a DM</p>}
            {dmList.map(dm=><SItem key={dm.id} label={dm.name} isActive={activeRoom?.id===dm.id} onClick={()=>setActiveRoom({type:'dm',id:dm.id,name:dm.name})} isDM/>)}

            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px',margin:'14px 0 6px' }}>
              <span style={{ fontSize:9,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:'0.12em',textTransform:'uppercase' }}>Groups</span>
              <button onClick={()=>setModal('createGroup')} style={{ background:'none',border:'none',color:'#818cf8',fontSize:20,cursor:'pointer',lineHeight:1,padding:'0 2px' }}>+</button>
            </div>
            {groupList.length===0&&<p style={{ fontSize:12,color:'rgba(255,255,255,.2)',padding:'2px 4px 8px',fontStyle:'italic' }}>Click + to create a group</p>}
            {groupList.map(g=><SItem key={g.id} label={g.name} isActive={activeRoom?.id===g.id} onClick={()=>setActiveRoom({type:'group',id:g.id,name:g.name})} isGroup extra={g.createdBy===firebaseUser.uid&&<button onClick={e=>{e.stopPropagation();setEditTarget(g);setModal('editGroup');}} style={{ background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer',fontSize:13,padding:'2px 4px' }}>✏️</button>}/>)}
          </div>

          {/* Profile footer */}
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
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative' }}>
        <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',height:'100%' }}>

          {!activeRoom ? (
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20 }}>
              {/* Welcome orrery — medium size */}
              <div style={{ position:'relative', width:120, height:120, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ position:'absolute', width:120, height:120, borderRadius:'50%', border:'1px solid rgba(129,140,248,0.2)', animation:'orbitSpin1 12s linear infinite' }}>
                  <div style={{ position:'absolute', top:-5, left:'50%', transform:'translateX(-50%)', width:10, height:10, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 14px #818cf8, 0 0 28px rgba(129,140,248,.5)' }}/>
                </div>
                <div style={{ position:'absolute', width:88, height:88, borderRadius:'50%', border:'1px solid rgba(244,114,182,0.18)', animation:'orbitSpin2 8s linear infinite' }}>
                  <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:8, height:8, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 10px #f472b6' }}/>
                </div>
                <div style={{ position:'absolute', width:62, height:62, borderRadius:'50%', border:'1px dashed rgba(52,211,153,0.15)', animation:'orbitSpin1 5s linear infinite' }}>
                  <div style={{ position:'absolute', bottom:-3, right:3, width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 8px #34d399' }}/>
                </div>
                <div style={{ width:40, height:40, borderRadius:13, background:'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, animation:'coreGlow 2.5s ease-in-out infinite', zIndex:2, boxShadow:'0 0 30px rgba(79,70,229,.5)' }}>💬</div>
              </div>

              <div style={{ textAlign:'center' }}>
                <h2 style={{ fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif",background:'linear-gradient(135deg,#e0e7ff,#a5b4fc,#fbcfe8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 8px' }}>Welcome to NexChat</h2>
                <p style={{ color:'rgba(255,255,255,.3)',fontSize:14 }}>Open a DM or create a group to start chatting across the cosmos</p>
              </div>
              <div style={{ display:'flex',gap:12 }}>
                <button onClick={()=>setModal('newDM')} style={{ padding:'11px 22px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.25)',borderRadius:14,color:'#a5b4fc',cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif" }}>🛸 New DM</button>
                <button onClick={()=>setModal('createGroup')} style={{ padding:'11px 22px',background:'rgba(219,39,119,0.1)',border:'1px solid rgba(219,39,119,0.2)',borderRadius:14,color:'#f9a8d4',cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif" }}>🌌 Create Group</button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding:'14px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:14,background:'rgba(7,7,15,0.7)',backdropFilter:'blur(16px)' }}>
                {activeRoom.type==='dm'
                  ? <Avatar name={activeRoom.name} size={40} online={isOtherOnline}/>
                  : <div style={{ width:42,height:42,borderRadius:14,background:'linear-gradient(135deg,rgba(129,140,248,0.2),rgba(244,114,182,0.15))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:800,color:'#a5b4fc',flexShrink:0,border:'1px solid rgba(129,140,248,0.2)' }}>{activeRoom.name[0]}</div>
                }
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800,fontSize:17,fontFamily:"'Syne',sans-serif" }}>{activeRoom.type==='dm'?`@${activeRoom.name}`:activeRoom.name}</div>
                  <div style={{ fontSize:11,color:'rgba(255,255,255,.4)' }}>
                    {activeRoom.type==='dm'
                      ? isOtherOnline ? <span style={{color:'#10b981'}}>🟢 Online now</span> : `⚫ Last seen ${fmtLastSeen(lastSeenMap[activeRoom.name])}`
                      : `🌌 ${groupList.find(g=>g.id===activeRoom.id)?.members?.length||0} members · ${onlineCount} online`
                    }
                  </div>
                </div>
                {activeRoom.type==='group' && groupList.find(g=>g.id===activeRoom.id)?.createdBy===firebaseUser.uid && (
                  <button onClick={()=>{setEditTarget(groupList.find(g=>g.id===activeRoom.id));setModal('editGroup');}} style={{ padding:'8px 16px',background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:11,color:'#a5b4fc',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:"'Syne',sans-serif" }}>✏️ Edit</button>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex:1,overflowY:'auto',padding:'20px 24px' }}>
                {messages.length===0&&(
                  <div style={{ textAlign:'center',color:'rgba(255,255,255,.2)',marginTop:60,animation:'fadeSlideUp .4s both' }}>
                    <div style={{ fontSize:44,marginBottom:14 }}>{activeRoom.type==='dm'?'🛸':'🌌'}</div>
                    <div style={{ fontSize:16,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:6 }}>{activeRoom.type==='dm'?`Start a transmission with @${activeRoom.name}`:`Welcome to ${activeRoom.name}`}</div>
                    <div style={{ fontSize:13,color:'rgba(255,255,255,.15)' }}>The universe is waiting for your message</div>
                  </div>
                )}
                {messages.map((msg,i)=>{
                  const prev=messages[i-1];
                  const prevSame=prev&&!prev.system&&prev.sender===msg.sender;
                  return <Message key={msg.id} msg={msg} isOwn={msg.sender===firebaseUser.uid} prevSameUser={prevSame} onDelete={deleteMsg} currentUid={firebaseUser.uid}/>;
                })}
                <TypingDots users={typingUsers.filter(u=>u!==userProfile.handle)}/>
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,0.06)',background:'rgba(7,7,15,0.7)',backdropFilter:'blur(16px)' }}>
                <div style={{ display:'flex',gap:10,alignItems:'center',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'6px 6px 6px 18px',boxShadow:'0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(129,140,248,0.04)',transition:'border-color .2s',borderColor:input.trim()?'rgba(129,140,248,0.2)':'rgba(255,255,255,0.08)' }}>
                  <input ref={inputRef} value={input} onChange={handleInput} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()} placeholder={activeRoom.type==='dm'?`Send a transmission to @${activeRoom.name}…`:`Message ${activeRoom.name}…`} style={{ flex:1,background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:14,fontFamily:"'DM Sans',sans-serif" }}/>
                  <button className="send-btn" onClick={sendMessage} disabled={!input.trim()} style={{
                    width:44,height:44,borderRadius:14,border:'none',
                    background:input.trim()?'linear-gradient(135deg,#3730a3,#6d28d9,#be185d)':'rgba(255,255,255,0.05)',
                    color:input.trim()?'#fff':'rgba(255,255,255,.2)',
                    cursor:input.trim()?'pointer':'not-allowed',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:18,flexShrink:0,
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