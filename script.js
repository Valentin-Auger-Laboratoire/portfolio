// ===== Fond animé : graphe de nœuds (style réseau / réseau de neurones) =====
(() => {
  const canvas = document.getElementById('network-bg');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LINK_DIST = 140;
  let nodes = [], w, h;
  let accentRGB = '79, 209, 197';
  const readAccent = () => {
    accentRGB = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || accentRGB;
    if (reduceMotion) draw();
  };
  document.addEventListener('accentchange', readAccent);

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(90, Math.floor((w * h) / 16000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK_DIST) {
          ctx.strokeStyle = `rgba(${accentRGB}, ${0.18 * (1 - d / LINK_DIST)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(122, 162, 247, 0.6)';
      ctx.beginPath(); ctx.arc(a.x, a.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function step() {
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    draw();
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', () => { resize(); if (reduceMotion) draw(); });
  resize();
  readAccent();
  reduceMotion ? draw() : step();
})();

// ===== Filtres des projets =====
document.querySelectorAll('.filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    document.querySelectorAll('.project-card').forEach(card => {
      card.classList.toggle('hidden', f !== 'all' && !card.dataset.tags.split(' ').includes(f));
    });
  });
});

// ===== Menu mobile =====
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// ===== Lien actif dans la nav selon la section visible =====
const links = [...nav.querySelectorAll('a')];
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => observer.observe(s));

document.getElementById('year').textContent = new Date().getFullYear();

// ===== TEMPORAIRE — sélecteur de couleur d'accent (à supprimer une fois le choix fait) =====
(() => {
  const ACCENTS = [
    { id: 'cyan',   label: 'Cyan',           color: '#4fd1c5' },
    { id: 'vert',   label: 'Vert terminal',  color: '#7ee787' },
    { id: 'violet', label: 'Violet',         color: '#b39dfa' },
    { id: 'ambre',  label: 'Ambre',          color: '#f0b35a' },
    { id: 'bleu',   label: 'Bleu',           color: '#6cb6ff' },
  ];
  const box = document.createElement('div');
  box.className = 'picker';
  box.innerHTML = '<p>accent : <b></b></p><div class="swatches"></div>';
  const name = box.querySelector('b');
  const row = box.querySelector('.swatches');

  function apply(id) {
    const a = ACCENTS.find(x => x.id === id) || ACCENTS[0];
    if (a.id === 'cyan') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', a.id);
    name.textContent = a.label;
    row.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.id === a.id));
    try { localStorage.setItem('accent', a.id); } catch (e) {}
    document.dispatchEvent(new Event('accentchange'));
  }

  ACCENTS.forEach(a => {
    const b = document.createElement('button');
    b.className = 'swatch'; b.dataset.id = a.id;
    b.style.setProperty('--c', a.color);
    b.setAttribute('aria-label', a.label); b.title = a.label;
    b.addEventListener('click', () => apply(a.id));
    row.appendChild(b);
  });
  document.body.appendChild(box);

  let saved = 'cyan';
  try { saved = localStorage.getItem('accent') || 'cyan'; } catch (e) {}
  apply(saved);
})();
