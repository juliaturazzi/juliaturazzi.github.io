const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// Scroll progress 0 → 1, shared by the background scene and the tracker.
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

// Background scene, painted on one canvas every frame.
// Top of the page: sunset over Guanabara Bay. Bottom: Arctic night with aurora and snow.
(function scene() {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, ridges = [], stars = [], flakes = [];

  // ----- helpers -----
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const rgb = (c, a = 1) => `rgba(${c.map(Math.round).join(',')},${a})`;
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

  // Smooth 1D value noise.
  const table = Array.from({ length: 512 }, () => Math.random());
  const noise = x => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(table[i & 511], table[(i + 1) & 511], u);
  };

  // ----- sky: colours from zenith to horizon at three points of the journey -----
  const SKY = [
    { at: 0,   stops: ['#18204a', '#47306c', '#b9587a', '#f4a25f'] },
    { at: .45, stops: ['#0b1530', '#1b2a50', '#33476f', '#5d6e92'] },
    { at: 1,   stops: ['#03080e', '#07131b', '#0c1f27', '#15303a'] },
  ].map(k => ({ at: k.at, stops: k.stops.map(hex) }));

  function skyAt(p) {
    const i = p < SKY[1].at ? 0 : 1;
    const a = SKY[i], b = SKY[i + 1];
    const t = smoothstep(0, 1, (p - a.at) / (b.at - a.at));
    return a.stops.map((c, k) => mix(c, b.stops[k], t));
  }

  // ----- Rio: Corcovado with Christ the Redeemer, Morro da Urca, Sugarloaf (1440 × 320 box) -----
  const RIO_FAR = new Path2D('M0 236 C70 214 120 168 170 172 C205 140 232 132 262 160 C300 186 360 196 430 204 C520 214 600 200 690 210 C820 222 980 214 1100 222 C1240 230 1360 224 1440 228 L1440 320 L0 320 Z');
  const RIO_NEAR = new Path2D('M0 262 C110 255 210 205 290 130 C312 98 330 74 345 72 C360 74 372 96 392 128 C440 200 530 240 640 252 C760 262 840 246 900 218 C935 182 985 172 1025 206 C1048 160 1078 94 1130 86 C1182 82 1222 150 1242 228 C1290 254 1365 262 1440 262 L1440 320 L0 320 Z');
  const BAY_Y = 282;
  const PEAK = [345, 74];                     // top of Corcovado, where the statue stands

  // Christ the Redeemer in the real proportions: 8 m pedestal, 30 m statue, 28 m arm span.
  // 100 units tall, origin at the foot of the pedestal. Broad robe, sleeves hanging from the arms.
  const CHRIST = new Path2D(
    'M-9 0 L9 0 L9 -17 L10.5 -17 L10.5 -20 L9.5 -20 ' +
    'C8.5 -35 7.5 -50 8.5 -64 C14 -68 26 -74 35 -77 ' +
    'L37.5 -77.5 L38 -80 L37.5 -82.5 L30 -83.5 L12 -84.5 ' +
    'C10 -85.5 6 -87 3.5 -88 L3 -90 L-3 -90 L-3.5 -88 ' +
    'C-6 -87 -10 -85.5 -12 -84.5 L-30 -83.5 L-37.5 -82.5 L-38 -80 L-37.5 -77.5 ' +
    'L-35 -77 C-26 -74 -14 -68 -8.5 -64 C-7.5 -50 -8.5 -35 -9.5 -20 ' +
    'L-10.5 -20 L-10.5 -17 L-9 -17 Z ' +
    'M5 -95 A5 5 0 1 0 -5 -95 A5 5 0 1 0 5 -95 Z');

  // City lights along the shore, between the hills and the bay.
  const LIGHTS = Array.from({ length: 90 }, () => ({
    x: Math.random() * 1440, y: BAY_Y - 1 - Math.random() * 7,
    r: Math.random() * .9 + .5, phase: Math.random() * 6.3,
  }));

  // ----- Arctic ridges: far to near, lighter and hazier with distance -----
  // haze: how much of the horizon colour each layer takes on (distance = paler).
  const RIDGES = [
    { base: .76, amp: .28, freq: .0035, seed: 11, haze: .5 },
    { base: .86, amp: .24, freq: .0055, seed: 47, haze: .22 },
    { base: .97, amp: .18, freq: .009,  seed: 83, haze: 0 },
  ];
  const RIDGE_DARK = hex('#08131a');

  function buildRidges() {
    const step = 6;
    ridges = RIDGES.map(r => {
      const pts = [];
      for (let x = -step; x <= w + step; x += step) {
        const n = noise(x * r.freq + r.seed) + noise(x * r.freq * 2.7 + r.seed) * .45 + noise(x * r.freq * 7 + r.seed) * .12;
        const v = Math.pow(n / 1.57, 1.7);
        pts.push([x, (r.base - r.amp * v) * h]);
      }
      return { ...r, pts };
    });
  }

  // ----- aurora: drawn small and scaled up, which blurs it for free -----
  const glow = document.createElement('canvas');
  const gctx = glow.getContext('2d');
  const ray = document.createElement('canvas');
  ray.width = 1; ray.height = 128;
  (() => {
    const r = ray.getContext('2d');
    const g = r.createLinearGradient(0, 128, 0, 0);
    // Soft base, bright green just above it, then teal fading into a faint violet top.
    g.addColorStop(0, 'rgba(120,255,190,0)');
    g.addColorStop(.12, 'rgba(120,255,190,.85)');
    g.addColorStop(.3, 'rgba(80,225,180,.5)');
    g.addColorStop(.6, 'rgba(120,130,240,.16)');
    g.addColorStop(1, 'rgba(150,110,255,0)');
    r.fillStyle = g;
    r.fillRect(0, 0, 1, 128);
  })();

  function drawAurora(t, strength) {
    const gw = glow.width, gh = glow.height;
    gctx.clearRect(0, 0, gw, gh);
    gctx.globalCompositeOperation = 'lighter';
    // Two translucent ribbons high in the sky (a faint one behind, the main one in front),
    // each a curtain of fine rays that fades out at both ends, inside a wide soft glow.
    const dim = w < 700 ? .6 : 1;                    // phones: text spans the full width
    const RIBBONS = [
      { top: .07, slope: .12, tall: .26, alpha: .22, seed: 70, from: .0,  to: .85 },
      { top: .12, slope: .16, tall: .18, alpha: .55, seed: 0,  from: .12, to: 1 },
    ];
    for (const r of RIBBONS) {
      for (let x = 0; x < gw; x++) {
        const u = x / gw;
        const ends = smoothstep(r.from, r.from + .28, u) * smoothstep(r.to, r.to - .3, u);
        if (ends <= 0) continue;
        const base = gh * (r.top + r.slope * u + .035 * Math.sin(u * 5 + t * .05 + r.seed))
                   + (noise(x * .01 + t * .02 + r.seed) - .5) * gh * .04;
        const height = gh * r.tall * (.7 + .5 * noise(x * .025 + t * .05 + r.seed));
        // Fine rays: mostly even, with the occasional brighter streak drifting along.
        const ray1 = noise(x * .35 + t * .4 + r.seed);
        const rays = .7 + .3 * ray1 * ray1 + .25 * Math.pow(noise(x * .08 - t * .15 + r.seed), 4);
        const a = strength * dim * ends * r.alpha;
        gctx.globalAlpha = a * .25;                  // wide glow
        gctx.drawImage(ray, x, base - height * 1.8, 1.2, height * 2.3);
        gctx.globalAlpha = a * rays;                 // the curtain itself
        gctx.drawImage(ray, x, base - height, 1.2, height * 1.05);
      }
    }
    gctx.globalAlpha = 1;
    gctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(glow, 0, 0, w, h);
    ctx.restore();
  }

  // ----- setup -----
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const widthChanged = canvas.clientWidth !== w;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    glow.width = Math.ceil(w / 3);
    glow.height = Math.ceil(h / 3);
    buildRidges();
    // Phones fire resize when the address bar hides; keep stars and snow unless the width changed.
    if (!widthChanged) return;
    stars = Array.from({ length: Math.round(w * h / 5000) }, () => ({
      x: Math.random(), y: Math.random() * .75, r: Math.random() * 1.1 + .2,
      phase: Math.random() * 6.3, speed: Math.random() * 1.5 + .5,
    }));
    const count = Math.round(Math.min(180, w * h / 7000));
    flakes = Array.from({ length: count }, (_, i) => {
      const depth = Math.random();   // 0 far, 1 near
      return {
        x: Math.random() * w, y: Math.random() * h, depth,
        r: lerp(.5, 2.6, depth * depth), v: lerp(.25, 1.2, depth),
        drift: Math.random() * 6.3,
        // Each flake appears at its own point in the journey, so the snow builds up gradually.
        from: .3 + (i / count) * .55,
      };
    });
  }

  // ----- one frame -----
  function frame(now) {
    // Time stands still while the video plays or for reduced motion.
    if (running) clock = now / 1000;
    const t = clock;
    const p = progress;
    const horizon = h * .8;

    // Sky
    const sky = skyAt(p);
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.forEach((c, i) => g.addColorStop(i / (sky.length - 1), rgb(c)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Stars come out after sunset
    const starLight = smoothstep(.12, .6, p);
    if (starLight > 0) {
      for (const s of stars) {
        const a = starLight * (1 - s.y) * (.55 + .45 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(236,240,245,${a})`;
        ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
      }
    }

    // Sun, setting behind the hills
    const sunUp = 1 - smoothstep(0, .38, p);
    const narrow = w < 700;
    const sunX = w * (narrow ? .7 : .8);
    const sunY = horizon - h * .1 + p * h * .9;
    if (sunUp > 0) {
      const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * .7);
      halo.addColorStop(0, `rgba(255,190,110,${.45 * sunUp})`);
      halo.addColorStop(.35, `rgba(240,120,100,${.18 * sunUp})`);
      halo.addColorStop(1, 'rgba(240,120,100,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      const r = narrow ? 34 : 52;
      const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r);
      disc.addColorStop(0, '#fff6d6');
      disc.addColorStop(.7, '#ffd08a');
      disc.addColorStop(1, `rgba(255,170,95,${.0})`);
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aurora over the Arctic
    const auroraOn = smoothstep(.45, .85, p);
    if (auroraOn > 0) drawAurora(t, auroraOn);

    // Rio sinks out of view as the journey heads north
    const rioDrop = smoothstep(0, .55, p) * h * .55;
    if (rioDrop < h * .5) {
      // Phones frame the stretch from Corcovado to Sugarloaf; wider screens show the whole bay.
      const scale = narrow ? w / 1060 : Math.max(w / 1440, (h * .32) / 320);
      const ox = narrow ? -230 * scale : w - 1440 * scale;
      const oy = h - 320 * scale + rioDrop;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      const haze = mix(sky[3], hex('#2a1f45'), .55);
      ctx.fillStyle = rgb(haze);
      ctx.fill(RIO_FAR);
      ctx.fillStyle = '#1a1430';
      ctx.fill(RIO_NEAR);
      // The statue: true to scale it would be a speck, so it is drawn at least 30px tall.
      const k = Math.max(.32, .3 / scale);
      ctx.save();
      ctx.translate(PEAK[0], PEAK[1]);
      ctx.scale(k, k);
      ctx.fill(CHRIST);
      ctx.restore();
      // Guanabara Bay with the sun's reflection
      const bay = ctx.createLinearGradient(0, BAY_Y, 0, 320);
      bay.addColorStop(0, '#3a2a55');
      bay.addColorStop(1, '#140f26');
      ctx.fillStyle = bay;
      ctx.fillRect(0, BAY_Y, 1440, 320 - BAY_Y);
      for (const l of LIGHTS) {
        ctx.fillStyle = `rgba(255,214,150,${.55 + .35 * Math.sin(t * 2 + l.phase)})`;
        ctx.fillRect(l.x, l.y, l.r, l.r);
      }
      if (sunUp > 0) {
        const sx = (sunX - ox) / scale;
        for (let i = 0; i < 12; i++) {
          const y = BAY_Y + 3 + i * 3;
          const half = (14 + i * 6) * (.45 + .55 * noise(i * 3.1 + t * 1.4));
          ctx.fillStyle = `rgba(255,190,120,${(.55 - i * .04) * sunUp})`;
          ctx.fillRect(sx - half, y, half * 2, 1.2);
        }
      }
      ctx.restore();
    }

    // Arctic ridges rise from below, overlapping; nearer layers are darker
    const rise = (1 - smoothstep(.35, .85, p)) * h * .6;
    if (rise < h * .55) {
      ridges.forEach((r, i) => {
        const crest = (r.base - r.amp) * h + rise;
        const colour = mix(RIDGE_DARK, sky[3], r.haze);
        const fill = ctx.createLinearGradient(0, crest, 0, h + rise);
        fill.addColorStop(0, rgb(colour));
        fill.addColorStop(1, rgb(mix(colour, RIDGE_DARK, .6)));
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(r.pts[0][0], h);
        for (const [x, y] of r.pts) ctx.lineTo(x, y + rise);
        ctx.lineTo(w + 10, h);
        ctx.closePath();
        ctx.fill();

        // Moonlight catching the snow along the peaks
        ctx.strokeStyle = `rgba(200,225,235,${[.2, .07, 0][i]})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        r.pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y + rise) : ctx.moveTo(x, y + rise));
        ctx.stroke();

        // Mist settling in the valleys, fading out above and below
        if (i < ridges.length - 1) {
          const mid = (r.base - r.amp * .25) * h + rise;
          const band = h * .07;
          const mist = ctx.createLinearGradient(0, mid - band, 0, mid + band);
          mist.addColorStop(0, 'rgba(130,175,185,0)');
          mist.addColorStop(.5, 'rgba(130,175,185,.06)');
          mist.addColorStop(1, 'rgba(130,175,185,0)');
          ctx.fillStyle = mist;
          ctx.fillRect(0, mid - band, w, band * 2);
        }
      });
    }

    // Snow at three depths: near flakes are bigger and faster
    for (const f of flakes) {
      if (running) {
        f.y += f.v;
        f.drift += .01;
        f.x += Math.sin(f.drift) * (.2 + f.depth * .4);
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      }
      const a = smoothstep(f.from, f.from + .1, p) * lerp(.35, .9, f.depth);
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(236,232,224,${a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft vignette keeps the edges quiet
    const v = ctx.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .35, w / 2, h * .45, Math.max(w, h) * .8);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    if (running) requestAnimationFrame(frame);
  }

  // Hold the scene still while the video plays: the film is the point of the page,
  // and a phone needs the processing power for playback.
  const film = document.getElementById('film');
  let running = !reducedMotion;
  let clock = 0;
  const still = () => { running = false; };
  const resume = () => {
    if (reducedMotion || running) return;
    running = true;
    requestAnimationFrame(frame);
  };
  film.addEventListener('play', still);
  film.addEventListener('pause', resume);
  film.addEventListener('ended', resume);

  resize();
  // When the scene is still, scrolling and resizing redraw a single frame.
  const redraw = () => { if (!running) requestAnimationFrame(frame); };
  addEventListener('resize', () => { resize(); redraw(); });
  addEventListener('scroll', redraw, { passive: true });
  requestAnimationFrame(frame);
})();
