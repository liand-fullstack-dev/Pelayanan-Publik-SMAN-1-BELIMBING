/* ============================================================
   SMAN 1 BELIMBING — Intro & site motion
   GSAP (timeline orchestration) + Three.js (ambient backdrop)
   + Lenis (smooth scroll) on the main site.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------
   1. THREE.JS — low-poly "belimbing star" ambient backdrop
--------------------------------------------------------- */
function initStarScene(canvas) {
  if (!window.THREE || reduceMotion || !canvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  const points = 5;
  const outerR = 2.4, innerR = 1;
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 });
  const material = new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.35, roughness: 0.4, transparent: true, opacity: 0.16 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const wireGeo = new THREE.EdgesGeometry(geometry);
  const wireMat = new THREE.LineBasicMaterial({ color: 0xf5f3ff, transparent: true, opacity: 0.2 });
  mesh.add(new THREE.LineSegments(wireGeo, wireMat));

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const point = new THREE.PointLight(0xf7d564, 1.2, 20);
  point.position.set(4, 4, 6);
  scene.add(point);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let raf;
  function tick(t) {
    mesh.rotation.z = t * 0.00012;
    mesh.rotation.x = Math.sin(t * 0.00008) * 0.25;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    }
  };
}

/* ---------------------------------------------------------
   2. GSAP — intro timeline
--------------------------------------------------------- */
function initIntroTimeline(starScene) {
  const introEl = document.getElementById('intro');
  const progressFill = document.getElementById('progress-fill');
  const logoImg = document.getElementById('school-logo-intro');
  const hasRealLogo = logoImg && logoImg.dataset.missing !== '1';

  function finishIntro(skipped) {
    if (!window.gsap) {
      introEl.style.display = 'none';
      document.body.style.overflow = '';
      startSite();
      return;
    }
    gsap.to(introEl, {
      autoAlpha: 0,
      duration: skipped ? 0.4 : 0.6,
      ease: 'power2.inOut',
      onComplete: () => {
        introEl.classList.add('is-done');
        introEl.style.display = 'none';
        document.body.style.overflow = '';
        if (starScene) starScene.stop();
        startSite();
      }
    });
  }

  document.body.style.overflow = 'hidden';

  const alreadySeen = sessionStorage.getItem('intro-seen') === '1';
  sessionStorage.setItem('intro-seen', '1');

  if (!window.gsap || reduceMotion || alreadySeen) {
    finishIntro(true);
    return { skip: () => {} };
  }

  const shieldPath = document.getElementById('shield-path');
  const starPath = document.getElementById('star-path');
  [shieldPath, starPath].forEach(p => {
    if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onUpdate: () => { if (progressFill) progressFill.style.width = (tl.progress() * 100) + '%'; },
    onComplete: () => finishIntro(false)
  });

  tl.to('.eyebrow-row', { opacity: 1, duration: 0.35 }, 0.05)
    .to(shieldPath, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1)
    .to(starPath, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' }, 0.4);

  if (hasRealLogo) {
    tl.to('#school-logo-intro', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.5)' }, 0.6)
      .to('#emblem-svg', { opacity: 0, duration: 0.3 }, 0.6);
  }

  tl.to('.title-line .word', { y: 0, duration: 0.6, stagger: 0.08, ease: 'power4.out' }, 0.85)
    .to('.tagline', { opacity: 1, y: 0, duration: 0.4 }, 1.25)
    .to({}, { duration: 0.45 });

  return { skip: () => { tl.kill(); finishIntro(true); } };
}

/* ---------------------------------------------------------
   3. Lenis smooth scroll + GSAP scroll reveals for the site
--------------------------------------------------------- */
function startSite() {
  const revealTargets = document.querySelectorAll('.hero, .panel, .alur, .form-section, .faq');

  if (window.Lenis && !reduceMotion) {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (window.gsap && window.gsap.ticker) {
      gsap.ticker.add((time) => lenis.raf(time * 1000));
    }
  }

  if (window.gsap && window.IntersectionObserver) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const targets = entry.target.querySelectorAll('.section-tag, .section-title, .section-desc, .alur-card, .form-group, .faq-item');
          gsap.to(targets, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealTargets.forEach(section => {
      const targets = section.querySelectorAll('.section-tag, .section-title, .section-desc, .alur-card, .form-group, .faq-item');
      if (targets.length) {
        gsap.set(targets, { opacity: 0, y: 20 });
        io.observe(section);
      }
    });
  }
}

/* ---------------------------------------------------------
   4. Boot
--------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  const starScene = initStarScene(document.getElementById('star-canvas'));
  const intro = initIntroTimeline(starScene);
  const skipBtn = document.getElementById('skip-intro');
  if (skipBtn) skipBtn.addEventListener('click', () => intro.skip());
});
