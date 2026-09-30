import {
  BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Points, PointsMaterial, Scene, TorusGeometry, WebGLRenderer,
} from 'three';

export function createLoginScene(host) {
  const compact = window.matchMedia('(max-width: 640px)').matches;
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;opacity:.65';
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 9;
  const group = new Group();
  scene.add(group);
  const positions = [];
  for (let i = 0; i < (compact ? 45 : 100); i++) {
    positions.push((Math.random() - .5) * 18, (Math.random() - .5) * 12, (Math.random() - .5) * 5);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: '#d8f7ff', size: .035, transparent: true, opacity: .6, depthWrite: false });
  group.add(new Points(geometry, material));
  const orbitGeometry = new TorusGeometry(2.5, .009, 4, 80);
  const orbitMaterial = new MeshBasicMaterial({ color: '#b7ecff', transparent: true, opacity: .22, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const orbit = new Mesh(orbitGeometry, orbitMaterial);
    orbit.position.x = i === 1 ? 4 : -4;
    orbit.rotation.set(.5 + i * .6, .4 + i * .5, i);
    group.add(orbit);
  }
  let lost = false;
  let disposed = false;
  let lastFrame = 0;
  let elapsed = 0;
  let targetX = 0;
  let targetY = 0;
  const interval = 1000 / (compact ? 24 : 30);
  function render(time) {
    if (time - lastFrame < interval) return;
    elapsed += Math.min((time - lastFrame) / 1000, .05);
    lastFrame = time;
    group.rotation.y += (targetX * .12 - group.rotation.y) * .04;
    group.rotation.x += (targetY * .08 - group.rotation.x) * .04;
    group.position.y = Math.sin(elapsed * .3) * .12;
    group.rotation.z = Math.sin(elapsed * .12) * .035;
    renderer.render(scene, camera);
  }
  function visibility() {
    lastFrame = 0;
    renderer.setAnimationLoop(document.hidden || lost ? null : render);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    camera.aspect = Math.max(width, 1) / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
  }
  function pointer(event) {
    targetX = event.clientX / window.innerWidth * 2 - 1;
    targetY = event.clientY / window.innerHeight * 2 - 1;
  }
  function contextLost(event) {
    event.preventDefault();
    lost = true;
    renderer.domElement.style.opacity = '0';
    visibility();
  }
  function contextRestored() {
    lost = false;
    renderer.domElement.style.opacity = '.65';
    resize();
    visibility();
  }
  host.appendChild(renderer.domElement);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener('pointermove', pointer, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
  resize();
  visibility();
  return () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('pointermove', pointer);
    document.removeEventListener('visibilitychange', visibility);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
    geometry.dispose();
    material.dispose();
    orbitGeometry.dispose();
    orbitMaterial.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
