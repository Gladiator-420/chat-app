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

    // ⭐ Stars — multi-layer + realistic twinkling
    const STAR_COUNT = intensity === 'full' ? 550 : 320;

    const stars = Array.from({ length: STAR_COUNT }, () => {
      const depth = Math.random();

      const isBright = depth > 0.9;
      const isMid = depth > 0.65 && !isBright;

      return {
        x: Math.random(),
        y: Math.random(),

        r: isBright
          ? Math.random() * 1.4 + 1.2
          : isMid
          ? Math.random() * 0.8 + 0.5
          : Math.random() * 0.3 + 0.1,

        baseAlpha: isBright
          ? Math.random() * 0.4 + 0.6
          : isMid
          ? Math.random() * 0.3 + 0.3
          : Math.random() * 0.2 + 0.08,

        depth,

        twinkleSpeed: 0.002 + Math.random() * 0.02 * (depth + 0.3),
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleDepth: isBright
          ? 0.6 + Math.random() * 0.3
          : 0.2 + Math.random() * 0.3,

        flickerChance: isBright ? 0.02 : 0.005,

        color: isBright
          ? ['#ffffff', '#ffe9c4', '#dbeafe', '#fbcfe8', '#a5f3fc'][Math.floor(Math.random() * 5)]
          : ['#ffffff', '#cbd5ff', '#e0f2fe'][Math.floor(Math.random() * 3)],

        glowSize: isBright ? Math.random() * 6 + 5 : 0,
      };
    });

    // 🌠 Shooting stars
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

    // Nebulae
    const nebulae = [
      { x: 0.12, y: 0.22, rx: 220, ry: 140, c: 'rgba(55,48,163,0.07)', rot: 0.3 },
      { x: 0.80, y: 0.62, rx: 260, ry: 170, c: 'rgba(157,23,77,0.055)', rot: -0.2 },
      { x: 0.45, y: 0.82, rx: 160, ry: 100, c: 'rgba(109,40,217,0.05)', rot: 0.5 },
      { x: 0.88, y: 0.12, rx: 190, ry: 120, c: 'rgba(6,95,70,0.04)', rot: -0.4 },
      { x: 0.22, y: 0.72, rx: 140, ry: 90, c: 'rgba(146,64,14,0.04)', rot: 0.1 },
      { x: 0.55, y: 0.38, rx: 300, ry: 160, c: 'rgba(30,27,75,0.06)', rot: 0.6 },
    ];

    // Galaxies
    const galaxies = Array.from({ length: 5 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 10 + 5,
      angle: Math.random() * Math.PI * 2,
      color: [
        'rgba(165,180,252,0.18)',
        'rgba(253,186,116,0.14)',
        'rgba(110,231,183,0.12)',
      ][Math.floor(Math.random() * 3)],
    }));

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
      bg.addColorStop(0, '#060412');
      bg.addColorStop(0.35, '#040309');
      bg.addColorStop(0.7, '#020205');
      bg.addColorStop(1, '#010103');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebulae
      nebulae.forEach(n => {
        const grd = ctx.createRadialGradient(n.x * W, n.y * H, 0, n.x * W, n.y * H, Math.max(n.rx, n.ry));
        grd.addColorStop(0, n.c);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;

        ctx.beginPath();
        ctx.ellipse(n.x * W, n.y * H, n.rx, n.ry, n.rot, 0, Math.PI * 2);
        ctx.fill();
      });

      // ⭐ Stars (advanced twinkle)
      stars.forEach(s => {
        const wave = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * s.twinkleDepth;

        const noise =
          (Math.sin(t * 0.05 + s.x * 50) +
            Math.cos(t * 0.03 + s.y * 50)) * 0.05;

        let flicker = 1;
        if (Math.random() < s.flickerChance) {
          flicker = 1.8 + Math.random() * 0.8;
        }

        const alpha = Math.max(0, s.baseAlpha * (1 + wave + noise) * flicker);

        if (s.glowSize > 0) {
          ctx.globalAlpha = alpha * 0.35;
          const glow = ctx.createRadialGradient(
            s.x * W,
            s.y * H,
            0,
            s.x * W,
            s.y * H,
            s.glowSize
          );
          glow.addColorStop(0, s.color);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(s.x * W, s.y * H, s.glowSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;

      // Shooting stars
      if (Math.random() < 0.02) spawnShoot();

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

        const dist = Math.sqrt(s.vx ** 2 + s.vy ** 2);
        const nx = s.x - (s.vx / dist) * s.len;
        const ny = s.y - (s.vy / dist) * s.len;

        const trail = ctx.createLinearGradient(nx, ny, s.x, s.y);
        trail.addColorStop(0, 'transparent');
        trail.addColorStop(1, `rgba(255,255,255,${s.alpha})`);

        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
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