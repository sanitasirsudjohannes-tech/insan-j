import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, WebGLRenderer } from 'three';

// A single shaded plane: no assets, lights, textures or post-processing.
export function createWelcomeWave(host) {
  const renderer = new WebGLRenderer({ alpha:true, antialias:false, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 2;
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    transparent:true, depthWrite:false,
    uniforms:{ time:{ value:0 } },
    vertexShader:`varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float time; varying vec2 vUv;
      void main(){
        float x=vUv.x;
        float a=0.25+0.08*sin(x*6.0+time*0.5);
        float b=0.18+0.07*sin(x*7.0-time*0.4+1.4);
        float c=0.10+0.05*sin(x*5.0+time*0.35+2.0);
        float wa=1.0-smoothstep(a-0.008,a+0.008,vUv.y);
        float wb=1.0-smoothstep(b-0.008,b+0.008,vUv.y);
        float wc=1.0-smoothstep(c-0.008,c+0.008,vUv.y);
        vec3 color=mix(vec3(0.48,0.79,0.94),vec3(0.25,0.72,0.76),wb*0.7);
        color=mix(color,vec3(0.38,0.82,0.73),wc*0.65);
        gl_FragColor=vec4(color,wa*0.55+wb*0.12+wc*0.12);
      }`,
  });
  scene.add(new Mesh(geometry, material));
  let disposed=false;
  let lost=false;
  let last=0;
  let elapsed=0;
  let visible=true;
  const interval=1000/20;
  function render(time){
    if(time-last<interval) return;
    elapsed+=last ? Math.min((time-last)/1000,.1) : 0;
    last=time;
    material.uniforms.time.value=elapsed;
    renderer.render(scene,camera);
  }
  function update(){
    last=0;
    renderer.setAnimationLoop(document.hidden || !visible || lost ? null : render);
  }
  function resize(){
    const rect=host.getBoundingClientRect();
    renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);
    if(!lost) renderer.render(scene,camera);
  }
  function onLost(event){ event.preventDefault(); lost=true; delete host.dataset.ready; update(); }
  function onRestored(){ lost=false; host.dataset.ready='true'; resize(); update(); }
  host.appendChild(renderer.domElement);
  host.dataset.ready='true';
  const sizeObserver=new ResizeObserver(resize);
  const visibilityObserver=new IntersectionObserver(entries=>{ visible=entries[0].isIntersecting; update(); });
  sizeObserver.observe(host);
  visibilityObserver.observe(host);
  document.addEventListener('visibilitychange',update);
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  renderer.domElement.addEventListener('webglcontextrestored',onRestored);
  resize(); update();
  return ()=>{
    if(disposed) return;
    disposed=true;
    renderer.setAnimationLoop(null);
    sizeObserver.disconnect(); visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange',update);
    renderer.domElement.removeEventListener('webglcontextlost',onLost);
    renderer.domElement.removeEventListener('webglcontextrestored',onRestored);
    geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss();
    renderer.domElement.remove(); delete host.dataset.ready;
  };
}
