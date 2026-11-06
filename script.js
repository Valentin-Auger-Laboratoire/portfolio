// ===== Nombre de projets (au bout de la ligne du titre) =====
const projTitle = document.querySelector('.section-title--count');
if (projTitle) projTitle.dataset.count = document.querySelectorAll('.project-card').length;

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


// ===== Langue FR / EN =====
// Le français est dans index.html ; l'anglais dans traduction-anglais.js (window.I18N_EN).
(() => {
  const EN = window.I18N_EN || {};
  const textEls = [...document.querySelectorAll('[data-i18n]')];
  const attrEls = [...document.querySelectorAll('[data-i18n-attr]')];
  // On mémorise le français d'origine pour pouvoir y revenir
  textEls.forEach(el => { el.dataset.fr = el.innerHTML; });
  attrEls.forEach(el => {
    el._fr = {};
    el.dataset.i18nAttr.split(';').forEach(pair => {
      const [attr] = pair.split(':');
      el._fr[attr] = el.getAttribute(attr);
    });
  });

  function setLang(lang) {
    const en = lang === 'en';
    document.documentElement.lang = en ? 'en' : 'fr';
    textEls.forEach(el => {
      const key = el.dataset.i18n;
      el.innerHTML = en && EN[key] != null ? EN[key] : el.dataset.fr;
    });
    attrEls.forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, en && EN[key] != null ? EN[key] : el._fr[attr]);
      });
    });
    document.querySelectorAll('.lang-switch button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.lang === lang));
    try { localStorage.setItem('lang', lang); } catch (e) {}
  }

  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => setLang(b.dataset.lang)));

  // Langue au chargement : choix mémorisé, sinon langue du navigateur
  let lang = null;
  try { lang = localStorage.getItem('lang'); } catch (e) {}
  if (!lang) lang = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  setLang(lang);
})();
