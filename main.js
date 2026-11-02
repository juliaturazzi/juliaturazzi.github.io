// Distance from Julia's city to the Polar start, counted up when the route scrolls into view.
(function route() {
  const el = document.querySelector('.route');
  const out = document.getElementById('km');
  const rad = d => d * Math.PI / 180;
  const [lat1, lon1, lat2, lon2] = ['fromLat', 'fromLon', 'toLat', 'toLon'].map(k => rad(+el.dataset[k]));
  const a = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  const km = Math.round(6371 * 2 * Math.asin(Math.sqrt(a)));
  const fmt = n => n.toLocaleString('en-US');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    out.textContent = fmt(km);
    return;
  }

  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    const start = performance.now();
    const step = now => {
      const t = Math.min((now - start) / 1800, 1);
      out.textContent = fmt(Math.round(km * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: .5 }).observe(el);
})();

// Show the video's file size next to the download button.
(function size() {
  const link = document.querySelector('a[download]');
  fetch(link.href, { method: 'HEAD' })
    .then(r => +r.headers.get('content-length'))
    .then(bytes => {
      if (bytes) document.getElementById('size').textContent = `· ${Math.round(bytes / 1e6) || '<1'} MB`;
    })
    .catch(() => {});
})();

// Falling snow.
(function snow() {
  const canvas = document.getElementById('snow');
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w, h, flakes;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(140, w * h / 9000));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + .4,
      v: Math.random() * .5 + .25,
      drift: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(236, 230, 217, .75)';
    for (const f of flakes) {
      if (!still) {
        f.y += f.v;
        f.drift += .01;
        f.x += Math.sin(f.drift) * .3;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!still) requestAnimationFrame(draw);
  }

  resize();
  // Phones fire resize when the address bar hides; only reset the snow on a width change.
  addEventListener('resize', () => {
    if (canvas.clientWidth === w) return;
    resize();
    if (still) draw();
  });
  draw();
})();
