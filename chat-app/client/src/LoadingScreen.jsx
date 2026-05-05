import { useEffect, useRef } from 'react';

export default function LoadingScreen() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const W = canvas.width, H = canvas.height;

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.6 + 0.4,
      tw: Math.random() * 0.02 + 0.005,
      off: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W*.5,H*.4,0,W*.5,H*.5,Math.max(W,H));
      bg.addColorStop(0,'#0f0820'); bg.addColorStop(.5,'#07070f'); bg.addColorStop(1,'#030308');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      stars.forEach(s => {
        const tw = Math.sin(t*s.tw+s.off)*0.4+0.6;
        ctx.globalAlpha = s.alpha*tw;
        ctx.fillStyle='#c7d2fe';
        ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha=1;
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", overflow:'hidden' }}>
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0 }}/>

      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
        {/* Orbital rings */}
        <div style={{ position:'relative', width:140, height:140, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:40 }}>
          {/* Ring 1 */}
          <div style={{ position:'absolute', width:140, height:140, borderRadius:'50%', border:'1px solid rgba(129,140,248,0.3)', animation:'orbitSpin1 6s linear infinite' }}>
            <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:8, height:8, borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 12px #818cf8' }}/>
          </div>
          {/* Ring 2 */}
          <div style={{ position:'absolute', width:110, height:110, borderRadius:'50%', border:'1px solid rgba(244,114,182,0.25)', animation:'orbitSpin2 4s linear infinite' }}>
            <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:7, height:7, borderRadius:'50%', background:'#f472b6', boxShadow:'0 0 10px #f472b6' }}/>
          </div>
          {/* Ring 3 */}
          <div style={{ position:'absolute', width:80, height:80, borderRadius:'50%', border:'1px dashed rgba(52,211,153,0.2)', animation:'orbitSpin3 3s linear infinite' }}>
            <div style={{ position:'absolute', bottom:-3, left:'50%', transform:'translateX(-50%)', width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 8px #34d399' }}/>
          </div>
          {/* Core */}
          <div style={{
            width:60, height:60, borderRadius:18,
            background:'linear-gradient(135deg,#4f46e5,#7c3aed,#db2777)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, zIndex:2,
            boxShadow:'0 0 40px rgba(79,70,229,0.7), 0 0 80px rgba(219,39,119,0.3), 0 0 120px rgba(79,70,229,0.2)',
            animation:'coreGlow 2s ease-in-out infinite',
          }}>💬</div>
        </div>

        {/* App name */}
        <div style={{ display:'flex', gap:2, marginBottom:12, overflow:'hidden' }}>
          {'NexChat'.split('').map((l,i) => (
            <span key={i} style={{
              display:'inline-block', fontSize:46, fontWeight:800, letterSpacing:'-1px',
              background:'linear-gradient(135deg,#e0e7ff 20%,#a5b4fc 50%,#fbcfe8 80%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              opacity:0, transform:'translateY(30px)',
              animation:`letterRise 0.5s cubic-bezier(0.34,1.56,0.64,1) ${0.5+i*0.07}s forwards`,
            }}>{l}</span>
          ))}
        </div>

        <p style={{ color:'rgba(255,255,255,0.3)', fontSize:12, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:44, animation:'fadeIn 0.6s 1.2s forwards', opacity:0 }}>
          Across the universe
        </p>

        {/* Progress */}
        <div style={{ width:200, height:2, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden', animation:'fadeIn 0.4s 1s forwards', opacity:0 }}>
          <div style={{ height:'100%', borderRadius:2, background:'linear-gradient(90deg,#4f46e5,#818cf8,#db2777)', backgroundSize:'200%', animation:'progressLoad 2s 1s cubic-bezier(0.4,0,0.2,1) forwards, shimmer 1.5s 1s linear infinite', boxShadow:'0 0 10px rgba(129,140,248,0.8)', width:0 }}/>
        </div>

        {/* Stars scatter around */}
        {[...Array(8)].map((_,i) => (
          <div key={i} style={{
            position:'absolute',
            width: 3+i%3, height: 3+i%3,
            borderRadius:'50%',
            background:['#818cf8','#f472b6','#34d399','#fbbf24'][i%4],
            left:`${-80+i*30}px`, top:`${-60+i*25}px`,
            boxShadow:`0 0 6px ${'#818cf8'}`,
            animation:`twinkle ${1.5+i*0.3}s ${i*0.2}s ease-in-out infinite`,
          }}/>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap');
        @keyframes orbitSpin1 { to{transform:rotate(360deg)} }
        @keyframes orbitSpin2 { to{transform:rotate(-360deg)} }
        @keyframes orbitSpin3 { to{transform:rotate(360deg)} }
        @keyframes coreGlow { 0%,100%{box-shadow:0 0 40px rgba(79,70,229,0.7),0 0 80px rgba(219,39,119,0.3)} 50%{box-shadow:0 0 70px rgba(79,70,229,0.9),0 0 120px rgba(219,39,119,0.5),0 0 160px rgba(79,70,229,0.2)} }
        @keyframes letterRise { to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { to{opacity:1} }
        @keyframes progressLoad { to{width:100%} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes twinkle { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }
      `}</style>
    </div>
  );
}