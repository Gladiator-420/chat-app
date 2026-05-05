import { useEffect, useRef } from 'react';

export default function SpaceBg({ intensity = 'full' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animId;
    let W, H;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ⭐ Stars (NOW WITH MOVEMENT)
    const STAR_COUNT = intensity === 'full' ? 280 : 160;
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const speedFactor = Math.random() * 0.5 + 0.5;

      return {
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.6 + 0.2,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
        color: ['#ffffff', '#c7d2fe', '#fbcfe8', '#bfdbfe', '#fde68a'][Math.floor(Math.random() * 5)],

        // movement
        vx: (Math.random() - 0.5) * 0.0006 * speedFactor,
        vy: (Math.random() - 0.5) * 0.0006 * speedFactor,
      };
    });

    // 🌠 Shooting stars (IMPROVED)
    const shoots = [];
    const spawnShoot = () => {
      const fromLeft = Math.random() > 0.5;

      shoots.push({
        x: fromLeft ? 0 : W,
        y: Math.random() * H * 0.4,
        vx: fromLeft ? (Math.random() * 6 + 6) : -(Math.random() * 6 + 6),
        vy: Math.random() * 3 + 2,
        len: Math.random() * 180 + 120,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 30 + 20,
      });
    };

    // Nebula clouds
    const nebulae = [
      { x: 0.15, y: 0.25, r: 280, c: 'rgba(99,102,241,0.06)' },
      { x: 0.78, y: 0.65, r: 320, c: 'rgba(219,39,119,0.05)' },
      { x: 0.45, y: 0.8, r: 200, c: 'rgba(167,139,250,0.04)' },
      { x: 0.85, y: 0.1, r: 240, c: 'rgba(52,211,153,0.035)' },
      { x: 0.2, y: 0.75, r: 180, c: 'rgba(251,191,36,0.03)' },
    ];

    // Galaxies
    const galaxies = Array.from({ length: 6 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 12 + 6,
      angle: Math.random() * Math.PI * 2,
      color: ['rgba(199,210,254,0.4)','rgba(253,186,116,0.35)','rgba(134,239,172,0.3)'][Math.floor(Math.random()*3)],
    }));

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(W*0.5, H*0.3, 0, W*0.5, H*0.5, Math.max(W,H)*0.8);
      bg.addColorStop(0, '#0d0820');
      bg.addColorStop(0.4, '#07070f');
      bg.addColorStop(1, '#030308');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula
      nebulae.forEach(n => {
        const grd = ctx.createRadialGradient(n.x*W, n.y*H, 0, n.x*W, n.y*H, n.r);
        grd.addColorStop(0, n.c);
        grd.addColorStop(1, 'transparent');

        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(
          n.x*W,
          n.y*H,
          n.r*(1+0.15*Math.sin(t*0.003+n.x*10)),
          n.r*0.7*(1+0.1*Math.cos(t*0.004+n.y*8)),
          Math.sin(t*0.001)*0.3,
          0,
          Math.PI*2
        );
        ctx.fill();
      });

      // Milky Way
      const mw = ctx.createLinearGradient(0, H*0.3, W, H*0.7);
      mw.addColorStop(0, 'transparent');
      mw.addColorStop(0.3, 'rgba(99,102,241,0.025)');
      mw.addColorStop(0.5, 'rgba(167,139,250,0.04)');
      mw.addColorStop(0.7, 'rgba(219,39,119,0.02)');
      mw.addColorStop(1, 'transparent');
      ctx.fillStyle = mw;
      ctx.fillRect(0, 0, W, H);

      // Galaxies
      galaxies.forEach(g => {
        ctx.save();
        ctx.translate(g.x*W, g.y*H);
        ctx.rotate(g.angle + t*0.0002);

        const gg = ctx.createRadialGradient(0,0,0,0,0,g.r);
        gg.addColorStop(0, g.color);
        gg.addColorStop(0.4, g.color.replace(/[\d.]+\)$/, '0.15)'));
        gg.addColorStop(1, 'transparent');

        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.ellipse(0,0,g.r,g.r*0.4,0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      });

      // ⭐ Stars (movement added)
      stars.forEach(s => {
        // move
        s.x += s.vx;
        s.y += s.vy;

        // wrap
        if (s.x < 0) s.x = 1;
        if (s.x > 1) s.x = 0;
        if (s.y < 0) s.y = 1;
        if (s.y > 1) s.y = 0;

        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.4 + 0.6;
        ctx.globalAlpha = s.alpha * twinkle;

        if (s.r > 1.2) {
          const glow = ctx.createRadialGradient(s.x*W, s.y*H, 0, s.x*W, s.y*H, s.r*4);
          glow.addColorStop(0, s.color);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(s.x*W, s.y*H, s.r*4, 0, Math.PI*2);
          ctx.fill();
        }

        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;

      // 🌠 Sudden shooting stars
      if (Math.random() < 0.02) {
        spawnShoot();
      }

      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i];

        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        s.alpha = 1 - s.life / s.maxLife;

        if (s.life >= s.maxLife) {
          shoots.splice(i, 1);
          continue;
        }

        const dist = Math.sqrt(s.vx**2 + s.vy**2);
        const nx = s.x - (s.vx / dist) * s.len;
        const ny = s.y - (s.vy / dist) * s.len;

        const trail = ctx.createLinearGradient(nx, ny, s.x, s.y);
        trail.addColorStop(0, 'transparent');
        trail.addColorStop(0.7, `rgba(200,210,255,${s.alpha * 0.6})`);
        trail.addColorStop(1, `rgba(255,255,255,${s.alpha})`);

        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        const sp = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 4);
        sp.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
        sp.addColorStop(1, 'transparent');

        ctx.fillStyle = sp;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}