/* =========================== GALERÍAS BENTO (栏目 con fotos) =========================== */
/* Formato de la «Interactive Bento Gallery»: mosaico con hover, ventana con foto grande,
   barra flotante de miniaturas arrastrable y fotos que se intercambian al arrastrarlas.
   Sin librerías: solo DOM, Pointer Events y la API de animaciones del navegador. */
const Gallery = (() => {
  const ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };
  /* El hotspot de翻页 del libro cubría casi toda la columna exterior de cada página y se comía
     los clics de las fotos. Se reduce a la esquina inferior, donde ya está el doblez de la página. */
  document.head.append(Object.assign(document.createElement('style'),
    { textContent: '.book .edge { top: auto; width: calc(var(--pw) * .12); height: calc(var(--pw) * .12); }' }));
  const scaleOf = pg => $('.pg__in', pg).getBoundingClientRect().width / 420 || 1;
  const chapters = {};
  let cur = null;          // ventana abierta
  let act = null;          // gesto en curso sobre un mosaico

  SRC.filter(p => p.dataset.ch && $('.bg-grid', p)).forEach(p => {
    (chapters[p.dataset.ch] = chapters[p.dataset.ch] || { id: p.dataset.ch, pages: [] }).pages.push(p);
  });

  /* ---------- mosaico ---------- */
  function paint(ch, t, anim) {
    const p = +t.dataset.p, id = ch.ord[p], it = ch.items[id], more = t.hasAttribute('data-more');
    const img = $('img', t);
    img.src = it.thumb; img.alt = it.alt;
    $('.bg-t', t).textContent = it.title; $('.bg-d', t).textContent = it.desc;
    t.dataset.i = id;
    t.setAttribute('aria-label', more ? `Ver las ${ch.ord.length - p} fotos que faltan` : `${it.title}. ${it.desc} Abrir en grande.`);
    if (anim && !RM) img.animate([{ opacity: .25 }, { opacity: 1 }], { duration: 320, easing: 'ease' });
  }
  function swap(ch, a, b) {
    const pa = +a.dataset.p, pb = +b.dataset.p;
    [ch.ord[pa], ch.ord[pb]] = [ch.ord[pb], ch.ord[pa]];
    paint(ch, a, true); paint(ch, b, true); Aud.tick(pa);
  }
  function bindTile(ch, t) {
    t.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      const mouse = e.pointerType === 'mouse';
      act = { ch, t, id: e.pointerId, x: e.clientX, y: e.clientY, k: scaleOf(t.closest('.pg')), moved: false, drag: mouse && !t.hasAttribute('data-more') };
      if (mouse) e.stopPropagation();   // con el ratón se arrastra la foto; con el dedo sigue pasando la página
    });
    t.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(ch, t); }
    });
  }
  addEventListener('pointermove', e => {
    if (!act || e.pointerId !== act.id) return;
    const dx = (e.clientX - act.x) / act.k, dy = (e.clientY - act.y) / act.k;
    if (!act.moved && Math.hypot(dx, dy) > 6) {
      act.moved = true;
      if (act.drag) { act.t.classList.add('drag'); act.t.style.transition = 'none'; }
    }
    if (act.moved && act.drag) act.t.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  function endTile(e, cancel) {
    if (!act || e.pointerId !== act.id) return;
    const a = act; act = null; const t = a.t;
    if (!a.moved) { if (!cancel && performance.now() - Book.justDragged() > 150) open(a.ch, t); return; }
    if (!a.drag) return;
    const move = (e.clientX - a.x) / a.k + (e.clientY - a.y) / a.k;
    t.classList.remove('drag');
    t.style.transition = RM ? 'none' : 'transform 360ms var(--mag-ease)';
    t.style.transform = 'translate(0px, 0px)';
    setTimeout(() => { t.style.transition = ''; t.style.transform = ''; }, RM ? 0 : 400);
    if (Math.abs(move) > 50 && !cancel) {
      const tiles = $$('.bg-tile:not([data-more])', t.parentNode), i = tiles.indexOf(t);
      const j = clamp(i + (move > 0 ? 1 : -1), 0, tiles.length - 1);
      if (j !== i) swap(a.ch, t, tiles[j]);
    }
  }
  addEventListener('pointerup', e => endTile(e, false));
  addEventListener('pointercancel', e => endTile(e, true));

  /* ---------- ventana ---------- */
  function build(ch, page) {
    const el = document.createElement('div');
    el.className = 'bg-modal'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Galería: ' + ch.name);
    el.innerHTML =
      `<div class="bg-top"><p class="bg-cn"></p><button class="bg-x" type="button" aria-label="Cerrar la galería">${ICON.x}</button></div>` +
      `<figure class="bg-fig"><img class="bg-big" alt=""><figcaption class="bg-cap"><h3></h3><p></p></figcaption></figure>` +
      `<div class="bg-ctl"><button class="bg-nav bg-prev" type="button" aria-label="Foto anterior">${ICON.l}</button><span class="bg-count" aria-hidden="true"></span><button class="bg-nav bg-next" type="button" aria-label="Foto siguiente">${ICON.r}</button></div>` +
      `<div class="bg-dock"><div class="bg-dockin"></div></div><span class="sr" aria-live="polite"></span>`;
    $('.pg__in', page).append(el);
    const m = { ch, page, el, pos: 0, dx: 0, dy: 0, timer: 0, opener: null,
      big: $('.bg-big', el), dock: $('.bg-dock', el), inner: $('.bg-dockin', el), sr: $('.sr', el) };
    $('.bg-x', el).addEventListener('click', () => close());
    $('.bg-prev', el).addEventListener('click', () => step(m, -1));
    $('.bg-next', el).addEventListener('click', () => step(m, 1));

    /* teclado: las flechas cambian de foto, no de página */
    el.addEventListener('keydown', e => {
      const k = e.key, go = d => { e.preventDefault(); e.stopPropagation(); step(m, d); };
      if (k === 'Escape') { e.stopPropagation(); close(); }
      else if (k === 'ArrowRight' || k === 'PageDown') go(1);
      else if (k === 'ArrowLeft' || k === 'PageUp') go(-1);
      else if (k === 'Home') { e.preventDefault(); e.stopPropagation(); show(m, 0, -1); }
      else if (k === 'End') { e.preventDefault(); e.stopPropagation(); show(m, ch.ord.length - 1, 1); }
      else if (k === 'Tab') {
        const f = $$('button:not([tabindex="-1"])', el);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    /* que el libro no robe los gestos de la ventana */
    el.addEventListener('pointerdown', e => e.stopPropagation());

    /* deslizar la foto grande */
    let sw = null; const fig = $('.bg-fig', el);
    fig.addEventListener('pointerdown', e => { if (e.isPrimary) sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    fig.addEventListener('pointerup', e => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(m, dx < 0 ? 1 : -1);
    });
    fig.addEventListener('pointercancel', () => { sw = null; });

    /* barra de miniaturas: se arrastra; un toque en una miniatura la elige */
    let d = null;
    m.dock.addEventListener('pointerdown', e => {
      if (!e.isPrimary) return;
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: m.dx, oy: m.dy, moved: false, t: e.target.closest('.bg-th') };
      try { m.dock.setPointerCapture(e.pointerId); } catch (er) {}
    });
    m.dock.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const k = scaleOf(page), dx = (e.clientX - d.x) / k, dy = (e.clientY - d.y) / k;
      if (!d.moved && Math.hypot(dx, dy) > 5) { d.moved = true; m.dock.classList.add('drag'); }
      if (!d.moved) return;
      const dk = m.dock;
      m.dx = clamp(d.ox + dx, -dk.offsetLeft, 420 - dk.offsetLeft - dk.offsetWidth);
      m.dy = clamp(d.oy + dy, -dk.offsetTop, 560 - dk.offsetTop - dk.offsetHeight);
      dk.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
    });
    const endDock = e => {
      if (!d || e.pointerId !== d.id) return;
      const was = d; d = null; m.dock.classList.remove('drag');
      if (e.type === 'pointerup' && !was.moved && was.t) { const k = +was.t.dataset.k; show(m, k, Math.sign(k - m.pos)); }
    };
    m.dock.addEventListener('pointerup', endDock); m.dock.addEventListener('pointercancel', endDock);
    ch.modals.set(page, m);
    return m;
  }
  function step(m, d) { show(m, m.pos + d, d); Aud.tick(m.pos); }
  function show(m, pos, dir) {
    const ch = m.ch, n = ch.ord.length; pos = ((pos % n) + n) % n; m.pos = pos;
    const it = ch.items[ch.ord[pos]], big = m.big;
    big.src = it.thumb; big.alt = it.alt;            // la miniatura aparece al instante
    const full = new Image(); full.onload = () => { if (m.pos === pos) big.src = it.full; }; full.src = it.full;
    $('.bg-cap h3', m.el).textContent = it.title; $('.bg-cap p', m.el).textContent = it.desc;
    $('.bg-count', m.el).textContent = `${pos + 1} / ${n}`; $('.bg-cn', m.el).textContent = ch.name;
    m.sr.textContent = `${it.title}, ${pos + 1} de ${n}`;
    if (!RM && dir) big.animate([{ opacity: 0, transform: `translateX(${dir * 24}px) scale(.98)` }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
    // barra: hasta 7 miniaturas alrededor de la elegida
    const w = Math.min(7, n), s = clamp(pos - 3, 0, n - w); m.inner.innerHTML = '';
    for (let k = s; k < s + w; k++) {
      const t = ch.items[ch.ord[k]], b = document.createElement('button');
      b.type = 'button'; b.tabIndex = -1; b.dataset.k = k; b.className = 'bg-th' + (k === pos ? ' on' : '');
      b.style.setProperty('--rot', (k === pos ? 0 : (k % 2 ? 15 : -15)) + 'deg');
      b.setAttribute('aria-label', 'Ver ' + t.title);
      b.innerHTML = `<img src="${t.thumb}" alt="" width="34" height="34">`;
      m.inner.append(b);
    }
    [pos - 1, pos + 1].forEach(k => { const x = ch.items[ch.ord[((k % n) + n) % n]]; new Image().src = x.full; });
  }
  function open(ch, tile) {
    const page = tile.closest('.pg');
    if (cur) close(true);
    const m = ch.modals.get(page) || build(ch, page);
    clearTimeout(m.timer);
    $$(':scope > *', $('.pg__in', page)).forEach(c => { if (c !== m.el) c.setAttribute('inert', ''); });
    m.opener = tile; m.dx = m.dy = 0; m.dock.style.transform = '';
    m.el.hidden = false; requestAnimationFrame(() => m.el.classList.add('open'));
    cur = m; show(m, +tile.dataset.p, 0);
    Aud.chime(81, .06, 1.4);
    $('.bg-x', m.el).focus({ preventScroll: true });
  }
  function close(quick) {
    if (!cur) return;
    const m = cur; cur = null;
    m.el.classList.remove('open');
    if (quick || RM) m.el.hidden = true; else m.timer = setTimeout(() => { m.el.hidden = true; }, 260);
    $$(':scope > [inert]', $('.pg__in', m.page)).forEach(c => c.removeAttribute('inert'));
    if (!quick && m.opener) m.opener.focus({ preventScroll: true });
  }

  /* ---------- arranque ---------- */
  Object.values(chapters).forEach(ch => {
    const D = JSON.parse($('.bg-data', ch.pages.find(p => $('.bg-data', p))).textContent);
    ch.name = D.name; ch.items = D.items; ch.ord = D.order.slice(); ch.modals = new Map();
    ch.pages.forEach(p => $$('.bg-tile', p).forEach(t => bindTile(ch, t)));
  });
  return { frame() { if (cur && !Book.isVisible(cur.page)) close(true); } };
})();
