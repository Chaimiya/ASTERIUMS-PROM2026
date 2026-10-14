/* =========================== SLIDER VERTICAL (栏目 con fotos y videos) =========================== */
/* Formato del «Vertical Thumbnail Slider»: foto grande que se desliza en vertical (eje Y, sin bucle)
   y una tira vertical de miniaturas que acompaña a la foto elegida.
   Sin librerías: solo DOM y Pointer Events. Los videos se pausan solos al pasar de página o de foto,
   y la música de fondo baja mientras un video suena. */
const VSlider = (() => {
  const list = [];
  const music = $('#music');
  let ducked = false;                      // la música estaba sonando cuando arrancó un video

  function duck(on) {
    if (on) { if (!music.paused) { music.pause(); ducked = true; } return; }
    if (ducked) { ducked = false; if (Aud.on && music.paused) { const p = music.play(); if (p && p.catch) p.catch(() => {}); } }
  }

  function build(el) {
    const view = $('.vs-view', el), track = $('.vs-track', el), slides = $$('.vs-slide', el),
          strip = $('.vs-thumbs', el), inner = $('.vs-thumbs-in', el), ths = $$('.vs-th', el),
          count = $('.vs-count', el), live = $('.sr', el), n = slides.length, page = el.closest('.pg');
    const vids = $$('video', el);
    const s = { el, page, vids, i: 0, recenter: () => center(s.i) };
    let drag = null, sdrag = null, so = 0, justDragged = 0;
    const scale = () => (view.getBoundingClientRect().height / view.offsetHeight) || 1;

    /* ---- foto grande ---- */
    function go(i, anim = true) {
      i = clamp(i, 0, n - 1);
      if (i !== s.i) vids.forEach(v => v.pause());
      s.i = i;
      track.classList.toggle('drag', !anim);
      track.style.transform = `translateY(${-i * 100}%)`;
      slides.forEach((sl, k) => { sl.inert = k !== i; });
      ths.forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      count.textContent = `${i + 1} / ${n}`;
      live.textContent = `${i + 1} de ${n}`;
      center(i);
      [i - 1, i + 1].forEach(k => { const im = slides[k] && $('img', slides[k]); if (im) { im.loading = 'eager'; } });
    }
    /* ---- tira de miniaturas ---- */
    const maxOff = () => Math.max(0, inner.offsetHeight - (strip.clientHeight - 8));
    function center(i) {
      const t = ths[i], h = t.offsetHeight + 6, box = strip.clientHeight - 8;
      so = clamp(i * h - (box - t.offsetHeight) / 2, 0, maxOff());
      inner.style.transform = `translateY(${-so}px)`;
    }

    /* ---- arrastrar la foto grande (ratón y dedo) ---- */
    view.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      const r = view.getBoundingClientRect();
      if (e.target.closest('video') && e.clientY > r.bottom - 52 * scale()) return;   // la barra del video es suya
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: null, k: scale(), H: view.offsetHeight };
    });
    addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.mode) {
        if (Math.hypot(dx, dy) < 7) return;
        if (Math.abs(dx) > Math.abs(dy)) { drag = null; return; }      // gesto horizontal: lo usa el libro para pasar página
        drag.mode = 'v'; view.classList.add('drag'); track.classList.add('drag');
      }
      let off = dy / drag.k;
      if ((s.i === 0 && off > 0) || (s.i === n - 1 && off < 0)) off *= .3;   // sin bucle: resistencia en los extremos
      track.style.transform = `translateY(${-s.i * drag.H + off}px)`;
    });
    function endDrag(e, cancel) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.mode) return;
      view.classList.remove('drag'); justDragged = performance.now();
      const off = (e.clientY - d.y) / d.k;
      let i = s.i;
      if (!cancel && Math.abs(off) > d.H * .16) i += off < 0 ? 1 : -1;
      const was = s.i; go(i, true); if (s.i !== was) Aud.tick(s.i);
    }
    addEventListener('pointerup', e => endDrag(e, false));
    addEventListener('pointercancel', e => endDrag(e, true));
    view.addEventListener('click', e => { if (performance.now() - justDragged < 120) { e.preventDefault(); e.stopPropagation(); } }, true);

    /* ---- teclado: flechas arriba y abajo cambian de foto ---- */
    view.addEventListener('keydown', e => {
      const k = e.key; let i = s.i;
      if (k === 'ArrowDown' || k === 'PageDown') i++; else if (k === 'ArrowUp' || k === 'PageUp') i--;
      else if (k === 'Home') i = 0; else if (k === 'End') i = n - 1; else return;
      e.preventDefault(); e.stopPropagation(); go(i, true); Aud.tick(s.i);
    });

    /* ---- miniaturas: un toque la elige; la tira también se arrastra ---- */
    strip.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      sdrag = { id: e.pointerId, y: e.clientY, o: so, k: scale(), moved: false, t: e.target.closest('.vs-th') };
    });
    addEventListener('pointermove', e => {
      if (!sdrag || e.pointerId !== sdrag.id) return;
      const dy = (e.clientY - sdrag.y) / sdrag.k;
      if (!sdrag.moved && Math.abs(dy) > 5) { sdrag.moved = true; strip.classList.add('drag'); }
      if (!sdrag.moved) return;
      so = clamp(sdrag.o - dy, 0, maxOff());
      inner.style.transform = `translateY(${-so}px)`;
    });
    const endS = e => {
      if (!sdrag || e.pointerId !== sdrag.id) return;
      const d = sdrag; sdrag = null; strip.classList.remove('drag');
      if (e.type === 'pointerup' && !d.moved && d.t) { const k = ths.indexOf(d.t); go(k, true); Aud.tick(k); }
    };
    addEventListener('pointerup', endS); addEventListener('pointercancel', endS);
    /* con el teclado, Enter o espacio sobre una miniatura (el clic no pasa por el gesto de arriba) */
    ths.forEach((t, k) => t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(k, true); Aud.tick(k); } }));

    /* ---- videos: música abajo mientras suenan ---- */
    vids.forEach(v => {
      v.addEventListener('play', () => { vids.forEach(o => { if (o !== v) o.pause(); }); duck(true); });
      v.addEventListener('pause', () => { if (!vids.some(o => !o.paused)) duck(false); });
      v.addEventListener('ended', () => { if (!vids.some(o => !o.paused)) duck(false); });
    });

    go(0, false);
    return s;
  }

  SRC.forEach(p => $$('.vs', p).forEach(el => list.push(build(el))));
  addEventListener('resize', () => list.forEach(s => s.recenter()));

  return {
    /* se llama en cada cuadro: un video no sigue sonando en una página que ya no se ve */
    frame() { list.forEach(s => { if (s.vids.length && !Book.isVisible(s.page)) s.vids.forEach(v => { if (!v.paused) v.pause(); }); }); }
  };
})();
