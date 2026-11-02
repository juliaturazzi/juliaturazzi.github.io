const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// Scroll progress 0 → 1, shared by the background, the tracker and the snow.
let progress = 0;
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Journey tracker: latitude, temperature and distance follow the scroll from Rio to Signaldalen.
(function journey() {
  const el = document.querySelector('.journey');
  const d = el.dataset;
  const rad = x => x * Math.PI / 180;
  const [lat1, lon1, lat2, lon2] = [d.fromLat, d.fromLon, d.toLat, d.toLon].map(Number);
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  const totalKm = 6371 * 2 * Math.asin(Math.sqrt(a));
  const t1 = +d.fromTemp, t2 = +d.toTemp;

  const latOut = document.getElementById('j-lat');
  const tempOut = document.getElementById('j-temp');
  const kmOut = document.getElementById('j-km');

  let queued = false;
  function update() {
    queued = false;
    const max = root.scrollHeight - innerHeight;
    // Browsers can stop a pixel short of the bottom; count that as arrived.
    progress = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
    if (max - scrollY < 2) progress = 1;
    root.style.setProperty('--p', progress.toFixed(4));
    root.style.setProperty('--mix', smoothstep(.1, .85, progress).toFixed(4));

    const lat = Math.round(lat1 + (lat2 - lat1) * progress);
    // Stays warm through the tropics, then drops fast on the way north.
    const temp = Math.round(t1 + (t2 - t1) * progress ** 2);
    latOut.textContent = `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`;
    tempOut.textContent = `${temp > 0 ? '+' : temp < 0 ? '−' : ''}${Math.abs(temp)}°C`;
    kmOut.textContent = `${Math.round(totalKm * progress).toLocaleString('en-US')} km`;
  }
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  update();
})();

// Show the video's file size next to the download button.
(function size() {
  const link = document.querySelector('a[download][href$=".mp4"]');
  fetch(link.href, { method: 'HEAD' })
    .then(r => +r.headers.get('content-length'))
    .then(bytes => {
      if (bytes) document.getElementById('size').textContent = `· ${Math.round(bytes / 1e6) || '<1'} MB`;
    })
    .catch(() => {});
})();

// Snow: starts once the journey leaves Rio and thickens towards the Arctic.
(function snow() {
  const canvas = document.getElementById('snow');
  const ctx = canvas.getContext('2d');
  let w, h, flakes;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(160, w * h / 8000));
    flakes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + .4,
      v: Math.random() * .5 + .25,
      drift: Math.random() * Math.PI * 2,
      // Each flake appears at its own point in the journey, so the snow builds up gradually.
      from: .25 + (i / count) * .6,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      if (!reducedMotion) {
        f.y += f.v;
        f.drift += .01;
        f.x += Math.sin(f.drift) * .3;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      }
      const alpha = smoothstep(f.from, f.from + .1, progress) * .8;
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(236, 230, 217, ${alpha})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reducedMotion) requestAnimationFrame(draw);
  }

  resize();
  // Phones fire resize when the address bar hides; only reset the snow on a width change.
  addEventListener('resize', () => {
    if (canvas.clientWidth === w) return;
    resize();
    if (reducedMotion) draw();
  });
  if (reducedMotion) addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
  draw();
})();
