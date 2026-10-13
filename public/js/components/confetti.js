/* ─── Canvas Confetti ─────────────────────────────────────────────────────── */
const Confetti = (() => {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animFrame = null;

  const COLORS = ['#6366f1','#14b8a6','#f59e0b','#f43f5e','#10b981','#a855f7','#818cf8','#2dd4bf'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle(x, y) {
    return {
      x: x ?? Math.random() * canvas.width,
      y: y ?? -10,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1,
      gravity: 0.12,
    };
  }

  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.rotation += p.rotSpeed;
      if (p.y > canvas.height * 0.8) p.opacity -= 0.02;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    particles = particles.filter(p => p.opacity > 0 && p.y < canvas.height + 20);
    if (particles.length > 0) {
      animFrame = requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  return {
    fire(count = 150) {
      resize();
      if (animFrame) cancelAnimationFrame(animFrame);
      // Burst from center-top
      for (let i = 0; i < count; i++) {
        const p = createParticle(
          canvas.width * 0.3 + Math.random() * canvas.width * 0.4,
          canvas.height * 0.1
        );
        p.vy = Math.random() * 10 + 2;
        p.vx = (Math.random() - 0.5) * 12;
        particles.push(p);
      }
      animFrame = requestAnimationFrame(step);
    }
  };
})();

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
