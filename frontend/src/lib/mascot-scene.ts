import * as THREE from 'three';
import type { MascotSceneHandle, MascotSceneOptions } from '@/types';

/** A lightweight, original workspace rooster. No external models, fonts or textures. */
export function createMascotScene(host: HTMLElement, options: MascotSceneOptions): MascotSceneHandle {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.mascotCanvas = '';
  canvas.style.width = '100%'; canvas.style.height = '100%'; host.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(3.2, 1.8, 7.4); camera.lookAt(0, 0.12, 0);
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  function material(color: number, roughness = 0.65) {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.06 }); materials.add(value); return value;
  }
  function geometry<T extends THREE.BufferGeometry>(value: T): T { geometries.add(value); return value; }
  const sphere = geometry(new THREE.SphereGeometry(1, 28, 20));
  const white = material(0xf3efe8), gold = material(0xe6ad48), red = material(0xcf555b), ink = material(0x24253c), violet = material(0x8174db), paper = material(0xfaf6ef);
  const pedestalMaterial = material(0x252b43);
  function oval(parent: THREE.Object3D, surface: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
    const mesh = new THREE.Mesh(sphere, surface); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  function box(parent: THREE.Object3D, surface: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
    const mesh = new THREE.Mesh(geometry(new THREE.BoxGeometry(...scale)), surface); mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  function folder(surface: THREE.Material) {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.7, -0.43); shape.lineTo(0.7, -0.43); shape.lineTo(0.7, 0.28); shape.lineTo(0.02, 0.28); shape.lineTo(-0.12, 0.44); shape.lineTo(-0.7, 0.44); shape.closePath();
    const mesh = new THREE.Mesh(geometry(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.035, bevelSegments: 3, steps: 1 })), surface);
    group.add(mesh); box(group, paper, [0.06, 0.23, -0.03], [1.13, 0.67, 0.08]);
    box(group, paper, [-0.4, -0.16, 0.18], [0.23, 0.075, 0.02]);
    return group;
  }
  const base = new THREE.Mesh(geometry(new THREE.CylinderGeometry(1.95, 2.02, 0.16, 64)), pedestalMaterial); base.position.y = -1.4; scene.add(base);
  const rooster = new THREE.Group(); rooster.position.x = -0.32; scene.add(rooster);
  const tail = new THREE.Group(); rooster.add(tail);
  [0x6f83cc, 0x8f77cc, 0x439e95, 0x70b6a2].forEach((color, index) => {
    const feather = oval(tail, material(color), [-0.54 - index * 0.13, 0.20 + index * 0.12, -0.28 - index * 0.02], [0.14, 0.62, 0.12]); feather.rotation.z = 0.72 + index * 0.16;
  });
  oval(rooster, white, [0, 0, 0], [0.61, 0.78, 0.46]);
  oval(rooster, white, [0.03, 0.58, 0.04], [0.32, 0.55, 0.3]);
  const head = new THREE.Group(); head.position.set(0.04, 0.95, 0.1); rooster.add(head);
  oval(head, white, [0, 0, 0], [0.43, 0.46, 0.38]);
  [-0.22, 0, 0.21].forEach((x, index) => { const comb = oval(head, red, [x, 0.44 + (index === 1 ? 0.06 : 0), 0], [0.14, index === 1 ? 0.25 : 0.20, 0.105]); comb.rotation.z = -x * 0.8; });
  const eyes = new THREE.Group(); head.add(eyes);
  [-0.19, 0.19].forEach((x) => {
    oval(eyes, paper, [x, 0.08, 0.332], [0.112, 0.14, 0.05]);
    oval(eyes, ink, [x + 0.018, 0.067, 0.379], [0.048, 0.069, 0.025]);
    oval(eyes, paper, [x + 0.028, 0.088, 0.4], [0.014, 0.018, 0.01]);
  });
  const beak = new THREE.Mesh(geometry(new THREE.ConeGeometry(0.145, 0.31, 4)), gold); beak.rotation.x = Math.PI / 2; beak.rotation.z = Math.PI / 4; beak.position.set(0, -0.05, 0.47); head.add(beak);
  oval(head, red, [0, -0.27, 0.28], [0.085, 0.19, 0.09]);
  const leftWing = oval(rooster, white, [-0.55, -0.05, 0.19], [0.18, 0.46, 0.22]); leftWing.rotation.z = 0.4;
  const rightWing = oval(rooster, white, [0.55, -0.02, 0.19], [0.18, 0.46, 0.22]); rightWing.rotation.z = -0.4;
  [-0.25, 0.25].forEach((x) => { box(rooster, gold, [x, -0.96, 0.02], [0.065, 0.4, 0.065]); oval(rooster, gold, [x, -1.19, 0.13], [0.16, 0.07, 0.24]); });
  const heldFolder = folder(violet); heldFolder.position.set(0, -0.16, 0.57); heldFolder.scale.setScalar(0.82); heldFolder.rotation.z = -0.09; rooster.add(heldFolder);
  oval(rooster, white, [-0.48, -0.22, 0.75], [0.12, 0.16, 0.1]); oval(rooster, white, [0.5, -0.17, 0.75], [0.12, 0.16, 0.1]);
  const stack = new THREE.Group(); stack.position.set(1.25, -0.87, -0.05); stack.rotation.y = -0.23; scene.add(stack);
  [material(0xd9ad58), material(0x6e8cce)].forEach((surface, index) => { const item = folder(surface); item.scale.setScalar(0.48); item.position.set(index * 0.1, index * 0.12, -index * 0.14); stack.add(item); });
  // Small irregular cereal flakes rest on the desktop.
  const flakeGeometry = geometry(new THREE.SphereGeometry(1, 14, 10));
  const positions = flakeGeometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) { const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index); const ridge = 1 + 0.11 * Math.sin(x * 9 + y * 5); positions.setXYZ(index, x * ridge, y * 0.28 + 0.08 * Math.sin(z * 7), z * ridge); }
  flakeGeometry.computeVertexNormals();
  [[-1.30, 0.78], [0.85, 0.94], [1.50, 0.54]].forEach(([x, z], index) => { const flake = new THREE.Mesh(flakeGeometry, gold); flake.scale.setScalar(0.13 + index * 0.025); flake.position.set(x, -1.27, z); flake.rotation.y = index * 1.3; scene.add(flake); });
  const ambient = new THREE.HemisphereLight(0xe9edff, 0x535068, 2.3); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffefd9, 3); key.position.set(-3, 5, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8b9ff, 2); fill.position.set(4, 2, -3); scene.add(fill);
  let motion = options.motion, visible = true, disposed = false, lost = false, elapsed = 0, lastTime = 0;
  let targetX = 0, targetY = 0;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const render = () => { if (!disposed && !lost) renderer.render(scene, camera); };
  function frame(time: number) {
    if (time - lastTime < 32) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time; elapsed += delta;
    rooster.position.y = Math.sin(elapsed * 1.2) * 0.028;
    head.rotation.y += (targetX * 0.18 - head.rotation.y) * 0.07;
    head.rotation.x += (targetY * 0.10 + Math.sin(elapsed * 0.65) * 0.018 - head.rotation.x) * 0.07;
    heldFolder.rotation.z = -0.09 + Math.sin(elapsed * 0.85) * 0.025;
    const blink = elapsed % 5;
    eyes.scale.y = blink > 4.78 ? Math.max(0.08, Math.min(1, Math.abs(blink - 4.89) / 0.11)) : 1;
    render();
  }
  function synchronize() {
    if (disposed) return;
    lastTime = 0;
    canvas.dataset.sceneMotion = motion && visible && !document.hidden && !lost ? 'active' : 'paused';
    renderer.setAnimationLoop(motion && visible && !document.hidden && !lost ? frame : null);
    render();
  }
  const resize = new ResizeObserver(() => { if (disposed) return; const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render(); }); resize.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; synchronize(); }); intersection.observe(host);
  const pointerMove = (event: PointerEvent) => { if (!motion || !finePointer.matches) return; const bounds = host.getBoundingClientRect(); targetX = (event.clientX - bounds.left) / bounds.width - 0.5; targetY = (event.clientY - bounds.top) / bounds.height - 0.5; };
  const pointerLeave = () => { targetX = 0; targetY = 0; };
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; synchronize(); options.onUnavailable?.(); };
  host.addEventListener('pointermove', pointerMove); host.addEventListener('pointerleave', pointerLeave); canvas.addEventListener('webglcontextlost', contextLost); document.addEventListener('visibilitychange', synchronize);
  function setTheme(dark: boolean) { pedestalMaterial.color.setHex(dark ? 0x262c44 : 0xe3e4f5); ambient.intensity = dark ? 2.1 : 2.6; renderer.toneMappingExposure = dark ? 1.05 : 0.95; render(); }
  setTheme(options.dark); synchronize();
  return {
    setMotion(enabled) { motion = enabled; synchronize(); }, setTheme,
    dispose() {
      disposed = true; renderer.setAnimationLoop(null); resize.disconnect(); intersection.disconnect();
      host.removeEventListener('pointermove', pointerMove); host.removeEventListener('pointerleave', pointerLeave); canvas.removeEventListener('webglcontextlost', contextLost); document.removeEventListener('visibilitychange', synchronize);
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
