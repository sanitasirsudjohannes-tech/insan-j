import {
  BufferGeometry, Float32BufferAttribute, Group,
  PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer,
} from 'three';

export function createLoginScene(host) {
  const compact = window.matchMedia('(max-width: 640px)').matches;
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;opacity:1';
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 9;
  const group = new Group();
  scene.add(group);
  // One draw call, no textures, lighting, models or post-processing.
  const positions = [];
  const phases = [];
  const tones = [];
  const count = compact ? 96 : 130;
  for (let i = 0; i < count; i++) {
    const phase = i * 2.399963;
    positions.push((Math.random() - .5) * 1.8, (Math.random() - .5) * 1.8, (Math.random() - .5) * 3);
    phases.push(phase);
    tones.push(i % 3 / 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new Float32BufferAttribute(phases, 1));
  geometry.setAttribute('tone', new Float32BufferAttribute(tones, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: renderer.getPixelRatio() },
      viewport: { value: [1, 1] },
    },
    vertexShader: `
      uniform float time;
      uniform float pixelRatio;
      uniform vec2 viewport;
      attribute float phase;
      attribute float tone;
      varying float vTone;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        // Fit every depth layer to the actual viewport, including narrow phones.
        float halfHeight = (9.0 - p.z) * 0.41421356;
        p.xy *= vec2(halfHeight * viewport.x / viewport.y, halfHeight);
        // Two gentle currents suggest water ripples and drifting air.
        p.x += sin(time * 0.3 + phase) * 0.22;
        p.y += sin(p.x * 0.65 + time * 0.4 + phase) * 0.3;
        p.z += cos(time * 0.12 + phase) * 0.15;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((40.0 + tone * 12.0) / -view.z, 3.5, 6.0) * pixelRatio;
        vTone = tone;
        vAlpha = 0.65 + 0.12 * sin(time * 0.3 + phase);
      }
    `,
    fragmentShader: `
      varying float vTone;
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float alpha = (1.0 - smoothstep(0.25, 0.5, radius)) * vAlpha;
        vec3 color = mix(vec3(0.72, 0.90, 1.0), vec3(0.65, 1.0, 0.83), vTone);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  group.add(new Points(geometry, material));
  let lost = false;
  let disposed = false;
  let lastFrame = 0;
  let elapsed = 0;
  let targetX = 0;
  let targetY = 0;
  const interval = 1000 / (compact ? 20 : 24);
  function render(time) {
    if (time - lastFrame < interval) return;
    elapsed += Math.min((time - lastFrame) / 1000, .05);
    lastFrame = time;
    material.uniforms.time.value = elapsed;
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
    material.uniforms.viewport.value = [Math.max(width, 1), Math.max(height, 1)];
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
    renderer.domElement.style.opacity = '1';
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
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
