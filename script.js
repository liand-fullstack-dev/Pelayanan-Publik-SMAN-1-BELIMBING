/**
 * Portal Pelayanan Digital SMAN 1 BELIMBING
 * script.js v3.0 — Production Ready
 * All pages: Intro · Index · Daftar Janji · Admin
 */

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
const CONFIG = {
  SUPABASE_URL: 'https://jqfwkvffhnmdillpmxsa.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_j_xu_Nnlf7YrQ3KWB2hp9g_XRQWmXEA',
  FN_BASE: 'https://jqfwkvffhnmdillpmxsa.supabase.co/functions/v1',
  ITEMS_PER_PAGE: 12,
  ADMIN_LOGO_CLICKS: 3,
  ADMIN_LOGO_TIMEOUT: 2000,
};

/* ═══════════════════════════════════════════
   SUPABASE CLIENT
═══════════════════════════════════════════ */
const supabase = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: false },
});

/* ═══════════════════════════════════════════
   DUMMY DATA (fallback when Supabase not configured)
═══════════════════════════════════════════ */
const DUMMY_APPOINTMENTS = (() => {
  const today  = new Date();
  const fmt    = (d) => d.toISOString().split('T')[0];
  const d      = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return fmt(x); };
  const c      = (n) => { const x = new Date(today); x.setDate(x.getDate() - n); return fmt(x); };
  const names  = ['Budi Santoso','Dewi Rahayu','Ahmad Fauzi','Siti Nurhaliza','Reza Pratama',
                   'Nur Aisyah','Muhammad Rizki','Linda Wati','Hendra Gunawan','Fitriani',
                   'Denny Setiawan','Ratna Sari','Yusuf Abdullah','Mega Putri','Arief Rahman'];
  const tujuan = ['Kepala Sekolah','Wakil Kepala Sekolah','Kepala Kurikulum','Guru BK','Wali Kelas',
                  'Guru Mata Pelajaran','Tata Usaha','Bendahara','Operator Sekolah'];
  const keperluan = [
    'Konsultasi perkembangan akademik anak saya selama satu semester terakhir',
    'Pengambilan dokumen rapor dan sertifikat kelulusan',
    'Pembahasan program beasiswa yang tersedia untuk siswa berprestasi',
    'Diskusi mengenai permasalahan disiplin siswa dan rencana tindak lanjut',
    'Konsultasi karir dan pilihan jurusan untuk persiapan masuk perguruan tinggi',
    'Pengambilan berkas administrasi perpindahan sekolah',
    'Pembayaran dan konfirmasi biaya kegiatan ekstrakurikuler',
    'Laporan dan koordinasi kegiatan OSIS semester ini',
    'Pengajuan permohonan surat keterangan aktif sekolah',
    'Diskusi program kemitraan dan MOU dengan sekolah kami',
  ];
  const statuses = ['Menunggu Konfirmasi','Menunggu Konfirmasi','Dikonfirmasi','Selesai','Dibatalkan'];
  const jams     = ['07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','13:00','13:30','14:00'];
  const instansi = ['SMA Negeri 2 Muara Enim','Dinas Pendidikan Kab. Muara Enim','Orang Tua Siswa',
                    'Universitas Sriwijaya','MGMP Matematika',null,null,'Komite Sekolah',
                    'LSM Pendidikan','Wali Murid Kelas XII'];
  const dates    = [d(0),d(0),d(1),d(1),d(2),d(2),d(3),d(0),c(1),c(1),c(2),c(2),c(3),c(4),c(5)];

  return dates.map((tanggal, i) => ({
    id: `dummy-${String(i+1).padStart(3,'0')}`,
    nomor_antrian: `${['A','B','A','B','A','B','A','C','A','B','A','C','B','A','B'][i]}-${String(i*3+1).padStart(3,'0')}`,
    nama_lengkap: names[i % names.length],
    nomor_wa: `08${String(Math.floor(Math.random()*900000000+100000000))}`,
    instansi: instansi[i % instansi.length],
    tujuan_bertemu: tujuan[i % tujuan.length],
    keperluan: keperluan[i % keperluan.length],
    tanggal,
    jam: jams[i % jams.length],
    status: statuses[i % statuses.length],
    dokumen_url: i % 5 === 0 ? 'https://example.com/dokumen.pdf' : null,
    created_at: new Date(Date.now() - (i * 3600000 * 4)).toISOString(),
  }));
})();

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const isConfigured = () =>
  CONFIG.SUPABASE_URL.includes('supabase.co') && !CONFIG.SUPABASE_URL.includes('YOUR_PROJECT');

function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday:'long', day:'numeric', month:'long', year:'numeric',
  });
}
function formatDateShort(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}
function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function sanitizeText(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function countWords(s) { return (s||'').trim().length; }

const statusMap = {
  'Menunggu Konfirmasi': { cls:'badge-waiting',    label:'Menunggu' },
  'Dikonfirmasi':        { cls:'badge-confirmed',  label:'Dikonfirmasi' },
  'Selesai':             { cls:'badge-done',        label:'Selesai' },
  'Dibatalkan':          { cls:'badge-cancelled',  label:'Dibatalkan' },
};

function statusBadge(status) {
  const m = statusMap[status] || { cls:'badge-waiting', label:status };
  return `<span class="badge ${m.cls}">${sanitizeText(m.label)}</span>`;
}

/* ═══════════════════════════════════════════
   TOAST SYSTEM
═══════════════════════════════════════════ */
const ICONS_TOAST = {
  success: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

function toast(type, title, message = '', duration = 4000) {
  const container = $('#toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="toast-icon">${ICONS_TOAST[type]||ICONS_TOAST.info}</div>
    <div class="toast-content">
      <div class="toast-title">${sanitizeText(title)}</div>
      ${message ? `<div class="toast-message">${sanitizeText(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Tutup notifikasi">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  container.appendChild(el);
  el.querySelector('.toast-close').onclick = () => removeToast(el);
  if (duration > 0) setTimeout(() => removeToast(el), duration);
}
function removeToast(el) {
  el.classList.add('toast-out');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

/* ═══════════════════════════════════════════
   THEME SYSTEM
═══════════════════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  setTheme(saved, false);
}
function setTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) localStorage.setItem('theme', theme);
  const icons = $$('#themeIcon, #adminThemeIcon');
  icons.forEach(icon => {
    icon.innerHTML = theme === 'dark'
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
  });
}
function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme');
  setTheme(curr === 'dark' ? 'light' : 'dark');
}

/* ═══════════════════════════════════════════
   SMOOTH SCROLL (Lenis)
═══════════════════════════════════════════ */
let lenis;
function initLenis() {
  if (!window.Lenis) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  $$('[data-scroll]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href?.startsWith('#')) {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) lenis.scrollTo(el, { offset: -72, duration: 1.2 });
        closeNav();
      }
    });
  });
}

/* ═══════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════ */
let logoClickCount = 0, logoClickTimer;

function initNavbar() {
  const navbar    = $('#navbar');
  const toggle    = $('#navToggle');
  const menu      = $('#navMobileMenu');
  const logoIcon  = $('#navLogoIcon');

  // Scroll state
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Mobile menu
  toggle?.addEventListener('click', () => {
    const open = menu?.classList.toggle('open');
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Theme toggles
  $$('#themeToggle, #adminThemeToggle').forEach(btn =>
    btn.addEventListener('click', toggleTheme)
  );

  // Logo — admin shortcut (3 fast clicks)
  logoIcon?.addEventListener('click', (e) => {
    logoClickCount++;
    clearTimeout(logoClickTimer);
    logoClickTimer = setTimeout(() => { logoClickCount = 0; }, CONFIG.ADMIN_LOGO_TIMEOUT);
    if (logoClickCount >= CONFIG.ADMIN_LOGO_CLICKS) {
      logoClickCount = 0;
      clearTimeout(logoClickTimer);
      window.location.href = '/admin';
    }
  });

  // Nav scroll highlight
  const sections = $$('section[id]');
  if (sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          $$('.nav-link[data-scroll]').forEach(l => l.classList.remove('active'));
          const active = $(`.nav-link[href="#${entry.target.id}"]`);
          active?.classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    sections.forEach(s => io.observe(s));
  }
}

function closeNav() {
  $('#navMobileMenu')?.classList.remove('open');
  $('#navToggle')?.classList.remove('active');
  $('#navToggle')?.setAttribute('aria-expanded', 'false');
}

/* ═══════════════════════════════════════════
   INTRO ANIMATION
═══════════════════════════════════════════ */
function initIntro() {
  const intro    = $('#intro');
  const site     = $('#site');
  if (!intro || !site) return;

  // Init Three.js background
  initIntroBg();
  initIntroParticles();

  const SKIP_DELAY = 6000;
  let autoSkipTimer, skipped = false;
  const progressFill = $('#intro-progress-fill');
  const skipRing     = $('#intro-skip-ring');
  const skipBtn      = $('#intro-skip-btn');

  function enterSite() {
    if (skipped) return;
    skipped = true;
    clearTimeout(autoSkipTimer);
    const tl = gsap.timeline({
      onComplete: () => {
        intro.style.display = 'none';
        site.style.display = '';
        document.body.style.overflow = '';
        initLenis();
        initScrollAnimations();
        loadHeroStats();
        loadHeroQueue();
      },
    });
    tl.to(intro, { opacity: 0, duration: 0.6, ease: 'power2.inOut' });
    tl.from(site, { opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');
  }

  // Build GSAP intro timeline
  if (window.gsap) {
    document.body.style.overflow = 'hidden';
    const tl = gsap.timeline({ delay: 0.3 });

    // Logo
    tl.to('#logo-wrap', { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.4)', from: { y: 30, opacity: 0 } }, 0);

    // Eyebrow
    tl.fromTo('#intro-eyebrow', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.5);

    // School name — char by char
    const schoolName = $('#intro-school-name');
    if (schoolName) {
      const text = 'SMAN 1 BELIMBING';
      schoolName.innerHTML = text.split('').map(ch =>
        ch === ' '
          ? '<span class="char-space" aria-hidden="true"></span>'
          : `<span class="char-wrap"><span class="char" aria-hidden="true">${ch}</span></span>`
      ).join('');
      tl.to('#intro-school-name .char', {
        opacity: 1, y: 0, duration: 0.04, stagger: 0.04, ease: 'none',
      }, 0.7);
    }

    // Location
    tl.fromTo('#intro-location', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 1.4);
    // Divider
    tl.fromTo('#intro-divider', { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.6, ease: 'power2.out' }, 1.7);
    // System label
    tl.fromTo('#intro-system-label', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, 2.1);
    // Service cards
    tl.fromTo('#svc-1, #svc-2', { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(1.2)' }, 2.4);
    // Enter button
    tl.fromTo('.intro-enter-btn', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 2.9);
    // Skip button
    tl.fromTo('.intro-skip-btn', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 3.2);

    // Auto-skip progress
    autoSkipTimer = setTimeout(() => {
      if (!skipped) enterSite();
    }, SKIP_DELAY + 300);

    // Animate skip ring
    let startTime;
    function animateProgress(ts) {
      if (!startTime) startTime = ts;
      const elapsed  = ts - startTime;
      const progress = Math.min(elapsed / SKIP_DELAY, 1);
      const circumference = 62.83;
      if (skipRing) skipRing.style.strokeDashoffset = String(circumference * (1 - progress));
      if (progressFill) progressFill.style.width = `${progress * 100}%`;
      if (progress < 1 && !skipped) requestAnimationFrame(animateProgress);
    }
    setTimeout(() => requestAnimationFrame(animateProgress), 300);
  } else {
    // No GSAP — show site immediately
    intro.style.display = 'none';
    site.style.display = '';
  }

  $('#intro-enter-btn')?.addEventListener('click', enterSite);
  skipBtn?.addEventListener('click', enterSite);
}

/* ── Three.js BG ── */
function initIntroBg() {
  const canvas = $('#intro-bg-canvas');
  if (!canvas || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 2;

  // Particle geometry
  const count = 1400;
  const geo   = new THREE.BufferGeometry();
  const pos   = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 6;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat  = new THREE.PointsMaterial({ color: 0x2D5CE8, size: 0.018, transparent: true, opacity: 0.6 });
  const pts  = new THREE.Points(geo, mat);
  scene.add(pts);

  // Large ambient orb
  const orbGeo = new THREE.SphereGeometry(1.6, 32, 32);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0x1E4BA8, transparent: true, opacity: 0.07 });
  scene.add(new THREE.Mesh(orbGeo, orbMat));

  let frame = 0;
  function animate() {
    requestAnimationFrame(animate);
    frame++;
    pts.rotation.y = frame * 0.0008;
    pts.rotation.x = Math.sin(frame * 0.0005) * 0.15;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

/* ── Canvas Particles ── */
function initIntroParticles() {
  const canvas = $('#particles-canvas');
  if (!canvas) return;
  const ctx   = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = innerWidth;
    H = canvas.height = innerHeight;
  }
  resize();

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * (typeof W !== 'undefined' ? W : innerWidth),
      y: Math.random() * (typeof H !== 'undefined' ? H : innerHeight),
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.5 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245,200,66,${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', resize, { passive: true });
}

/* ═══════════════════════════════════════════
   HERO THREE.JS CANVAS
═══════════════════════════════════════════ */
function initHeroCanvas() {
  const canvas = $('#hero-canvas');
  if (!canvas || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  const scene = new THREE.Scene();
  const cam   = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 100);
  cam.position.z = 3;

  const count = 800;
  const geo   = new THREE.BufferGeometry();
  const pos   = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 8;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xF5C842, size: 0.02, transparent: true, opacity: 0.5 });
  scene.add(new THREE.Points(geo, mat));

  let f = 0;
  (function animate() {
    requestAnimationFrame(animate);
    f++;
    scene.rotation.y = f * 0.0006;
    renderer.render(scene, cam);
  })();

  new ResizeObserver(() => {
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    cam.aspect = w / h; cam.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(canvas);
}

/* ═══════════════════════════════════════════
   SCROLL ANIMATIONS (GSAP + ScrollTrigger)
═══════════════════════════════════════════ */
function initScrollAnimations() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // Hero
  gsap.from('.hero-badge', { opacity: 0, y: 20, duration: 0.7, delay: 0.2 });
  gsap.from('.hero-title',  { opacity: 0, y: 30, duration: 0.8, delay: 0.35 });
  gsap.from('.hero-desc',   { opacity: 0, y: 20, duration: 0.7, delay: 0.55 });
  gsap.from('.hero-cta',    { opacity: 0, y: 20, duration: 0.6, delay: 0.75 });
  gsap.from('.hero-stats',  { opacity: 0, y: 15, duration: 0.5, delay: 0.95 });
  gsap.from('.hero-queue-card', { opacity: 0, x: 40, duration: 0.9, delay: 0.6, ease: 'power3.out' });

  // Alur cards
  gsap.from('.alur-card', {
    scrollTrigger: { trigger: '.alur', start: 'top 75%' },
    opacity: 0, y: 30, scale: 0.97,
    duration: 0.6, stagger: 0.12, ease: 'back.out(1.2)',
  });

  // Form
  gsap.from('.form-group', {
    scrollTrigger: { trigger: '.form-section', start: 'top 75%' },
    opacity: 0, y: 20, duration: 0.5, stagger: 0.1,
  });

  // FAQ
  gsap.from('.faq-item', {
    scrollTrigger: { trigger: '.faq', start: 'top 75%' },
    opacity: 0, y: 16, duration: 0.45, stagger: 0.08,
  });

  initHeroCanvas();
}

/* ═══════════════════════════════════════════
   HERO DATA
═══════════════════════════════════════════ */
async function loadHeroStats() {
  if (!isConfigured()) {
    $('#statTotal').textContent  = DUMMY_APPOINTMENTS.length;
    $('#statToday').textContent  = DUMMY_APPOINTMENTS.filter(a => a.tanggal === new Date().toISOString().split('T')[0]).length;
    $('#statWaiting').textContent = DUMMY_APPOINTMENTS.filter(a => a.status === 'Menunggu Konfirmasi').length;
    return;
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('appointments').select('id, status, tanggal');
    const rows = data || [];
    $('#statTotal').textContent   = rows.length;
    $('#statToday').textContent   = rows.filter(r => r.tanggal === today).length;
    $('#statWaiting').textContent = rows.filter(r => r.status === 'Menunggu Konfirmasi').length;
  } catch {}
}

async function loadHeroQueue() {
  const container = $('#heroQueuePreview');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  let items = [];

  if (!isConfigured()) {
    items = DUMMY_APPOINTMENTS
      .filter(a => a.tanggal === today && a.status !== 'Dibatalkan')
      .slice(0, 4);
  } else {
    try {
      const { data } = await supabase.from('appointments').select('*')
        .eq('tanggal', today).neq('status', 'Dibatalkan')
        .order('jam', { ascending: true }).limit(4);
      items = data || [];
    } catch {}
  }

  if (!items.length) {
    container.innerHTML = '<div class="hqc-empty">Belum ada janji hari ini</div>';
    return;
  }

  container.innerHTML = items.map(a => {
    const s = statusMap[a.status] || { cls:'badge-waiting', label:'Menunggu' };
    const statusClass = a.status === 'Selesai' ? 'selesai' : a.status === 'Dikonfirmasi' ? 'konfirmasi' : 'menunggu';
    return `<div class="hqc-item">
      <span class="hqc-queue">${sanitizeText(a.nomor_antrian)}</span>
      <div class="hqc-info">
        <div class="hqc-name">${sanitizeText(a.nama_lengkap)}</div>
        <div class="hqc-dest">${sanitizeText(a.tujuan_bertemu)}</div>
      </div>
      <span class="hqc-status ${statusClass}">${sanitizeText(s.label)}</span>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   FORM — CUSTOM SELECT
═══════════════════════════════════════════ */
function initCustomSelect() {
  const trigger  = $('#tujuanTrigger');
  const options  = $('#tujuanOptions');
  const display  = $('#tujuanDisplay');
  const hidden   = $('#tujuanBertemuHidden');
  const lainnyaF = $('#tujuanLainnyaField');
  if (!trigger) return;

  trigger.addEventListener('click', () => {
    const open = options.classList.toggle('open');
    trigger.classList.toggle('active', open);
    $('#tujuanSelect').setAttribute('aria-expanded', String(open));
  });

  $$('.select-option', options).forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.dataset.value;
      hidden.value = val;
      display.textContent = opt.querySelector('span').textContent;
      trigger.classList.add('has-value');
      $$('.select-option', options).forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      options.classList.remove('open');
      trigger.classList.remove('active');
      $('#tujuanSelect').setAttribute('aria-expanded', 'false');
      if (val === 'Lainnya') lainnyaF?.classList.remove('hidden');
      else lainnyaF?.classList.add('hidden');
      clearError('tujuanBertemu');
    });
  });

  trigger.addEventListener('keydown', (e) => {
    if (['Enter', ' '].includes(e.key)) { e.preventDefault(); trigger.click(); }
    if (e.key === 'Escape') { options.classList.remove('open'); trigger.classList.remove('active'); }
  });

  document.addEventListener('click', (e) => {
    if (!$('#tujuanSelect').contains(e.target)) {
      options.classList.remove('open');
      trigger.classList.remove('active');
    }
  });
}

/* ═══════════════════════════════════════════
   FORM — FILE UPLOAD
═══════════════════════════════════════════ */
let uploadedFile = null;

function initFileUpload() {
  const area    = $('#fileUploadArea');
  const input   = $('#dokumenFile');
  const preview = $('#filePreview');
  const remove  = $('#fileRemove');
  if (!area) return;

  area.addEventListener('click', () => input.click());
  area.addEventListener('keydown', (e) => { if (['Enter', ' '].includes(e.key)) input.click(); });

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault(); area.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
  remove?.addEventListener('click', () => {
    uploadedFile = null; input.value = '';
    preview.classList.add('hidden'); area.style.display = '';
  });

  function handleFile(file) {
    const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/jpg','image/png'];
    if (!allowed.includes(file.type)) { toast('error', 'Format tidak didukung', 'Gunakan PDF, DOC, DOCX, JPG, atau PNG'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('error', 'File terlalu besar', 'Ukuran maksimal 5MB'); return; }
    uploadedFile = file;
    $('#fileName').textContent = file.name;
    $('#fileSize').textContent = formatFileSize(file.size);
    preview.classList.remove('hidden');
    area.style.display = 'none';
    clearError('dokumen');
  }
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════════
   FORM — DATE CONSTRAINTS
═══════════════════════════════════════════ */
function initDateConstraints() {
  const dateInput = $('#tanggal');
  if (!dateInput) return;
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 60);
  dateInput.min = today;
  dateInput.max = maxDate.toISOString().split('T')[0];
}

/* ═══════════════════════════════════════════
   FORM — CHAR COUNTER
═══════════════════════════════════════════ */
function initCharCounter() {
  const textarea = $('#keperluan');
  const counter  = $('#charCount');
  if (!textarea || !counter) return;
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = len;
    if (len > 500) textarea.value = textarea.value.slice(0, 500);
    counter.style.color = len > 450 ? 'var(--c-danger)' : 'var(--c-text-3)';
  });
}

/* ═══════════════════════════════════════════
   FORM — VALIDATION & SUBMIT
═══════════════════════════════════════════ */
function setError(field, msg) {
  const el = $(`#err-${field}`);
  const input = $(`#${field}`);
  if (el) el.textContent = msg;
  input?.classList.add('error');
}
function clearError(field) {
  const el = $(`#err-${field}`);
  const input = $(`#${field}`);
  if (el) el.textContent = '';
  input?.classList.remove('error');
}
function clearAllErrors() {
  $$('.field-error').forEach(e => e.textContent = '');
  $$('input.error, textarea.error').forEach(e => e.classList.remove('error'));
}

function validateForm() {
  clearAllErrors();
  let valid = true;

  const nama = $('#namaLengkap')?.value.trim();
  if (!nama || nama.length < 3) { setError('namaLengkap', 'Nama minimal 3 karakter'); valid = false; }

  const wa = ($('#nomorWA')?.value || '').replace(/\D/g, '');
  if (!wa || wa.length < 10 || wa.length > 15) { setError('nomorWA', 'Nomor WhatsApp tidak valid (10–15 digit)'); valid = false; }

  const tujuan = $('#tujuanBertemuHidden')?.value;
  if (!tujuan) { setError('tujuanBertemu', 'Pilih tujuan bertemu'); valid = false; }
  if (tujuan === 'Lainnya' && !$('#tujuanLainnya')?.value.trim()) {
    setError('tujuanLainnya', 'Mohon sebutkan tujuan bertemu'); valid = false;
  }

  const keperluan = $('#keperluan')?.value.trim();
  if (!keperluan || keperluan.length < 10) { setError('keperluan', 'Keperluan minimal 10 karakter'); valid = false; }

  const tgl = $('#tanggal')?.value;
  if (!tgl) { setError('tanggal', 'Pilih tanggal kunjungan'); valid = false; }

  const jam = $('#jam')?.value;
  if (!jam) { setError('jam', 'Pilih jam kunjungan'); valid = false; }
  else {
    const [h] = jam.split(':').map(Number);
    if (h < 7 || h >= 16) { setError('jam', 'Jam kunjungan: 07:00 – 16:00 WIB'); valid = false; }
  }

  return valid;
}

async function uploadDocument() {
  if (!uploadedFile || !isConfigured()) return null;
  try {
    const ext   = uploadedFile.name.split('.').pop();
    const path  = `dokumen/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('appointments').upload(path, uploadedFile);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('appointments').getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.warn('Upload failed:', e);
    return null;
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) {
    document.querySelector('.field-error:not(:empty)')?.closest('.form-field')?.querySelector('input,textarea')?.focus();
    return;
  }

  const btn      = $('#btnSubmit');
  const text     = $('#submitText');
  const loader   = $('#submitLoader');
  btn.disabled   = true;
  text.style.display = 'none';
  loader.style.display = 'flex';

  try {
    const tujuan = $('#tujuanBertemuHidden').value === 'Lainnya'
      ? $('#tujuanLainnya').value.trim()
      : $('#tujuanBertemuHidden').value;

    let dokumenUrl = await uploadDocument();

    const payload = {
      namaLengkap:   $('#namaLengkap').value.trim(),
      nomorWA:       ($('#nomorWA').value).replace(/\D/g, ''),
      instansi:      $('#instansi').value.trim() || null,
      tujuanBertemu: tujuan,
      keperluan:     $('#keperluan').value.trim(),
      tanggal:       $('#tanggal').value,
      jam:           $('#jam').value,
      dokumenUrl,
    };

    let result;
    if (!isConfigured()) {
      // Demo mode — use dummy data
      await new Promise(r => setTimeout(r, 1200));
      const idx = Math.floor(Math.random() * 26);
      const qNum = `${String.fromCharCode(65 + Math.floor(Math.random()*3))}-${String(Math.floor(Math.random()*99)+1).padStart(3,'0')}`;
      result = { ...payload, id: `demo-${Date.now()}`, nomor_antrian: qNum, status: 'Menunggu Konfirmasi', created_at: new Date().toISOString() };
    } else {
      const resp = await fetch(`${CONFIG.FN_BASE}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.errors?.join(', ') || data.message || 'Gagal mengajukan janji');
      result = data.data;
    }

    // Show ticket
    showTicket(result);
    toast('success', 'Janji Temu Berhasil Diajukan!', `Nomor antrian Anda: ${result.nomor_antrian}`);

    // Reset form
    e.target.reset();
    uploadedFile = null;
    $('#filePreview')?.classList.add('hidden');
    $('#fileUploadArea').style.display = '';
    $('#tujuanDisplay').textContent = 'Pilih tujuan bertemu';
    $('#tujuanTrigger').classList.remove('has-value');
    $('#tujuanBertemuHidden').value = '';
    clearAllErrors();

  } catch (err) {
    toast('error', 'Pengajuan Gagal', err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    console.error('Submit error:', err);
  } finally {
    btn.disabled  = false;
    text.style.display = '';
    loader.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════
   DIGITAL TICKET
═══════════════════════════════════════════ */
function showTicket(apt) {
  const overlay = $('#ticketOverlay');
  if (!overlay) return;

  // Populate
  $('#ticketNum').textContent   = apt.nomor_antrian;
  $('#tNama').textContent       = apt.nama_lengkap;
  $('#tWA').textContent         = apt.nomor_wa;
  $('#tTujuan').textContent     = apt.tujuan_bertemu;
  $('#tTanggal').textContent    = formatDate(apt.tanggal);
  $('#tJam').textContent        = (apt.jam || '').slice(0,5) + ' WIB';
  $('#tKeperluan').textContent  = apt.keperluan;
  $('#tCreated').textContent    = formatDateTime(apt.created_at);

  const badge = $('#ticketStatusBadge');
  const m = statusMap[apt.status] || { cls:'badge-waiting', label:apt.status };
  badge.className = `ticket-status-badge badge ${m.cls}`;
  badge.textContent = m.label;

  // Generate QR Code
  const qrCanvas = $('#ticketQRCanvas');
  if (qrCanvas && window.QRCode) {
    const qrData = JSON.stringify({
      id: apt.id, queue: apt.nomor_antrian, name: apt.nama_lengkap,
      date: apt.tanggal, time: apt.jam, dest: apt.tujuan_bertemu,
    });
    QRCode.toCanvas(qrCanvas, qrData, {
      width: 180, margin: 2,
      color: {
        dark: document.documentElement.getAttribute('data-theme') === 'dark' ? '#EEF2FF' : '#04091F',
        light: document.documentElement.getAttribute('data-theme') === 'dark' ? '#080E26' : '#FFFFFF',
      },
    }, (err) => { if (err) console.warn('QR Error:', err); });
  }

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Store for actions
  overlay._apt = apt;
}

function closeTicket() {
  $('#ticketOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

function initTicket() {
  $('#ticketClose')?.addEventListener('click', closeTicket);
  $('#ticketOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTicket(); });

  $('#btnPrint')?.addEventListener('click', () => window.print());

  $('#btnCopyNum')?.addEventListener('click', () => {
    const num = $('#ticketNum')?.textContent;
    navigator.clipboard.writeText(num || '').then(() => toast('success', 'Disalin!', `Nomor antrian ${num} tersalin`));
  });

  $('#btnShare')?.addEventListener('click', async () => {
    const apt = $('#ticketOverlay')?._apt;
    const text = `Nomor Antrian: ${apt?.nomor_antrian}\nNama: ${apt?.nama_lengkap}\nTanggal: ${formatDate(apt?.tanggal)}\nTujuan: ${apt?.tujuan_bertemu}\n\nPortal Pelayanan Digital SMAN 1 BELIMBING`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Tiket Antrian SMAN 1 BELIMBING', text }); }
      catch {}
    } else {
      navigator.clipboard.writeText(text).then(() => toast('info', 'Tersalin', 'Teks tiket tersalin ke clipboard'));
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTicket(); });
}

/* ═══════════════════════════════════════════
   FAQ
═══════════════════════════════════════════ */
function initFAQ() {
  $$('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('active');
      $$('.faq-item.active').forEach(i => { i.classList.remove('active'); i.querySelector('.faq-question').setAttribute('aria-expanded', 'false'); });
      if (!isOpen) { item.classList.add('active'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
}

/* ═══════════════════════════════════════════
   DAFTAR JANJI PAGE
═══════════════════════════════════════════ */
let allAppointments = [], filteredAppointments = [], currentPage = 1;

async function initDaftarJanji() {
  await loadAppointments();
  initDaftarFilters();
  initRealtimeDaftar();
}

async function loadAppointments() {
  try {
    let data;
    if (!isConfigured()) {
      data = DUMMY_APPOINTMENTS;
    } else {
      const { data: rows } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
      data = rows || [];
    }
    allAppointments = data;
    filteredAppointments = [...data];
    renderStats(data);
    renderAppointments(filteredAppointments, currentPage);
  } catch (e) {
    allAppointments = DUMMY_APPOINTMENTS;
    filteredAppointments = [...DUMMY_APPOINTMENTS];
    renderStats(DUMMY_APPOINTMENTS);
    renderAppointments(filteredAppointments, 1);
    toast('warning', 'Mode Demo', 'Menampilkan data contoh');
  }
}

function renderStats(data) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  $('#sTotalAll').textContent      = data.length;
  $('#sTotalToday').textContent    = data.filter(a => a.tanggal === today).length;
  $('#sTotalWaiting').textContent  = data.filter(a => a.status === 'Menunggu Konfirmasi').length;
  $('#sTotalConfirmed').textContent = data.filter(a => a.status === 'Dikonfirmasi').length;
  $('#sTotalDone').textContent     = data.filter(a => a.status === 'Selesai').length;
  $('#sWeek').textContent          = data.filter(a => new Date(a.tanggal) >= weekStart).length;

  // Also hero stats
  if ($('#statTotal')) {
    $('#statTotal').textContent  = data.length;
    $('#statToday').textContent  = data.filter(a => a.tanggal === today).length;
    $('#statWaiting').textContent = data.filter(a => a.status === 'Menunggu Konfirmasi').length;
  }
}

function renderAppointments(data, page) {
  const grid = $('#appointmentsGrid');
  if (!grid) return;
  const start = (page - 1) * CONFIG.ITEMS_PER_PAGE;
  const items = data.slice(start, start + CONFIG.ITEMS_PER_PAGE);

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div><h3>Tidak ada janji ditemukan</h3><p>Coba ubah filter atau buat janji temu baru</p></div>`;
    renderPagination(data.length, page);
    return;
  }

  grid.innerHTML = items.map(a => `
    <article class="apt-card" data-id="${sanitizeText(a.id)}">
      <div class="apt-card-head">
        <span class="apt-queue">${sanitizeText(a.nomor_antrian)}</span>
        ${statusBadge(a.status)}
      </div>
      <div class="apt-card-body">
        <div class="apt-row">
          <div class="apt-row-icon"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div><span class="apt-label">Nama</span><span class="apt-value">${sanitizeText(a.nama_lengkap)}</span></div>
        </div>
        <div class="apt-row">
          <div class="apt-row-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>
          <div><span class="apt-label">Tujuan</span><span class="apt-value">${sanitizeText(a.tujuan_bertemu)}</span></div>
        </div>
        <div class="apt-row">
          <div class="apt-row-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
          <div><span class="apt-label">Tanggal &amp; Jam</span><span class="apt-value">${sanitizeText(formatDateShort(a.tanggal))} · ${sanitizeText((a.jam||'').slice(0,5))} WIB</span></div>
        </div>
        <div class="apt-row">
          <div class="apt-row-icon"><svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg></div>
          <div><span class="apt-label">Keperluan</span><span class="apt-value" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${sanitizeText(a.keperluan)}</span></div>
        </div>
        ${a.instansi ? `<div class="apt-row"><div class="apt-row-icon"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div><div><span class="apt-label">Instansi</span><span class="apt-value">${sanitizeText(a.instansi)}</span></div></div>` : ''}
      </div>
      <div class="apt-card-foot">
        <span class="apt-time">${sanitizeText(formatDateTime(a.created_at))}</span>
        <div class="apt-actions">
          ${a.dokumen_url ? `<a href="${sanitizeText(a.dokumen_url)}" target="_blank" rel="noopener" class="apt-action-btn" title="Lihat dokumen"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></a>` : ''}
        </div>
      </div>
    </article>`).join('');

  renderPagination(data.length, page);
  animateCards();
}

function animateCards() {
  if (!window.gsap) return;
  gsap.from('.apt-card', { opacity: 0, y: 20, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' });
}

function renderPagination(total, page) {
  const container = $('#paginationBar') || $('#aptPagination');
  if (!container) return;
  const totalPages = Math.ceil(total / CONFIG.ITEMS_PER_PAGE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${page===1?'disabled':''} data-page="${page-1}" aria-label="Sebelumnya"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>`;
  const range = Array.from({ length: totalPages }, (_, i) => i+1).filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1);
  let prev = 0;
  range.forEach(p => {
    if (p - prev > 1) html += `<span class="page-btn" style="cursor:default;opacity:.4">…</span>`;
    html += `<button class="page-btn ${p===page?'active':''}" data-page="${p}" aria-label="Halaman ${p}" ${p===page?'aria-current="page"':''}>${p}</button>`;
    prev = p;
  });
  html += `<button class="page-btn" ${page===totalPages?'disabled':''} data-page="${page+1}" aria-label="Berikutnya"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>`;
  container.innerHTML = html;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    const pg = parseInt(btn.dataset.page);
    if (pg < 1 || pg > totalPages) return;
    currentPage = pg;
    if (window.__DAFTAR_PAGE__) renderAppointments(filteredAppointments, pg);
    else if (window.__ADMIN_PAGE__) renderAptTable(adminFilterData(), pg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initDaftarFilters() {
  const search = $('#searchInput');
  const status = $('#statusFilter');
  const tujuan = $('#tujuanFilter');
  const date   = $('#dateFilter');
  const reset  = $('#resetFilter');

  function applyFilters() {
    const q  = (search?.value || '').toLowerCase();
    const s  = status?.value || '';
    const t  = tujuan?.value || '';
    const d  = date?.value   || '';
    filteredAppointments = allAppointments.filter(a =>
      (!q || a.nama_lengkap?.toLowerCase().includes(q) || a.nomor_antrian?.toLowerCase().includes(q) || a.keperluan?.toLowerCase().includes(q)) &&
      (!s || a.status === s) &&
      (!t || a.tujuan_bertemu === t) &&
      (!d || a.tanggal === d)
    );
    currentPage = 1;
    renderStats(allAppointments);
    renderAppointments(filteredAppointments, 1);
  }

  [search, status, tujuan, date].forEach(el => el?.addEventListener('input', applyFilters));
  reset?.addEventListener('click', () => {
    if (search) search.value = '';
    if (status) status.value = '';
    if (tujuan) tujuan.value = '';
    if (date)   date.value   = '';
    applyFilters();
  });
}

function initRealtimeDaftar() {
  if (!isConfigured()) return;
  supabase.channel('appointments-public')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        allAppointments.unshift(payload.new);
        toast('info', 'Janji baru!', `${payload.new.nama_lengkap} — ${payload.new.nomor_antrian}`);
      } else if (payload.eventType === 'UPDATE') {
        const idx = allAppointments.findIndex(a => a.id === payload.new.id);
        if (idx !== -1) allAppointments[idx] = payload.new;
      } else if (payload.eventType === 'DELETE') {
        allAppointments = allAppointments.filter(a => a.id !== payload.old.id);
      }
      filteredAppointments = [...allAppointments];
      renderStats(allAppointments);
      renderAppointments(filteredAppointments, currentPage);
      loadHeroQueue();
    })
    .subscribe();
}

/* ═══════════════════════════════════════════
   ADMIN — AUTH
═══════════════════════════════════════════ */
let adminToken = sessionStorage.getItem('adminToken');

async function verifyAdmin() {
  if (!adminToken) return false;
  if (!isConfigured()) return true; // Demo mode
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token: adminToken }),
    });
    const d = await r.json();
    return d.valid === true;
  } catch { return false; }
}

async function initAdminPage() {
  const loginScreen = $('#loginScreen');
  const dashboard   = $('#adminDashboard');
  if (!loginScreen || !dashboard) return;

  const valid = await verifyAdmin();
  if (valid) {
    showDashboard();
  } else {
    adminToken = null;
    sessionStorage.removeItem('adminToken');
    loginScreen.style.display = '';
    loginScreen.classList.add('active');
    initLoginForm();
  }
}

function showDashboard() {
  $('#loginScreen').style.display  = 'none';
  $('#adminDashboard').style.display = '';
  initAdminDashboard();
}

function initLoginForm() {
  const btn     = $('#loginBtn');
  const usernameInput = $('#loginUsername');
  const passwordInput = $('#loginPassword');
  const pwToggle = $('#pwToggle');
  const eyeIcon  = $('#eyeIcon');

  pwToggle?.addEventListener('click', () => {
    const isPw = passwordInput.type === 'password';
    passwordInput.type = isPw ? 'text' : 'password';
    eyeIcon.innerHTML  = isPw
      ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });

  async function doLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) { toast('warning', 'Lengkapi data', 'Username dan password wajib diisi'); return; }

    btn.disabled = true;
    $('#loginBtnText').textContent = 'Memverifikasi...';

    if (!isConfigured()) {
      // Demo mode
      await new Promise(r => setTimeout(r, 800));
      if (username === 'SMANSABEL_7' && password === 'SMANSABEL_Jaya') {
        adminToken = 'demo-token-' + Date.now();
        sessionStorage.setItem('adminToken', adminToken);
        showDashboard();
      } else {
        toast('error', 'Login Gagal', 'Username atau password salah');
      }
      btn.disabled = false;
      $('#loginBtnText').textContent = 'Masuk';
      return;
    }

    try {
      const r = await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const d = await r.json();
      if (d.success) {
        adminToken = d.token;
        sessionStorage.setItem('adminToken', adminToken);
        showDashboard();
      } else {
        const warn = d.attemptsRemaining !== undefined ? `Sisa percobaan: ${d.attemptsRemaining}` : '';
        $('#loginAttemptsWarn').textContent = warn;
        $('#loginAttemptsWarn').classList.toggle('hidden', !warn);
        toast('error', 'Login Gagal', d.message || 'Periksa username dan password');
      }
    } catch (e) { toast('error', 'Koneksi Gagal', 'Tidak dapat terhubung ke server'); }

    btn.disabled = false;
    $('#loginBtnText').textContent = 'Masuk';
  }

  btn?.addEventListener('click', doLogin);
  passwordInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  usernameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput?.focus(); });
}

/* ═══════════════════════════════════════════
   ADMIN — DASHBOARD
═══════════════════════════════════════════ */
let adminData = [];
let adminPage = 1;

async function initAdminDashboard() {
  initAdminNav();
  initAdminSidebar();
  initAdminTheme();
  await loadAdminData();
  initAdminRealtime();
  loadSettings();
  switchTab('dashboard');

  // Password toggles in settings
  $$('.pw-toggle[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(`#${btn.dataset.target}`);
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
  });

  // Logout
  $('#logoutBtn')?.addEventListener('click', async () => {
    if (!isConfigured()) { adminToken = null; sessionStorage.removeItem('adminToken'); location.reload(); return; }
    await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout', token: adminToken }),
    });
    adminToken = null;
    sessionStorage.removeItem('adminToken');
    location.reload();
  });

  // Password strength
  $('#newPassword')?.addEventListener('input', (e) => {
    const v = e.target.value;
    const wrap = $('#pwStrengthWrap');
    wrap.style.display = v ? '' : 'none';
    const score = calcPasswordStrength(v);
    const bar   = $('#pwStrengthBar');
    const label = $('#pwStrengthLabel');
    const [bg, text, lbl] = score < 2 ? ['var(--c-danger)', 'var(--c-danger)', 'Lemah']
      : score < 4 ? ['var(--c-warning)', 'var(--c-warning)', 'Sedang']
      : ['var(--c-success)', 'var(--c-success)', 'Kuat'];
    bar.style.width = `${(score / 5) * 100}%`;
    bar.style.background = bg;
    label.style.color = text;
    label.textContent = lbl;
  });

  // Reset password
  $('#btnResetPassword')?.addEventListener('click', doResetPassword);
  $('#btnResetClear')?.addEventListener('click', () => {
    $$('#currentPassword, #newPassword, #confirmPassword').forEach(i => i.value = '');
    $$('#err-currentPassword, #err-newPassword, #err-confirmPassword').forEach(e => e.textContent = '');
    $('#pwStrengthWrap').style.display = 'none';
  });

  // Reports
  $$('.report-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.report-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const period = btn.dataset.period;
      $('#customDateRange').style.display = period === 'custom' ? 'flex' : 'none';
      if (period !== 'custom') loadReport(period);
    });
  });
  $('#btnApplyCustom')?.addEventListener('click', () => loadReport('custom'));
  $('#btnDownloadExcel')?.addEventListener('click', () => downloadReport('xlsx'));
  $('#btnDownloadCSV')?.addEventListener('click', () => downloadReport('csv'));
  $('#btnPrintReport')?.addEventListener('click', () => window.print());

  // WA settings save
  $('#btnSaveWAConfig')?.addEventListener('click', saveWAConfig);
  $('#btnSaveTargets')?.addEventListener('click', saveWATargets);

  // Logs
  $('#btnRefreshLogs')?.addEventListener('click', loadLogs);

  // Apt table filters
  $$('#aptSearch, #aptFilterStatus, #aptFilterTujuan, #aptFilterDate').forEach(el =>
    el?.addEventListener('input', () => { adminPage = 1; renderAptTable(adminFilterData(), 1); })
  );
  $('#aptFilterReset')?.addEventListener('click', () => {
    $$('#aptSearch, #aptFilterStatus, #aptFilterTujuan, #aptFilterDate').forEach(el => { if (el) el.value = ''; });
    adminPage = 1;
    renderAptTable(adminData, 1);
  });

  // Load initial report
  loadReport('week');
}

function calcPasswordStrength(pw) {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function initAdminTheme() {
  $('#adminThemeToggle')?.addEventListener('click', toggleTheme);
}

function initAdminNav() {
  $$('.admin-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const tab = link.dataset.tab;
      if (tab) switchTab(tab);
    });
    link.addEventListener('keydown', (e) => {
      if (['Enter', ' '].includes(e.key)) { e.preventDefault(); link.click(); }
    });
  });
}

function switchTab(name) {
  $$('.admin-tab').forEach(t => t.style.display = 'none');
  $$('.admin-nav-link').forEach(l => l.classList.remove('active'));
  const tab  = $(`#tab-${name}`);
  const link = $(`.admin-nav-link[data-tab="${name}"]`);
  if (tab)  tab.style.display  = '';
  if (link) link.classList.add('active');
  const titles = { dashboard:'Dashboard', appointments:'Daftar Janji', reports:'Laporan & Unduh', settings:'Pengaturan', password:'Ganti Password', logs:'Log Aktivitas' };
  const pageTitle = $('#adminPageTitle');
  if (pageTitle) pageTitle.textContent = titles[name] || name;
  if (name === 'logs') loadLogs();
  window.__ADMIN_TAB__ = name;
}

function initAdminSidebar() {
  const toggle  = $('#sidebarToggle');
  const sidebar = $('#adminSidebar');
  const overlay = $('#sidebarOverlay');

  toggle?.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', open);
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

async function loadAdminData() {
  try {
    let data = [];
    if (!isConfigured()) {
      data = DUMMY_APPOINTMENTS;
    } else {
      const { data: rows } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
      data = rows || [];
    }
    adminData = data;
    renderDashStats(data);
    renderDashChart(data);
    renderDashRecent(data.slice(0, 8));
    renderAptTable(data, 1);
    updateSidebarBadge(data);
    return data;
  } catch (e) {
    console.error(e);
    adminData = DUMMY_APPOINTMENTS;
    renderDashStats(adminData);
    renderDashRecent(adminData.slice(0, 8));
    renderAptTable(adminData, 1);
    return adminData;
  }
}

function renderDashStats(data) {
  const today     = new Date().toISOString().split('T')[0];
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(); monthStart.setDate(1);

  $('#dStatTotal').textContent     = data.length;
  $('#dStatWaiting').textContent   = data.filter(r => r.status === 'Menunggu Konfirmasi').length;
  $('#dStatConfirmed').textContent = data.filter(r => r.status === 'Dikonfirmasi').length;
  $('#dStatDone').textContent      = data.filter(r => r.status === 'Selesai').length;
  $('#dStatToday').textContent     = data.filter(r => r.tanggal === today).length;
  $('#dStatWeek').textContent      = data.filter(r => new Date(r.tanggal) >= weekStart).length;
  $('#dStatMonth').textContent     = data.filter(r => new Date(r.tanggal) >= monthStart).length;
}

function renderDashChart(data) {
  const chart = $('#dashChart');
  if (!chart) return;
  const days  = 7;
  const max   = 1;
  const items = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const count = data.filter(r => r.tanggal === ds).length;
    items.push({ date: ds, count, label: d.toLocaleDateString('id-ID',{weekday:'short'}) });
  }
  const maxVal = Math.max(...items.map(x => x.count), 1);
  chart.innerHTML = items.map(item => `
    <div class="chart-bar-item">
      <span class="chart-bar-value">${item.count || ''}</span>
      <div class="chart-bar-fill" style="height:${(item.count / maxVal) * 180}px" title="${item.date}: ${item.count} janji"></div>
      <span class="chart-bar-label">${item.label}</span>
    </div>`).join('');
}

function renderDashRecent(data) {
  const body = $('#dashRecentBody');
  if (!body) return;
  if (!data.length) { body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--c-text-3);padding:var(--sp-8)">Belum ada data</td></tr>'; return; }
  body.innerHTML = data.map(a => `<tr>
    <td><span style="font-family:var(--f-mono);font-weight:700;color:var(--c-electric)">${sanitizeText(a.nomor_antrian)}</span></td>
    <td style="font-weight:600">${sanitizeText(a.nama_lengkap)}</td>
    <td><a href="https://wa.me/${sanitizeText(a.nomor_wa)}" target="_blank" rel="noopener" style="color:var(--c-electric)">${sanitizeText(a.nomor_wa)}</a></td>
    <td>${sanitizeText(a.tujuan_bertemu)}</td>
    <td>${sanitizeText(formatDateShort(a.tanggal))}</td>
    <td>${sanitizeText((a.jam||'').slice(0,5))}</td>
    <td>${statusBadge(a.status)}</td>
    <td>
      <div class="table-actions">
        <button class="table-btn" title="Detail" onclick="showDetailModal('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="table-btn" title="Ubah Status" onclick="showStatusModal('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="table-btn wa" title="Kirim WA Ulang" onclick="resendWA('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.5 19.79 19.79 0 01.01 6 2 2 0 012 4h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 11a16 16 0 006.29 6.29l1.17-1.17a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></button>
      </div>
    </td>
  </tr>`).join('');
}

function adminFilterData() {
  const q = ($('#aptSearch')?.value || '').toLowerCase();
  const s = $('#aptFilterStatus')?.value || '';
  const t = $('#aptFilterTujuan')?.value || '';
  const d = $('#aptFilterDate')?.value   || '';
  return adminData.filter(a =>
    (!q || (a.nama_lengkap||'').toLowerCase().includes(q) || (a.nomor_antrian||'').toLowerCase().includes(q) || (a.keperluan||'').toLowerCase().includes(q) || (a.nomor_wa||'').includes(q)) &&
    (!s || a.status === s) && (!t || a.tujuan_bertemu === t) && (!d || a.tanggal === d)
  );
}

function renderAptTable(data, page = 1) {
  const body   = $('#aptTableBody');
  const count  = $('#aptCount');
  if (!body) return;
  if (count) count.textContent = `${data.length} janji`;

  const start = (page - 1) * CONFIG.ITEMS_PER_PAGE;
  const items = data.slice(start, start + CONFIG.ITEMS_PER_PAGE);

  if (!items.length) {
    body.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--c-text-3);padding:var(--sp-8)">Tidak ada data sesuai filter</td></tr>';
    renderPagination(data.length, page);
    return;
  }

  body.innerHTML = items.map(a => `<tr>
    <td><span style="font-family:var(--f-mono);font-weight:700;color:var(--c-electric)">${sanitizeText(a.nomor_antrian)}</span></td>
    <td style="font-weight:600;white-space:nowrap">${sanitizeText(a.nama_lengkap)}</td>
    <td><a href="https://wa.me/${sanitizeText(a.nomor_wa)}" target="_blank" rel="noopener" style="color:var(--c-electric);white-space:nowrap">${sanitizeText(a.nomor_wa)}</a></td>
    <td>${sanitizeText(a.instansi || '-')}</td>
    <td style="white-space:nowrap">${sanitizeText(a.tujuan_bertemu)}</td>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${sanitizeText(a.keperluan)}">${sanitizeText(a.keperluan)}</td>
    <td style="white-space:nowrap">${sanitizeText(formatDateShort(a.tanggal))}</td>
    <td style="white-space:nowrap">${sanitizeText((a.jam||'').slice(0,5))} WIB</td>
    <td>${a.dokumen_url ? `<a href="${sanitizeText(a.dokumen_url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-xs">Lihat</a>` : '<span style="color:var(--c-text-3)">-</span>'}</td>
    <td>${statusBadge(a.status)}</td>
    <td style="white-space:nowrap;color:var(--c-text-3);font-size:.75rem">${sanitizeText(formatDateTime(a.created_at))}</td>
    <td>
      <div class="table-actions">
        <button class="table-btn" title="Detail" onclick="showDetailModal('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="table-btn" title="Ubah Status" onclick="showStatusModal('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="table-btn wa" title="Kirim WA" onclick="resendWA('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07"/></svg></button>
        <button class="table-btn danger" title="Hapus" onclick="deleteAppointment('${sanitizeText(a.id)}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
      </div>
    </td>
  </tr>`).join('');
  renderPagination(data.length, page);
}

function updateSidebarBadge(data) {
  const badge = $('#sidebarBadge');
  if (!badge) return;
  const n = data.filter(a => a.status === 'Menunggu Konfirmasi').length;
  badge.textContent = n > 0 ? n : '';
  badge.style.display = n > 0 ? '' : 'none';
}

/* ── Detail Modal ── */
window.showDetailModal = function(id) {
  const apt = adminData.find(a => a.id === id);
  if (!apt) return;

  const grid = $('#detailGrid');
  if (!grid) return;

  grid.innerHTML = [
    { label:'Nomor Antrian', value:apt.nomor_antrian, full:false, mono:true },
    { label:'Status', value:statusBadge(apt.status), full:false, raw:true },
    { label:'Nama Lengkap', value:apt.nama_lengkap },
    { label:'Nomor WhatsApp', value:`<a href="https://wa.me/${apt.nomor_wa}" target="_blank" rel="noopener" style="color:var(--c-electric)">${apt.nomor_wa}</a>`, raw:true },
    { label:'Instansi', value:apt.instansi || '-' },
    { label:'Tujuan Bertemu', value:apt.tujuan_bertemu },
    { label:'Tanggal', value:formatDate(apt.tanggal) },
    { label:'Jam', value:(apt.jam||'').slice(0,5)+' WIB' },
    { label:'Keperluan', value:apt.keperluan, full:true },
    apt.dokumen_url ? { label:'Dokumen', value:`<a href="${apt.dokumen_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:4px">Lihat Dokumen</a>`, full:false, raw:true } : null,
    { label:'Diajukan', value:formatDateTime(apt.created_at) },
  ].filter(Boolean).map(f => `
    <div class="detail-item${f.full?' detail-full':''}">
      <span class="detail-label">${sanitizeText(f.label)}</span>
      <span class="detail-value${f.mono?' '+'font-family:var(--f-mono)':''}">${f.raw ? f.value : sanitizeText(f.value)}</span>
    </div>`).join('');

  $('#detailModalTitle').textContent = `Detail — ${apt.nomor_antrian}`;
  $('#detailFooter').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showStatusModal('${apt.id}')">Ubah Status</button>
    <button class="btn btn-primary btn-sm" onclick="resendWA('${apt.id}')">Kirim WA</button>`;
  openModal('detailModalOverlay');
};

/* ── Status Modal ── */
window.showStatusModal = function(id) {
  const apt = adminData.find(a => a.id === id);
  if (!apt) return;
  const statuses = ['Menunggu Konfirmasi', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'];
  $('#statusOptions').innerHTML = statuses.map(s => {
    const m = statusMap[s] || {};
    return `<button class="btn ${s === apt.status ? 'btn-primary' : 'btn-outline'}" style="justify-content:flex-start;gap:var(--sp-3)" onclick="updateStatus('${id}','${s}')">
      <span class="badge ${m.cls}" style="min-width:90px;justify-content:center">${m.label}</span>
      ${s === apt.status ? '<span style="font-size:.75rem;opacity:.6">(saat ini)</span>' : ''}
    </button>`;
  }).join('');
  openModal('statusModalOverlay');
};

window.updateStatus = async function(id, status) {
  closeAllModals();
  if (!isConfigured()) {
    const idx = adminData.findIndex(a => a.id === id);
    if (idx !== -1) adminData[idx].status = status;
    renderDashRecent(adminData.slice(0,8));
    renderAptTable(adminFilterData(), adminPage);
    updateSidebarBadge(adminData);
    renderDashStats(adminData);
    toast('success', 'Status Diperbarui', status);
    return;
  }
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (d.success) {
      const idx = adminData.findIndex(a => a.id === id);
      if (idx !== -1) adminData[idx] = d.data;
      renderDashRecent(adminData.slice(0,8));
      renderAptTable(adminFilterData(), adminPage);
      updateSidebarBadge(adminData);
      renderDashStats(adminData);
      toast('success', 'Status Diperbarui', status);
    } else throw new Error(d.message);
  } catch (e) { toast('error', 'Gagal memperbarui status', e.message); }
};

window.deleteAppointment = async function(id) {
  if (!confirm('Hapus janji temu ini? Tindakan ini tidak dapat dibatalkan.')) return;
  if (!isConfigured()) {
    adminData = adminData.filter(a => a.id !== id);
    renderAptTable(adminFilterData(), adminPage);
    updateSidebarBadge(adminData);
    renderDashStats(adminData);
    toast('success', 'Dihapus');
    return;
  }
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/appointments/${id}`, {
      method: 'DELETE', headers: { 'x-admin-token': adminToken },
    });
    const d = await r.json();
    if (d.success) {
      adminData = adminData.filter(a => a.id !== id);
      renderAptTable(adminFilterData(), adminPage);
      updateSidebarBadge(adminData);
      renderDashStats(adminData);
      toast('success', 'Dihapus');
    } else throw new Error(d.message);
  } catch (e) { toast('error', 'Gagal menghapus', e.message); }
};

window.resendWA = async function(id) {
  if (!isConfigured()) { toast('info', 'Demo Mode', 'Fitur WA hanya tersedia setelah Supabase dikonfigurasi'); return; }
  toast('info', 'Mengirim...', 'Notifikasi WhatsApp sedang dikirim');
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/whatsapp-send`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ appointmentId: id }),
    });
    const d = await r.json();
    if (d.data?.sent) toast('success', 'WA Terkirim', 'Notifikasi berhasil dikirim ke WhatsApp tujuan');
    else toast('warning', 'WA Gagal', d.data?.error || 'Periksa konfigurasi API');
  } catch (e) { toast('error', 'Error', e.message); }
};

/* ── Reports ── */
let reportData = [];

async function loadReport(period) {
  const start = $('#reportStart')?.value;
  const end   = $('#reportEnd')?.value;

  let data = [];
  if (!isConfigured()) {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(); monthStart.setDate(1);
    data = DUMMY_APPOINTMENTS.filter(a => {
      const d = new Date(a.tanggal);
      if (period === 'week')  return d >= weekStart;
      if (period === 'month') return d >= monthStart;
      if (period === 'custom') return a.tanggal >= (start||today) && a.tanggal <= (end||today);
      return true;
    });
  } else {
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom' && start && end) { params.set('start', start); params.set('end', end); }
      const r = await fetch(`${CONFIG.FN_BASE}/reports?${params}`, { headers: { 'x-admin-token': adminToken } });
      const d = await r.json();
      if (!d.success) throw new Error(d.message);
      data = d.data || [];
    } catch (e) { toast('error', 'Gagal memuat laporan', e.message); return; }
  }

  reportData = data;
  $('#rs-total').textContent     = data.length;
  $('#rs-selesai').textContent   = data.filter(r => r.status === 'Selesai').length;
  $('#rs-konfirmasi').textContent = data.filter(r => r.status === 'Dikonfirmasi').length;
  $('#rs-menunggu').textContent  = data.filter(r => r.status === 'Menunggu Konfirmasi').length;
  $('#rs-batal').textContent     = data.filter(r => r.status === 'Dibatalkan').length;

  $('#reportTableBody').innerHTML = data.length ? data.map(a => `<tr>
    <td style="font-family:var(--f-mono);font-weight:700">${sanitizeText(a.nomor_antrian)}</td>
    <td>${sanitizeText(a.nama_lengkap)}</td>
    <td>${sanitizeText(a.nomor_wa)}</td>
    <td>${sanitizeText(a.instansi||'-')}</td>
    <td>${sanitizeText(a.tujuan_bertemu)}</td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitizeText(a.keperluan)}</td>
    <td>${sanitizeText(formatDateShort(a.tanggal))}</td>
    <td>${sanitizeText((a.jam||'').slice(0,5))}</td>
    <td>${statusBadge(a.status)}</td>
    <td>${sanitizeText(formatDateTime(a.created_at))}</td>
  </tr>`).join('')
  : '<tr><td colspan="10" style="text-align:center;color:var(--c-text-3);padding:var(--sp-8)">Tidak ada data untuk periode ini</td></tr>';
}

function downloadReport(format) {
  if (!reportData.length) { toast('warning', 'Tidak ada data', 'Muat laporan terlebih dahulu'); return; }
  if (format === 'xlsx' && window.XLSX) {
    const rows = reportData.map(a => ({
      'Nomor Antrian': a.nomor_antrian, 'Nama Lengkap': a.nama_lengkap,
      'WhatsApp': a.nomor_wa, 'Instansi': a.instansi || '-',
      'Tujuan Bertemu': a.tujuan_bertemu, 'Keperluan': a.keperluan,
      'Tanggal': a.tanggal, 'Jam': (a.jam||'').slice(0,5),
      'Status': a.status, 'Diajukan': formatDateTime(a.created_at),
    }));
    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Janji Temu');
    const label = $$('.report-period-btn.active')[0]?.textContent?.trim() || 'periode';
    XLSX.writeFile(wb, `Laporan_Janji_SMAN1_BELIMBING_${label.replace(/\s+/g,'_')}.xlsx`);
    toast('success', 'Berhasil diunduh', 'File Excel tersimpan');
  } else if (format === 'csv') {
    const header = 'No Antrian,Nama,WA,Instansi,Tujuan,Keperluan,Tanggal,Jam,Status,Diajukan\n';
    const rows   = reportData.map(a =>
      [a.nomor_antrian, a.nama_lengkap, a.nomor_wa, a.instansi||'-', a.tujuan_bertemu, `"${(a.keperluan||'').replace(/"/g,'""')}"`, a.tanggal, (a.jam||'').slice(0,5), a.status, formatDateTime(a.created_at)].join(',')
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `Laporan_Janji_SMAN1_BELIMBING.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('success', 'Berhasil diunduh', 'File CSV tersimpan');
  }
}

/* ── Settings ── */
async function loadSettings() {
  if (!isConfigured()) {
    // Demo defaults
    const targets = [
      'Kepala Sekolah','Wakil Kepala Sekolah','Kepala Kurikulum','Guru BK','Wali Kelas',
      'Guru Mata Pelajaran','Tata Usaha','Bendahara','Operator Sekolah','Komite Sekolah','Lainnya',
    ].map(r => ({ role: r, phone_number: '6282382734762', is_active: true }));
    renderWATargets(targets);
    return;
  }
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'getSettings', token: adminToken }),
    });
    const d = await r.json();
    if (!d.success) return;
    const sm = {};
    (d.settings||[]).forEach(s => sm[s.key] = s.value);
    if ($('#settingApiKey'))       $('#settingApiKey').value       = sm['wa_api_key']       || '';
    if ($('#settingSessionId'))    $('#settingSessionId').value    = sm['wa_session_id']    || '';
    if ($('#settingDefaultNumber')) $('#settingDefaultNumber').value = sm['wa_default_number'] || '';
    renderWATargets(d.targets || []);
  } catch {}
}

function renderWATargets(targets) {
  const body = $('#waTargetsBody');
  if (!body) return;
  body.innerHTML = targets.map(t => `<tr>
    <td style="font-weight:600">${sanitizeText(t.role)}</td>
    <td><input type="tel" class="wa-target-input" data-role="${sanitizeText(t.role)}" value="${sanitizeText(t.phone_number)}" placeholder="6281234567890" style="max-width:220px;padding:var(--sp-2) var(--sp-3)"></td>
    <td><input type="checkbox" class="wa-target-active" data-role="${sanitizeText(t.role)}" ${t.is_active ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer"></td>
  </tr>`).join('');
}

async function saveWAConfig() {
  const settings = [
    { key:'wa_api_key',        value: $('#settingApiKey')?.value?.trim()         || '' },
    { key:'wa_session_id',     value: $('#settingSessionId')?.value?.trim()      || '' },
    { key:'wa_default_number', value: $('#settingDefaultNumber')?.value?.replace(/\D/g,'') || '' },
  ];
  if (!isConfigured()) { toast('success', 'Disimpan (Demo)', 'Konfigurasi WA berhasil disimpan'); return; }
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateSettings', token:adminToken, settings }),
    });
    const d = await r.json();
    if (d.success) toast('success', 'Disimpan', d.message);
    else throw new Error(d.message);
  } catch (e) { toast('error', 'Gagal menyimpan', e.message); }
}

async function saveWATargets() {
  const inputs  = $$('.wa-target-input');
  const checks  = $$('.wa-target-active');
  const targets = inputs.map(inp => ({
    role:         inp.dataset.role,
    phone_number: inp.value.replace(/\D/g,''),
    is_active:    document.querySelector(`.wa-target-active[data-role="${inp.dataset.role}"]`)?.checked ?? true,
  }));
  if (!isConfigured()) { toast('success', 'Disimpan (Demo)', 'Nomor tujuan berhasil disimpan'); return; }
  try {
    const r = await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateSettings', token:adminToken, targets }),
    });
    const d = await r.json();
    if (d.success) toast('success', 'Nomor Disimpan', 'Semua nomor WA tujuan berhasil diperbarui');
    else throw new Error(d.message);
  } catch (e) { toast('error', 'Gagal menyimpan', e.message); }
}

/* ── Password Reset ── */
async function doResetPassword() {
  const cur  = $('#currentPassword')?.value;
  const nw   = $('#newPassword')?.value;
  const conf = $('#confirmPassword')?.value;

  $$('#err-currentPassword,#err-newPassword,#err-confirmPassword').forEach(e => e.textContent = '');

  let valid = true;
  if (!cur)  { setError('currentPassword', 'Password saat ini wajib diisi'); valid = false; }
  if (!nw || nw.length < 8) { setError('newPassword', 'Password baru minimal 8 karakter'); valid = false; }
  if (nw !== conf) { setError('confirmPassword', 'Konfirmasi password tidak sesuai'); valid = false; }
  if (!valid) return;

  const btn = $('#btnResetPassword');
  btn.disabled = true;
  $('#resetBtnText').textContent = 'Menyimpan...';

  if (!isConfigured()) {
    await new Promise(r => setTimeout(r, 800));
    toast('success', 'Password Berhasil Diubah (Demo)');
    $$('#currentPassword, #newPassword, #confirmPassword').forEach(i => i.value = '');
    $('#pwStrengthWrap').style.display = 'none';
    btn.disabled = false;
    $('#resetBtnText').textContent = 'Simpan Password';
    return;
  }

  try {
    const r = await fetch(`${CONFIG.FN_BASE}/admin-auth`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'reset', token:adminToken, currentPassword:cur, newPassword:nw }),
    });
    const d = await r.json();
    if (d.success) {
      toast('success', 'Password Diperbarui', d.message);
      $$('#currentPassword, #newPassword, #confirmPassword').forEach(i => i.value = '');
      $('#pwStrengthWrap').style.display = 'none';
    } else {
      if (d.message?.includes('saat ini')) setError('currentPassword', d.message);
      else setError('newPassword', d.message || 'Gagal memperbarui password');
      toast('error', 'Gagal', d.message);
    }
  } catch (e) { toast('error', 'Error', e.message); }

  btn.disabled = false;
  $('#resetBtnText').textContent = 'Simpan Password';
}

/* ── Logs ── */
async function loadLogs() {
  const body = $('#logsBody');
  if (!body) return;
  if (!isConfigured()) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--c-text-3);padding:var(--sp-8)">Log tersedia setelah Supabase dikonfigurasi</td></tr>`;
    return;
  }
  try {
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
    const rows = data || [];
    body.innerHTML = rows.length ? rows.map(l => `<tr>
      <td style="white-space:nowrap;font-size:.8125rem;color:var(--c-text-3)">${formatDateTime(l.created_at)}</td>
      <td><span class="badge badge-confirmed" style="font-size:.6875rem">${sanitizeText(l.action)}</span></td>
      <td style="font-size:.8125rem;max-width:300px">${sanitizeText(typeof l.details === 'object' ? JSON.stringify(l.details) : l.details)}</td>
      <td style="font-size:.8125rem;color:var(--c-text-3)">${sanitizeText(l.ip_address||'-')}</td>
    </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--c-text-3);padding:var(--sp-8)">Belum ada log aktivitas</td></tr>';
  } catch (e) { toast('error', 'Gagal memuat log', e.message); }
}

/* ── Realtime Admin ── */
function initAdminRealtime() {
  if (!isConfigured()) return;
  supabase.channel('admin-appointments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async (payload) => {
      if (payload.eventType === 'INSERT') {
        adminData.unshift(payload.new);
        toast('info', 'Janji Baru Masuk!', `${payload.new.nama_lengkap} — ${payload.new.nomor_antrian}`);
      } else if (payload.eventType === 'UPDATE') {
        const idx = adminData.findIndex(a => a.id === payload.new.id);
        if (idx !== -1) adminData[idx] = payload.new;
      } else if (payload.eventType === 'DELETE') {
        adminData = adminData.filter(a => a.id !== payload.old.id);
      }
      renderDashStats(adminData);
      renderDashChart(adminData);
      renderDashRecent(adminData.slice(0,8));
      renderAptTable(adminFilterData(), adminPage);
      updateSidebarBadge(adminData);
    })
    .subscribe((status) => {
      const badge = $('#rtBadge');
      if (badge) badge.style.opacity = status === 'SUBSCRIBED' ? '1' : '0.5';
    });
}

/* ── Modal Helpers ── */
function openModal(id) {
  const overlay = $(`#${id}`);
  if (overlay) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeAllModals() {
  $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
}

$('#detailModalClose')?.addEventListener('click', closeAllModals);
$('#statusModalClose')?.addEventListener('click', closeAllModals);
$$('.modal-overlay').forEach(o => o.addEventListener('click', (e) => { if (e.target === o) closeAllModals(); }));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

/* ═══════════════════════════════════════════
   INIT — per page
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();

  if (window.__ADMIN_PAGE__) {
    initAdminPage();
    return;
  }

  if (window.__DAFTAR_PAGE__) {
    initDaftarJanji();
    return;
  }

  // Index page
  initIntro();

  // These run after intro exits
  const form = $('#appointmentForm');
  if (form) {
    initCustomSelect();
    initFileUpload();
    initDateConstraints();
    initCharCounter();
    initFAQ();
    initTicket();
    form.addEventListener('submit', handleFormSubmit);

    // Real-time input validation
    $$('#namaLengkap, #nomorWA, #keperluan, #tanggal, #jam').forEach(input => {
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          clearError(input.id);
        }
      });
    });
  }
});

window.switchTab = switchTab;
