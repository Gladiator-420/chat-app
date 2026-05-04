import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  getDocs, where, serverTimestamp, doc, getDoc,
  updateDoc, deleteDoc, setDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { auth, db } from './firebase';
import socket from './socket';

// ─── palette helpers ──────────────────────────────────────────────────────────
const PALETTES = [
  ['#818cf8','#6366f1'],['#f472b6','#db2777'],['#34d399','#059669'],
  ['#fb923c','#ea580c'],['#38bdf8','#0284c7'],['#a78bfa','#7c3aed'],
];
const palette = (name='?') => PALETTES[name.charCodeAt(0) % PALETTES.length];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name='?', size=36, showRing=false }) {
  const [a,b] = palette(name);
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:`linear-gradient(135deg,${a},${b})`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.38, fontWeight:700, color:'#fff',
      boxShadow: showRing ? `0 0 0 2px #0d0d18, 0 0 0 4px ${a}` : `0 2px 12px ${a}44`,
      transition:'box-shadow 0.3s',
      fontFamily:'Syne,sans-serif',
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

// ─── DM room id ───────────────────────────────────────────────────────────────
const getRoomId = (a,b) => [a,b].sort().join('__');

// ─── timestamp helper ─────────────────────────────────────────────────────────
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
};
const fmtLastSeen = (ts) => {
  if (!ts) return 'a while ago';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString();
};

// ─── Message bubble ───────────────────────────────────────────────────────────
function Message({ msg, isOwn, prevSameUser, onDelete, currentUid }) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seenByOthers = msg.seenBy?.some(uid => uid !== currentUid);

  if (msg.system) return (
    <div style={{ textAlign:'center', padding:'8px 0', color:'rgba(255,255,255,0.25)', fontSize:11, display:'flex', alignItems:'center', gap:10, fontFamily:'Syne,sans-serif' }}>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
      {msg.text}
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
    </div>
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
      style={{ display:'flex', gap:10, flexDirection:isOwn?'row-reverse':'row', marginBottom:prevSameUser?3:14, animation:'msgIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both', position:'relative' }}
    >
      <div style={{ width:36, flexShrink:0 }}>
        {!prevSameUser && !isOwn && <Avatar name={msg.senderHandle||'?'} size={36}/>}
      </div>

      <div style={{ maxWidth:'62%', display:'flex', flexDirection:'column', alignItems:isOwn?'flex-end':'flex-start', gap:3 }}>
        {!prevSameUser && (
          <div style={{ display:'flex', alignItems:'baseline', gap:8, flexDirection:isOwn?'row-reverse':'row' }}>
            <span style={{ fontSize:12, fontWeight:700, color:isOwn?'#a5b4fc':'rgba(255,255,255,0.65)', fontFamily:'Syne,sans-serif' }}>
              {isOwn ? 'You' : `@${msg.senderHandle||'?'}`}
            </span>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.22)' }}>{fmtTime(msg.timestamp)}</span>
          </div>
        )}

        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:6, flexDirection:isOwn?'row-reverse':'row' }}>
          {/* Bubble */}
          <div style={{
            padding:'10px 15px',
            borderRadius: isOwn ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
            background: isOwn
              ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)'
              : 'rgba(255,255,255,0.065)',
            border: isOwn ? 'none' : '1px solid rgba(255,255,255,0.09)',
            color:'#fff', fontSize:14, lineHeight:1.55, wordBreak:'break-word',
            boxShadow: isOwn ? '0 4px 24px rgba(79,70,229,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
            transition:'transform 0.15s, box-shadow 0.15s',
            transform: hovered ? 'scale(1.01)' : 'scale(1)',
            fontFamily:'Syne,sans-serif',
          }}>
            {msg.text}
          </div>

          {/* Delete button */}
          {isOwn && hovered && (
            <div style={{ display:'flex', gap:4 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} title="Delete" style={{
                  width:28, height:28, borderRadius:8, border:'none',
                  background:'rgba(239,68,68,0.15)', color:'#f87171',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, transition:'all 0.15s',
                }}>🗑</button>
              ) : (
                <>
                  <button onClick={() => onDelete(msg.id)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'rgba(239,68,68,0.8)', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:11 }}>Cancel</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Seen indicator */}
        {isOwn && (
          <div style={{ fontSize:11, color: seenByOthers ? '#818cf8' : 'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
            {seenByOthers ? (
              <><span>✓✓</span><span style={{ color:'#a5b4fc' }}>Seen</span></>
            ) : (
              <><span>✓</span><span>Sent</span></>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots({ users }) {
  if (!users.length) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0 8px', color:'rgba(255,255,255,0.4)', fontSize:12, fontFamily:'Syne,sans-serif' }}>
      <div style={{ display:'flex', gap:3 }}>
        {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#818cf8', animation:`typingBounce 1.1s ${i*0.15}s ease-in-out infinite` }}/>)}
      </div>
      {users.slice(0,2).join(', ')} {users.length===1?'is':'are'} typing…
    </div>
  );
}

// ─── New DM modal ─────────────────────────────────────────────────────────────
function NewDMModal({ currentUser, onStart, onClose }) {
  const [handle, setHandle] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const search = async () => {
    setErr(''); setResult(null);
    const h = handle.trim().toLowerCase().replace('@','');
    if (!h) return;
    if (h === currentUser.handle) return setErr("That's you!");
    setLoading(true);
    const snap = await getDocs(query(collection(db,'users'), where('handle','==',h)));
    if (snap.empty) setErr(`@${h} not found`);
    else setResult({ uid:snap.docs[0].id, ...snap.docs[0].data() });
    setLoading(false);
  };

  return (
    <Modal title="New Direct Message" onClose={onClose}>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <div style={{ position:'relative', flex:1 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#818cf8', fontWeight:700 }}>@</span>
          <input placeholder="search handle…" value={handle} onChange={e=>setHandle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} style={modalInputStyle}/>
        </div>
        <GradBtn onClick={search} disabled={loading}>{loading?'…':'Find'}</GradBtn>
      </div>
      {err && <p style={{ color:'#fca5a5', fontSize:13, margin:'0 0 10px' }}>⚠ {err}</p>}
      {result && (
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:14, background:'rgba(129,140,248,0.08)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:14 }}>
          <Avatar name={result.handle} size={44}/>
          <div style={{ flex:1 }}>
            <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>@{result.handle}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{result.email}</div>
          </div>
          <GradBtn onClick={()=>onStart(result)}>Chat →</GradBtn>
        </div>
      )}
    </Modal>
  );
}

// ─── Create Group modal ───────────────────────────────────────────────────────
function CreateGroupModal({ currentUser, onCreated, onClose }) {
  const [name, setName] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');

  const addMember = async () => {
    setErr('');
    const h = handleInput.trim().toLowerCase().replace('@','');
    if (!h || h === currentUser.handle) return setErr('Invalid handle');
    if (members.find(m => m.handle === h)) return setErr('Already added');
    setSearching(true);
    const snap = await getDocs(query(collection(db,'users'), where('handle','==',h)));
    if (snap.empty) setErr(`@${h} not found`);
    else setMembers(p => [...p, { uid:snap.docs[0].id, ...snap.docs[0].data() }]);
    setHandleInput('');
    setSearching(false);
  };

  const create = async () => {
    if (!name.trim()) return setErr('Group name required');
    setLoading(true);
    const allMembers = [{ uid:currentUser.uid, handle:currentUser.handle }, ...members];
    const ref = await addDoc(collection(db,'groups'), {
      name: name.trim(),
      createdBy: currentUser.uid,
      members: allMembers.map(m => m.uid),
      memberHandles: allMembers.map(m => m.handle),
      createdAt: serverTimestamp(),
      avatar: name.trim()[0].toUpperCase(),
    });
    onCreated({ id:ref.id, name:name.trim(), members:allMembers });
    setLoading(false);
  };

  return (
    <Modal title="Create Group" onClose={onClose}>
      <label style={labelStyle}>Group Name</label>
      <input placeholder="e.g. Weekend Squad" value={name} onChange={e=>setName(e.target.value)} style={{...modalInputStyle, marginBottom:16}}/>

      <label style={labelStyle}>Add Members</label>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div style={{ position:'relative', flex:1 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#818cf8', fontWeight:700 }}>@</span>
          <input placeholder="handle…" value={handleInput} onChange={e=>setHandleInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()} style={modalInputStyle}/>
        </div>
        <GradBtn onClick={addMember} disabled={searching}>{searching?'…':'Add'}</GradBtn>
      </div>

      {members.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {members.map(m => (
            <div key={m.uid} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'rgba(129,140,248,0.12)', border:'1px solid rgba(129,140,248,0.25)', borderRadius:20 }}>
              <Avatar name={m.handle} size={20}/>
              <span style={{ fontSize:12, color:'#c7d2fe' }}>@{m.handle}</span>
              <span onClick={()=>setMembers(p=>p.filter(x=>x.uid!==m.uid))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:14, marginLeft:2 }}>×</span>
            </div>
          ))}
        </div>
      )}

      {err && <p style={{ color:'#fca5a5', fontSize:13, margin:'0 0 10px' }}>⚠ {err}</p>}
      <GradBtn onClick={create} disabled={loading} full>{loading?'Creating…':'Create Group →'}</GradBtn>
    </Modal>
  );
}

// ─── Edit Group modal ─────────────────────────────────────────────────────────
function EditGroupModal({ group, currentUser, onClose, onUpdated }) {
  const [name, setName] = useState(group.name);
  const [handleInput, setHandleInput] = useState('');
  const [members, setMembers] = useState(group.memberHandles||[]);
  const [memberUids, setMemberUids] = useState(group.members||[]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const addMember = async () => {
    const h = handleInput.trim().toLowerCase().replace('@','');
    if (!h || members.includes(h)) return setErr('Invalid or already added');
    const snap = await getDocs(query(collection(db,'users'),where('handle','==',h)));
    if (snap.empty) return setErr(`@${h} not found`);
    setMembers(p=>[...p,h]);
    setMemberUids(p=>[...p,snap.docs[0].id]);
    setHandleInput('');
    setErr('');
  };

  const save = async () => {
    setLoading(true);
    await updateDoc(doc(db,'groups',group.id), { name:name.trim(), members:memberUids, memberHandles:members });
    onUpdated({ ...group, name:name.trim(), members:memberUids, memberHandles:members });
    setLoading(false);
    onClose();
  };

  return (
    <Modal title="Edit Group" onClose={onClose}>
      <label style={labelStyle}>Group Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} style={{...modalInputStyle, marginBottom:16}}/>

      <label style={labelStyle}>Members</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
        {members.map((h,i) => (
          <div key={h} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:20 }}>
            <Avatar name={h} size={20}/>
            <span style={{ fontSize:12, color:'#c7d2fe' }}>@{h}</span>
            {memberUids[i] !== currentUser.uid && (
              <span onClick={()=>{ setMembers(p=>p.filter((_,j)=>j!==i)); setMemberUids(p=>p.filter((_,j)=>j!==i)); }} style={{ cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:14 }}>×</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <div style={{ position:'relative', flex:1 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#818cf8', fontWeight:700 }}>@</span>
          <input placeholder="add handle…" value={handleInput} onChange={e=>setHandleInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()} style={modalInputStyle}/>
        </div>
        <GradBtn onClick={addMember}>Add</GradBtn>
      </div>

      {err && <p style={{ color:'#fca5a5', fontSize:13, margin:'0 0 10px' }}>⚠ {err}</p>}
      <GradBtn onClick={save} disabled={loading} full>{loading?'Saving…':'Save Changes'}</GradBtn>
    </Modal>
  );
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
const modalInputStyle = {
  width:'100%', padding:'11px 12px 11px 32px', boxSizing:'border-box',
  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:10, color:'#fff', fontSize:14, outline:'none', fontFamily:'Syne,sans-serif',
};
const labelStyle = { display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:7, letterSpacing:'0.09em', textTransform:'uppercase', fontFamily:'Syne,sans-serif' };

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, fontFamily:'Syne,sans-serif', backdropFilter:'blur(4px)' }}>
      <div style={{ width:400, background:'#10101c', border:'1px solid rgba(255,255,255,0.1)', borderRadius:22, padding:28, boxShadow:'0 32px 80px rgba(0,0,0,0.7)', animation:'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h3 style={{ color:'#fff', margin:0, fontSize:17, fontWeight:800 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
      <style>{`@keyframes modalIn { from{opacity:0;transform:scale(0.9) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
    </div>
  );
}

function GradBtn({ onClick, disabled, children, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: full ? '13px' : '0 16px',
      width: full ? '100%' : 'auto',
      height: full ? 'auto' : 40,
      background:'linear-gradient(135deg,#4f46e5,#db2777)',
      border:'none', borderRadius:10, color:'#fff',
      fontWeight:700, cursor:disabled?'not-allowed':'pointer',
      fontSize:13, fontFamily:'Syne,sans-serif',
      opacity:disabled?0.6:1, transition:'opacity 0.15s, transform 0.1s',
      boxShadow:'0 4px 16px rgba(79,70,229,0.35)',
    }}>{children}</button>
  );
}

// ─── Main ChatRoom ────────────────────────────────────────────────────────────
export default function ChatRoom({ firebaseUser, userProfile }) {
  const [activeRoom, setActiveRoom] = useState(null); // {type,id,name}
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [dmList, setDmList] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [modal, setModal] = useState(null); // 'newDM'|'createGroup'|'editGroup'
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [onlineSet, setOnlineSet] = useState(new Set());
  const [editTarget, setEditTarget] = useState(null);
  const bottomRef = useRef(null);
  const typingRef = useRef(null);
  const inputRef = useRef(null);

  // Load user's groups
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db,'groups'), where('members','array-contains',firebaseUser.uid));
    const unsub = onSnapshot(q, snap => {
      setGroupList(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
    return () => unsub();
  }, [firebaseUser]);

  // Update last seen on connect
  useEffect(() => {
    if (!firebaseUser) return;
    const userRef = doc(db,'users',firebaseUser.uid);
    updateDoc(userRef, { lastSeen: serverTimestamp(), online: true }).catch(()=>{});
    const handleUnload = () => updateDoc(userRef, { online:false, lastSeen:serverTimestamp() }).catch(()=>{});
    window.addEventListener('beforeunload', handleUnload);
    return () => { window.removeEventListener('beforeunload', handleUnload); handleUnload(); };
  }, [firebaseUser]);

  // Listen to messages
  useEffect(() => {
    if (!activeRoom) return;
    const colPath = activeRoom.type==='group'
      ? `groups/${activeRoom.id}/messages`
      : `dms/${activeRoom.id}/messages`;
    const q = query(collection(db,colPath), orderBy('timestamp','asc'));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setMessages(msgs);
      // Mark unseen messages as seen
      msgs.forEach(msg => {
        if (msg.sender !== firebaseUser.uid && !(msg.seenBy||[]).includes(firebaseUser.uid)) {
          updateDoc(doc(db,colPath,msg.id), { seenBy: arrayUnion(firebaseUser.uid) }).catch(()=>{});
        }
      });
    });
    return () => unsub();
  }, [activeRoom, firebaseUser]);

  // Socket for typing + online
  useEffect(() => {
    if (!activeRoom) return;
    socket.connect();
    socket.emit('join_room', { username:userProfile.handle, room:activeRoom.id });
    socket.on('user_typing', ({username:u}) => setTypingUsers(p=>[...new Set([...p,u])]));
    socket.on('user_stop_typing', ({username:u}) => setTypingUsers(p=>p.filter(x=>x!==u)));
    socket.on('user_online', ({username:u}) => setOnlineSet(p=>new Set([...p,u])));
    socket.on('user_offline', ({username:u}) => setOnlineSet(p=>{ const s=new Set(p); s.delete(u); return s; }));
    return () => {
      ['user_typing','user_stop_typing','user_online','user_offline'].forEach(e=>socket.off(e));
      socket.disconnect();
    };
  }, [activeRoom, userProfile]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, typingUsers]);

  // Fetch last seen for DM partner
  useEffect(() => {
    if (!activeRoom || activeRoom.type !== 'dm') return;
    const otherHandle = activeRoom.name;
    const fetch = async () => {
      const snap = await getDocs(query(collection(db,'users'), where('handle','==',otherHandle)));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setLastSeenMap(p=>({ ...p, [otherHandle]: data.lastSeen }));
      }
    };
    fetch();
  }, [activeRoom]);

  const sendMessage = async () => {
    if (!input.trim() || !activeRoom) return;
    const colPath = activeRoom.type==='group'
      ? `groups/${activeRoom.id}/messages`
      : `dms/${activeRoom.id}/messages`;
    await addDoc(collection(db,colPath), {
      text:input.trim(), sender:firebaseUser.uid,
      senderHandle:userProfile.handle,
      timestamp:serverTimestamp(), seenBy:[firebaseUser.uid],
    });
    socket.emit('send_message', { room:activeRoom.id, message:input.trim() });
    setInput('');
    setIsTyping(false);
    socket.emit('stop_typing',{room:activeRoom.id, username:userProfile.handle});
    clearTimeout(typingRef.current);
  };

  const handleInputChange = e => {
    setInput(e.target.value);
    if (!isTyping) { setIsTyping(true); socket.emit('typing',{room:activeRoom.id, username:userProfile.handle}); }
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(()=>{ setIsTyping(false); socket.emit('stop_typing',{room:activeRoom.id, username:userProfile.handle}); },1500);
  };

  const deleteMessage = async (msgId) => {
    if (!activeRoom) return;
    const colPath = activeRoom.type==='group'
      ? `groups/${activeRoom.id}/messages`
      : `dms/${activeRoom.id}/messages`;
    await deleteDoc(doc(db,colPath,msgId));
  };

  const startDM = user => {
    const id = getRoomId(firebaseUser.uid, user.uid);
    if (!dmList.find(d=>d.id===id)) setDmList(p=>[...p,{id,name:user.handle,uid:user.uid}]);
    setActiveRoom({ type:'dm', id, name:user.handle });
    setModal(null);
  };

  const openGroup = g => {
    setActiveRoom({ type:'group', id:g.id, name:g.name });
  };

  const signOut = () => {
    updateDoc(doc(db,'users',firebaseUser.uid),{online:false,lastSeen:serverTimestamp()}).catch(()=>{});
    auth.signOut();
  };

  // ─── Sidebar item ─────────────────────────────────────────────────────────
  const SidebarItem = ({ label, isActive, onClick, isDM, isGroup, extra }) => (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'9px 12px', borderRadius:12, cursor:'pointer',
      background: isActive ? 'linear-gradient(135deg,rgba(79,70,229,0.25),rgba(219,39,119,0.15))' : 'transparent',
      border: isActive ? '1px solid rgba(129,140,248,0.2)' : '1px solid transparent',
      marginBottom:3, transition:'all 0.18s',
    }}>
      {isDM ? <div style={{position:'relative'}}><Avatar name={label} size={26}/><div style={{ position:'absolute', bottom:0, right:0, width:8, height:8, borderRadius:'50%', background: onlineSet.has(label)?'#10b981':'rgba(255,255,255,0.2)', border:'2px solid #0d0d18' }}/></div>
       : isGroup ? <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,rgba(129,140,248,0.3),rgba(244,114,182,0.2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#a5b4fc' }}>{label[0]}</div>
       : <span style={{ color:isActive?'#818cf8':'rgba(255,255,255,0.3)', fontWeight:800, fontSize:16 }}>#</span>
      }
      <span style={{ fontSize:13, fontWeight:isActive?700:400, color:isActive?'#fff':'rgba(255,255,255,0.5)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Syne,sans-serif' }}>{label}</span>
      {extra}
    </div>
  );

  const isOtherOnline = activeRoom?.type==='dm' && onlineSet.has(activeRoom.name);

  return (
    <div style={{ height:'100vh', display:'flex', background:'#0d0d18', fontFamily:'Syne,sans-serif', color:'#fff', overflow:'hidden', position:'relative' }}>

      {/* Ambient background */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,70,229,0.07) 0%,transparent 70%)', top:-200, left:-200, animation:'driftA 12s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(219,39,119,0.06) 0%,transparent 70%)', bottom:-100, right:-100, animation:'driftB 14s ease-in-out infinite' }}/>
      </div>

      {/* Modals */}
      {modal==='newDM' && <NewDMModal currentUser={{...userProfile, uid:firebaseUser.uid}} onStart={startDM} onClose={()=>setModal(null)}/>}
      {modal==='createGroup' && <CreateGroupModal currentUser={{...userProfile,uid:firebaseUser.uid}} onCreated={g=>{ setGroupList(p=>[...p,g]); openGroup(g); setModal(null); }} onClose={()=>setModal(null)}/>}
      {modal==='editGroup' && editTarget && <EditGroupModal group={editTarget} currentUser={{...userProfile,uid:firebaseUser.uid}} onClose={()=>{ setModal(null); setEditTarget(null); }} onUpdated={g=>{ setGroupList(p=>p.map(x=>x.id===g.id?g:x)); setActiveRoom(r=>r?.id===g.id?{...r,name:g.name}:r); }}/>}

      {/* ── Sidebar ── */}
      <div style={{ width:248, flexShrink:0, background:'rgba(255,255,255,0.025)', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#db2777)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 16px rgba(79,70,229,0.4)', animation:'logoBob 3s ease-in-out infinite' }}>💬</div>
            <div>
              <div style={{ fontWeight:800, fontSize:17, letterSpacing:'-0.5px', background:'linear-gradient(135deg,#e0e7ff,#fbcfe8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>NexChat</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.05em' }}>v2.0</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 10px' }}>

          {/* DMs */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Direct Messages</span>
            <button onClick={()=>setModal('newDM')} style={{ background:'none', border:'none', color:'#818cf8', fontSize:20, cursor:'pointer', lineHeight:1, padding:'0 2px' }} title="New DM">+</button>
          </div>
          {dmList.length===0 && <p style={{ fontSize:12, color:'rgba(255,255,255,0.2)', padding:'2px 4px 10px', fontFamily:'Syne,sans-serif' }}>Click + to start a DM</p>}
          {dmList.map(dm=>(
            <SidebarItem key={dm.id} label={dm.name} isActive={activeRoom?.id===dm.id} onClick={()=>setActiveRoom({type:'dm',id:dm.id,name:dm.name})} isDM/>
          ))}

          {/* Groups */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px', margin:'12px 0 6px' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Groups</span>
            <button onClick={()=>setModal('createGroup')} style={{ background:'none', border:'none', color:'#818cf8', fontSize:20, cursor:'pointer', lineHeight:1, padding:'0 2px' }} title="Create Group">+</button>
          </div>
          {groupList.length===0 && <p style={{ fontSize:12, color:'rgba(255,255,255,0.2)', padding:'2px 4px 8px', fontFamily:'Syne,sans-serif' }}>Click + to create a group</p>}
          {groupList.map(g=>(
            <SidebarItem key={g.id} label={g.name} isActive={activeRoom?.id===g.id} onClick={()=>openGroup(g)} isGroup
              extra={g.createdBy===firebaseUser.uid && (
                <button onClick={e=>{e.stopPropagation();setEditTarget(g);setModal('editGroup');}} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:13, padding:'2px 4px' }} title="Edit">✏️</button>
              )}
            />
          ))}
        </div>

        {/* Profile */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative' }}>
            <Avatar name={userProfile.handle} size={34}/>
            <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'#10b981', border:'2px solid #0d0d18', boxShadow:'0 0 6px #10b981' }}/>
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>@{userProfile.handle}</div>
            <div style={{ fontSize:10, color:'#10b981' }}>● Online</div>
          </div>
          <button onClick={signOut} title="Sign out" style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)', cursor:'pointer', fontSize:15, padding:4, transition:'color 0.15s' }}>⏻</button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', zIndex:1 }}>
        {!activeRoom ? (
          // Empty state
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
            <div style={{ fontSize:64, animation:'logoBob 3s ease-in-out infinite' }}>💬</div>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:800, background:'linear-gradient(135deg,#e0e7ff,#fbcfe8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Welcome to NexChat</h2>
              <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, margin:0 }}>Open a DM or join a group to start chatting</p>
            </div>
            <div style={{ display:'flex', gap:12, marginTop:8 }}>
              <button onClick={()=>setModal('newDM')} style={{ padding:'10px 20px', background:'rgba(129,140,248,0.15)', border:'1px solid rgba(129,140,248,0.3)', borderRadius:12, color:'#a5b4fc', cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'Syne,sans-serif' }}>+ New DM</button>
              <button onClick={()=>setModal('createGroup')} style={{ padding:'10px 20px', background:'rgba(219,39,119,0.12)', border:'1px solid rgba(219,39,119,0.25)', borderRadius:12, color:'#f9a8d4', cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'Syne,sans-serif' }}>+ Create Group</button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.02)', backdropFilter:'blur(10px)' }}>
              {activeRoom.type==='dm'
                ? <div style={{position:'relative'}}><Avatar name={activeRoom.name} size={40} showRing={isOtherOnline}/><div style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:isOtherOnline?'#10b981':'rgba(255,255,255,0.15)', border:'2px solid #0d0d18' }}/></div>
                : <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,rgba(129,140,248,0.25),rgba(244,114,182,0.2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#a5b4fc' }}>{activeRoom.name[0]}</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:17 }}>
                  {activeRoom.type==='dm' ? `@${activeRoom.name}` : activeRoom.name}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>
                  {activeRoom.type==='dm'
                    ? isOtherOnline ? <span style={{color:'#10b981'}}>● Online now</span>
                      : `Last seen ${fmtLastSeen(lastSeenMap[activeRoom.name])}`
                    : `${groupList.find(g=>g.id===activeRoom.id)?.members?.length||0} members`
                  }
                </div>
              </div>
              {activeRoom.type==='group' && groupList.find(g=>g.id===activeRoom.id)?.createdBy===firebaseUser.uid && (
                <button onClick={()=>{ setEditTarget(groupList.find(g=>g.id===activeRoom.id)); setModal('editGroup'); }} style={{ background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:10, color:'#a5b4fc', cursor:'pointer', padding:'7px 14px', fontSize:12, fontWeight:700, fontFamily:'Syne,sans-serif' }}>
                  ✏️ Edit Group
                </button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
              {messages.length===0 && (
                <div style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', marginTop:60 }}>
                  <div style={{ fontSize:44, marginBottom:14 }}>{activeRoom.type==='dm'?'👋':'🎉'}</div>
                  <div style={{ fontSize:16, fontWeight:800 }}>{activeRoom.type==='dm'?`Start chatting with @${activeRoom.name}`:`Welcome to ${activeRoom.name}`}</div>
                  <div style={{ fontSize:13, marginTop:6, color:'rgba(255,255,255,0.18)' }}>Send the first message!</div>
                </div>
              )}
              {messages.map((msg,i)=>{
                const prev = messages[i-1];
                const prevSameUser = prev && !prev.system && prev.sender===msg.sender;
                return <Message key={msg.id} msg={msg} isOwn={msg.sender===firebaseUser.uid} prevSameUser={prevSameUser} onDelete={deleteMessage} currentUid={firebaseUser.uid}/>;
              })}
              <TypingDots users={typingUsers.filter(u=>u!==userProfile.handle)}/>
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
              <div style={{ display:'flex', gap:10, alignItems:'center', background:'rgba(255,255,255,0.055)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:18, padding:'6px 6px 6px 18px', transition:'border-color 0.2s', boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
                  placeholder={activeRoom.type==='dm'?`Message @${activeRoom.name}…`:`Message ${activeRoom.name}…`}
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:14, fontFamily:'Syne,sans-serif' }}
                />
                <button onClick={sendMessage} disabled={!input.trim()} style={{
                  width:42, height:42, borderRadius:13, border:'none',
                  background: input.trim() ? 'linear-gradient(135deg,#4f46e5,#db2777)' : 'rgba(255,255,255,0.06)',
                  color: input.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, flexShrink:0, transition:'all 0.2s',
                  boxShadow: input.trim() ? '0 4px 20px rgba(79,70,229,0.5)' : 'none',
                }}>↑</button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
        @keyframes msgIn { from{opacity:0;transform:translateY(10px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes driftA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(50px,30px)} }
        @keyframes driftB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-40px,-50px)} }
        @keyframes logoBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        input::placeholder { color:rgba(255,255,255,0.22); }
      `}</style>
    </div>
  );
}