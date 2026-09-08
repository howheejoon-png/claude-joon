/**
 * "From plan to place" — the Three.js experience.
 *
 * Concept: a floor plan is drawn as lines on paper, then rises into walls,
 * then furniture volumes appear, then the light is switched on. The camera
 * travels from a top-down drawing view to eye level inside the home.
 * It visualises what a design-and-build studio actually does: turns a drawing
 * into a place. Scroll progress (0–1) drives everything; nothing loops idly.
 *
 * Performance: lazy-loaded, DPR-capped, renders only while visible and only
 * when something changed, disposes on teardown, honours reduced motion.
 */
import * as THREE from 'three';

const PAPER = 0xf3f3f1;
const SIGNAL = 0x2743d9;

// ---- Plan data (units ≈ metres). Easily swapped for another layout. ----
const W = 10, D = 7, H = 2.6, T = 0.12;
// Wall segments: [x1, z1, x2, z2]. Gaps in exterior/interior walls are doors.
const WALLS = [
  // exterior (with entrance gap on the south wall and a window gap on the north wall)
  [-5, -3.5, 5, -3.5],       // north
  [5, -3.5, 5, 3.5],         // east
  [5, 3.5, 1.2, 3.5], [0.2, 3.5, -5, 3.5], // south with door gap
  [-5, 3.5, -5, -3.5],       // west
  // interior
  [-1.2, -3.5, -1.2, -0.4],  // kitchen / living divider (north part)
  [-1.2, 0.6, -1.2, 1.4],    // short return
  [-5, 0.2, -3.2, 0.2], [-2.2, 0.2, -1.2, 0.2], // bedroom 1 wall with door
  [1.6, -3.5, 1.6, -1.8], [1.6, -0.8, 1.6, 0.4], // bedroom 2 wall with door
  [1.6, 0.4, 5, 0.4],        // bedroom 2 / bath divider
  [3.2, 0.4, 3.2, 1.6],      // bath wall with door
  [3.2, 2.6, 3.2, 3.5],
];
// Furniture volumes: [x, z, w, d, h, label]
const FURNITURE = [
  [-0.2, 2.0, 2.4, 0.9, 0.7],   // sofa
  [-0.2, 0.9, 1.0, 0.6, 0.35],  // coffee table
  [0.2, -2.0, 1.6, 0.9, 0.75],  // dining table
  [-3.0, -2.3, 0.6, 2.4, 0.9],  // kitchen counter (west wall)
  [-2.5, -3.3, 2.0, 0.4, 0.9],  // kitchen run (north)
  [-3.6, 2.2, 1.6, 2.0, 0.5],   // bed 1
  [-4.75, 0.9, 0.5, 1.4, 2.2],  // wardrobe 1
  [3.3, -2.2, 1.5, 1.9, 0.5],   // bed 2
  [4.75, -0.4, 0.5, 1.5, 2.2],  // wardrobe 2
  [4.1, 2.0, 1.2, 0.6, 0.8],    // vanity
];
// Window openings drawn as glowing panes: [x, z, width, rotationY]
const WINDOWS = [
  [-0.5, -3.5, 2.6, 0],   // living/dining north window
  [3.3, -3.5, 1.6, 0],    // bedroom 2 window
];

// Progress 0–0.2 = section scrolling into view (plan draws itself), 0.2–1 = pinned steps.
const CAM_KEYS = [
  // Progress: 0–0.25 section enters (plan draws) · 0.25 Conversation · 0.5 Design · 0.75 Build · 1.0 Handover
  // Keys are interpolated in polar coordinates around the look target (a smooth orbit, no spinning).
  { t: 0.00, pos: [0.0, 19, 0.02], look: [0, 0, 0], fov: 38 },
  { t: 0.40, pos: [0.0, 16, 0.02], look: [0, 0, 0], fov: 38 },
  { t: 0.62, pos: [8.5, 12, 10], look: [0, 0.4, 0], fov: 36 },
  { t: 0.80, pos: [9.5, 4.6, 9.0], look: [-0.5, 0.9, -0.5], fov: 34 },
  { t: 1.00, pos: [7.6, 5.2, 8.6], look: [-0.8, 0.3, -0.8], fov: 40 },
];

const toPolar = (pos, look) => { const dx = pos[0] - look[0], dy = pos[1] - look[1], dz = pos[2] - look[2]; const r = Math.hypot(dx, dy, dz); return { r, az: Math.atan2(dx, dz), el: Math.asin(dy / r) }; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createPlanScene(container, { onReady, onFail } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { onFail?.(e); return null; }

  const isMobile = window.matchMedia('(max-width: 899px)').matches;
  let portrait = container.clientHeight > container.clientWidth;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;
  renderer.localClippingEnabled = true;
  // Cut-away plane: in the last phase the walls are sliced to waist height so the finished home reads as a model
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), H + 0.1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const root = new THREE.Group();
  scene.add(root);
  const modelShift = () => { root.position.x = portrait ? 0 : 1.6; };
  modelShift();

  // Fog fades far edges into the section background
  scene.fog = new THREE.Fog(0x0f0f0f, 22, 70);

  // ---- Floor + drawing grid ----
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.005;
  root.add(floor);
  const grid = new THREE.GridHelper(40, 40, PAPER, PAPER);
  grid.material.transparent = true; grid.material.opacity = 0.06; grid.position.y = -0.01;
  root.add(grid);

  // ---- Plan lines (phase 1) ----
  const lineMat = new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: 0.9 });
  const planLines = WALLS.map(([x1, z1, x2, z2]) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(len, 0, 0)]);
    const line = new THREE.Line(g, lineMat);
    const holder = new THREE.Group();
    holder.position.set(x1, 0.012, z1);
    holder.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    holder.scale.x = 0.0001;
    holder.add(line);
    root.add(holder);
    return holder;
  });

  // ---- Walls (phase 2) ----
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x46464a, roughness: 0.92, metalness: 0, clippingPlanes: [cutPlane] });
  const edgeMat = new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: 0.55, clippingPlanes: [cutPlane] });
  const walls = WALLS.map(([x1, z1, x2, z2]) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const geo = new THREE.BoxGeometry(len + T, H, T);
    geo.translate(0, H / 2, 0);
    const mesh = new THREE.Mesh(geo, wallMat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    const holder = new THREE.Group();
    holder.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    holder.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    holder.scale.y = 0.0001;
    holder.add(mesh, edges);
    root.add(holder);
    return holder;
  });

  // ---- Furniture (phase 3) ----
  const furnMat = new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 0.85, metalness: 0, clippingPlanes: [cutPlane] });
  const furnEdge = new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: 0.35, clippingPlanes: [cutPlane] });
  const furniture = FURNITURE.map(([x, z, w, d, h]) => {
    const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, furnMat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), furnEdge);
    const holder = new THREE.Group(); holder.position.set(x, 0, z); holder.scale.y = 0.0001;
    holder.add(mesh, edges); root.add(holder); return holder;
  });

  // ---- Windows + light (phase 4) ----
  const paneMat = new THREE.MeshBasicMaterial({ color: 0xf6e7c9, transparent: true, opacity: 0, clippingPlanes: [cutPlane] });
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xf6e7c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  WINDOWS.forEach(([x, z, w, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), paneMat);
    m.position.set(x, 1.55, z + 0.002); m.rotation.y = ry; root.add(m);
    // daylight pool on the floor in front of the window
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, 2.2), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.006, z + 1.15); root.add(pool);
  });
  const ambient = new THREE.AmbientLight(0xffffff, 0.55); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-6, 12, 4); scene.add(key);
  const warm = new THREE.PointLight(0xffd7a8, 0, 12, 1.6); warm.position.set(0, 2.2, 0.5); root.add(warm);
  const glow = new THREE.PointLight(0xf6e7c9, 0, 10, 2); glow.position.set(-0.5, 1.6, -2.8); root.add(glow);

  // Accent: a "markup" dot at the entrance — the red pen on the drawing
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0 }));
  dot.rotation.x = -Math.PI / 2; dot.position.set(0.7, 0.02, 3.5); root.add(dot);

  // ---- State ----
  let target = 0, progress = 0, dirty = true, running = false, raf = 0, disposed = false;
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  function apply(p) {
    // Phase 1 (0 → 0.2, while the section scrolls in): the plan draws itself, line by line
    planLines.forEach((h, i) => {
      h.scale.x = Math.max(0.0001, smooth(0.0 + i * 0.007, 0.14 + i * 0.007, p));
    });
    dot.material.opacity = smooth(0.26, 0.32, p) * (1 - smooth(0.86, 0.95, p) * 0.7);
    // Phase 2 (Design): walls rise
    walls.forEach((h, i) => { const s = smooth(0.5 + i * 0.008, 0.64 + i * 0.008, p); h.visible = s > 0.001; h.scale.y = Math.max(0.0001, s); });
    lineMat.opacity = 0.9 - 0.6 * smooth(0.56, 0.72, p);
    // Phase 3 (Build): furniture volumes
    furniture.forEach((h, i) => { const s = smooth(0.68 + i * 0.01, 0.8 + i * 0.01, p); h.visible = s > 0.001; h.scale.y = Math.max(0.0001, s); });
    // Phase 4 (Handover): the light comes on
    const l = smooth(0.86, 0.98, p);
    paneMat.opacity = 0.9 * l;
    poolMat.opacity = 0.16 * l;
    cutPlane.constant = lerp(H + 0.1, 0.95, smooth(0.84, 0.97, p));
    warm.intensity = 60 * l;
    glow.intensity = 30 * l;
    ambient.intensity = 0.55 + 0.2 * l;
    edgeMat.opacity = 0.55 - 0.35 * l;
    furnEdge.opacity = 0.35 - 0.2 * l;
    grid.material.opacity = 0.06 * (1 - l * 0.8);

    // Camera along keyframes
    let a = CAM_KEYS[0], b = CAM_KEYS[CAM_KEYS.length - 1];
    for (let i = 0; i < CAM_KEYS.length - 1; i++) if (p >= CAM_KEYS[i].t && p <= CAM_KEYS[i + 1].t) { a = CAM_KEYS[i]; b = CAM_KEYS[i + 1]; }
    const t = smooth(a.t, b.t, p);
    const pa = toPolar(a.pos, a.look), pb = toPolar(b.pos, b.look);
    camLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    const r = lerp(pa.r, pb.r, t) * (portrait ? 2.15 : 1), az = lerp(pa.az, pb.az, t), el = lerp(pa.el, pb.el, t);
    camPos.set(camLook.x + r * Math.cos(el) * Math.sin(az), camLook.y + r * Math.sin(el), camLook.z + r * Math.cos(el) * Math.cos(az));
    camera.fov = lerp(a.fov, b.fov, t); camera.updateProjectionMatrix();
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // Subtle pointer parallax on the model (desktop only)
    root.rotation.y = mx * 0.05;
    root.rotation.x = my * 0.02;
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    portrait = h > w; modelShift();
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(container);
  resize();

  function frame() {
    if (disposed || !running) return;
    raf = requestAnimationFrame(frame);
    const dp = target - progress;
    const dm = Math.abs(tmx - mx) + Math.abs(tmy - my);
    if (Math.abs(dp) > 0.0004 || dm > 0.001 || dirty) {
      progress += dp * (reduced ? 1 : 0.12);
      mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
      apply(progress);
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  const onPointer = (e) => {
    if (isMobile) return;
    tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  apply(0); renderer.render(scene, camera);
  onReady?.();

  return {
    setProgress(p) { target = Math.min(1, Math.max(0, p)); if (reduced) { progress = target; dirty = true; } },
    start() { if (running) return; running = true; dirty = true; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() {
      disposed = true; this.stop(); ro.disconnect(); window.removeEventListener('pointermove', onPointer);
      scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
