export default function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#07070f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Syne', sans-serif",
      overflow: 'hidden',
    }}>
      {/* Animated mesh background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div className="mesh-blob mesh-1" />
        <div className="mesh-blob mesh-2" />
        <div className="mesh-blob mesh-3" />
        {/* Floating particles */}
        {Array.from({length: 18}).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random()*100}%`,
            top: `${Math.random()*100}%`,
            animationDelay: `${Math.random()*4}s`,
            animationDuration: `${3 + Math.random()*4}s`,
            width: `${2 + Math.random()*3}px`,
            height: `${2 + Math.random()*3}px`,
            opacity: 0.3 + Math.random()*0.4,
          }}/>
        ))}
      </div>

      {/* Logo */}
      <div className="logo-container">
        <div className="logo-ring logo-ring-1" />
        <div className="logo-ring logo-ring-2" />
        <div className="logo-ring logo-ring-3" />
        <div className="logo-core">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M18 4C10.268 4 4 9.82 4 17c0 3.4 1.36 6.5 3.6 8.84L6 32l6.5-1.7A14.4 14.4 0 0018 31c7.732 0 14-5.82 14-13S25.732 4 18 4z"
              fill="url(#logoGrad)" />
            <circle cx="12" cy="17" r="2" fill="white" opacity="0.9"/>
            <circle cx="18" cy="17" r="2" fill="white" opacity="0.9"/>
            <circle cx="24" cy="17" r="2" fill="white" opacity="0.9"/>
            <defs>
              <linearGradient id="logoGrad" x1="4" y1="4" x2="32" y2="32">
                <stop offset="0%" stopColor="#818cf8"/>
                <stop offset="100%" stopColor="#f472b6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* App name with letter animation */}
      <div className="app-name">
        {'NexChat'.split('').map((letter, i) => (
          <span key={i} className="letter" style={{ animationDelay: `${0.4 + i * 0.07}s` }}>
            {letter}
          </span>
        ))}
      </div>
      <p className="tagline">Real-time. Encrypted. Beautiful.</p>

      {/* Progress bar */}
      <div className="progress-track">
        <div className="progress-fill" />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');

        .mesh-blob {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
        }
        .mesh-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(129,140,248,0.18) 0%, transparent 70%);
          top: -200px; left: -100px;
          animation: driftA 8s ease-in-out infinite;
        }
        .mesh-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(244,114,182,0.14) 0%, transparent 70%);
          bottom: -150px; right: -100px;
          animation: driftB 10s ease-in-out infinite;
        }
        .mesh-3 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(99,220,214,0.1) 0%, transparent 70%);
          top: 40%; left: 40%;
          animation: driftC 7s ease-in-out infinite;
        }
        .particle {
          position: absolute; border-radius: 50%;
          background: rgba(129,140,248,0.6);
          animation: floatUp linear infinite;
        }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.6; }
          100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
        }
        @keyframes driftA {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.1); }
        }
        @keyframes driftB {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-40px, -60px) scale(0.9); }
        }
        @keyframes driftC {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.05); }
          66% { transform: translate(20px, -30px) scale(0.95); }
        }

        .logo-container {
          position: relative; width: 100px; height: 100px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 28px;
          animation: logoEntrance 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes logoEntrance {
          from { opacity:0; transform: scale(0.4) rotate(-20deg); }
          to { opacity:1; transform: scale(1) rotate(0deg); }
        }
        .logo-ring {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(129,140,248,0.25);
        }
        .logo-ring-1 { width: 100px; height: 100px; animation: spinRing 12s linear infinite; }
        .logo-ring-2 { width: 76px; height: 76px; border-color: rgba(244,114,182,0.2); animation: spinRing 8s linear infinite reverse; }
        .logo-ring-3 { width: 54px; height: 54px; border-color: rgba(99,220,214,0.2); animation: spinRing 5s linear infinite; }
        @keyframes spinRing { to { transform: rotate(360deg); } }

        .logo-core {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #4f46e5, #db2777);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 40px rgba(129,140,248,0.5), 0 0 80px rgba(244,114,182,0.2);
          animation: corePulse 2s ease-in-out infinite;
          position: relative; z-index: 2;
        }
        @keyframes corePulse {
          0%,100% { box-shadow: 0 0 40px rgba(129,140,248,0.5), 0 0 80px rgba(244,114,182,0.2); }
          50% { box-shadow: 0 0 60px rgba(129,140,248,0.7), 0 0 100px rgba(244,114,182,0.35); }
        }

        .app-name {
          display: flex; gap: 1px;
          font-size: 42px; font-weight: 800; letter-spacing: -1px;
          margin-bottom: 10px; overflow: hidden;
        }
        .letter {
          display: inline-block; color: transparent;
          background: linear-gradient(135deg, #e0e7ff 30%, #f9a8d4);
          -webkit-background-clip: text; background-clip: text;
          opacity: 0; transform: translateY(30px);
          animation: letterRise 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes letterRise {
          to { opacity:1; transform: translateY(0); }
        }

        .tagline {
          color: rgba(255,255,255,0.35); font-size: 13px;
          letter-spacing: 0.15em; text-transform: uppercase;
          margin: 0 0 40px; font-weight: 400;
          animation: fadeIn 0.6s 1s ease forwards; opacity: 0;
          font-family: 'Syne', sans-serif;
        }
        @keyframes fadeIn { to { opacity:1; } }

        .progress-track {
          width: 180px; height: 2px;
          background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;
          animation: fadeIn 0.4s 0.8s ease forwards; opacity: 0;
        }
        .progress-fill {
          height: 100%; width: 0%; border-radius: 2px;
          background: linear-gradient(90deg, #818cf8, #f472b6);
          animation: progressLoad 1.8s 1s cubic-bezier(0.4,0,0.2,1) forwards;
          box-shadow: 0 0 10px rgba(129,140,248,0.8);
        }
        @keyframes progressLoad { to { width: 100%; } }
      `}</style>
    </div>
  );
}