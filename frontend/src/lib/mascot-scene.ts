import * as THREE from 'three';
import { createMascotParticles } from './mascot-particles';
import { getMascotTimeline } from './mascot-timeline';
import { createMascotVault } from './mascot-vault';
import { getMascotPose } from './mascot-spatial';
import { getRoosterGait, roosterLeg } from './mascot-gait';
import type { MascotSceneHandle, MascotSceneOptions, RoosterLegPose, RoosterLegRig, RoosterWingRig } from '@/types';

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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.set(2.4, 2.1, 9.6); camera.lookAt(0.1, -0.15, -0.2);
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
    box(group, paper, [-0.28, -0.27, 0.18], [0.47, 0.025, 0.02]);
    box(group, paper, [-0.36, -0.33, 0.18], [0.31, 0.025, 0.02]);
    return group;
  }
  const base = new THREE.Mesh(geometry(new THREE.CylinderGeometry(3.25, 3.32, 0.16, 64)), pedestalMaterial); base.position.set(0.2, -1.79, -0.35); scene.add(base);
  const rooster = new THREE.Group();
  const initialPose = getMascotPose(0); rooster.position.set(initialPose.x, initialPose.y, initialPose.z); rooster.scale.setScalar(initialPose.scale); scene.add(rooster);
  const tail = new THREE.Group(); rooster.add(tail);
  [0xc4bfd8, 0xe1dae6, 0xa89ec4].forEach((color, index) => {
    const feather = oval(tail, material(color), [-0.38 - index * 0.055, 0.10 + index * 0.06, -0.39 - index * 0.045], [0.13, 0.34 + index * 0.045, 0.10]); feather.rotation.z = 0.24 + index * 0.19;
  });
  oval(rooster, white, [0, 0, 0], [0.61, 0.78, 0.46]);
  const neck = new THREE.Group(); neck.position.set(0.03, 0.48, 0.04); rooster.add(neck);
  oval(neck, white, [0, 0.10, 0], [0.32, 0.55, 0.3]);
  const head = new THREE.Group(); head.position.set(0.01, 0.47, 0.06); neck.add(head);
  oval(head, white, [0, 0, 0], [0.43, 0.46, 0.38]);
  [-0.22, 0, 0.21].forEach((x, index) => { const comb = oval(head, red, [x, 0.44 + (index === 1 ? 0.06 : 0), 0], [0.14, index === 1 ? 0.25 : 0.20, 0.105]); comb.rotation.z = -x * 0.8; });
  const eyes = new THREE.Group(); head.add(eyes);
  [-0.19, 0.19].forEach((x) => {
    oval(eyes, ink, [x, 0.08, 0.342], [0.129, 0.16, 0.055]);
    oval(eyes, paper, [x, 0.08, 0.372], [0.112, 0.14, 0.05]);
    oval(eyes, ink, [x + 0.018, 0.067, 0.423], [0.062, 0.082, 0.025]);
    oval(eyes, paper, [x + 0.035, 0.1, 0.448], [0.022, 0.025, 0.012]);
    const brow = oval(head, white, [x, 0.258, 0.33], [0.14, 0.038, 0.055]); brow.rotation.z = -x * 0.7;
  });
  const beak = new THREE.Mesh(geometry(new THREE.ConeGeometry(0.145, 0.31, 4)), gold); beak.rotation.x = Math.PI / 2; beak.rotation.z = Math.PI / 4; beak.position.set(0, -0.05, 0.47); head.add(beak);
  oval(head, red, [0, -0.27, 0.28], [0.085, 0.19, 0.09]);
  function wing(side: number): RoosterWingRig {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.46, 0.18, 0.10); rooster.add(shoulder);
    oval(shoulder, white, [side * 0.035, -0.13, 0.035], [0.17, 0.27, 0.17]);
    const elbow = new THREE.Group(); elbow.position.set(side * 0.08, -0.24, 0.09); shoulder.add(elbow);
    oval(elbow, white, [-side * 0.04, -0.05, 0.17], [0.13, 0.16, 0.20]);
    const wrist = new THREE.Group(); wrist.position.set(-side * 0.07, -0.12, 0.38); elbow.add(wrist);
    oval(wrist, white, [0, -0.04, 0.16], [0.12, 0.16, 0.10]);
    return { shoulder, elbow, wrist };
  }
  const leftWing = wing(-1), rightWing = wing(1);
  function leg(x: number): RoosterLegRig {
    const hip = new THREE.Group(); hip.position.set(x, roosterLeg.hipY, 0.02); rooster.add(hip);
    oval(hip, white, [0, -0.12, 0], [0.105, 0.18, 0.11]);
    const upper = new THREE.Mesh(geometry(new THREE.CylinderGeometry(0.045, 0.035, roosterLeg.upper, 12)), gold); upper.position.y = -roosterLeg.upper / 2; hip.add(upper);
    const knee = new THREE.Group(); knee.position.y = -roosterLeg.upper; hip.add(knee);
    oval(knee, gold, [0, 0, 0], [0.055, 0.055, 0.055]);
    const lower = new THREE.Mesh(geometry(new THREE.CylinderGeometry(0.035, 0.028, roosterLeg.lower, 12)), gold); lower.position.y = -roosterLeg.lower / 2; knee.add(lower);
    const ankle = new THREE.Group(); ankle.position.y = -roosterLeg.lower; knee.add(ankle);
    oval(ankle, gold, [0, -0.035, 0.08], [0.13, 0.055, 0.15]);
    [-1, 0, 1].forEach((toe) => {
      const claw = oval(ankle, gold, [toe * 0.075, -0.05, 0.20], [0.035, 0.035, 0.12]); claw.rotation.y = toe * 0.25;
    });
    return { hip, knee, ankle };
  }
  const leftLeg = leg(-0.25), rightLeg = leg(0.25);
  const heldFolder = folder(violet); heldFolder.position.set(0, -0.16, 0.57); heldFolder.scale.setScalar(0.82); heldFolder.rotation.z = -0.09; rooster.add(heldFolder);
  heldFolder.userData.mascotCargo = true;
  function applyLeg(rig: RoosterLegRig, pose: RoosterLegPose) {
    rig.hip.rotation.x = pose.hip; rig.knee.rotation.x = pose.knee; rig.ankle.rotation.x = pose.ankle;
  }
  const neutralGait = getRoosterGait(0, 0); applyLeg(leftLeg, neutralGait.left); applyLeg(rightLeg, neutralGait.right);
  const stack = new THREE.Group(); stack.position.set(-1.9, -1.25, 0.85); stack.scale.setScalar(0.7); stack.rotation.y = -0.23; scene.add(stack);
  [material(0xd9ad58), material(0x6e8cce)].forEach((surface, index) => { const item = folder(surface); item.scale.setScalar(0.48); item.position.set(index * 0.1, index * 0.12, -index * 0.14); stack.add(item); });
  // Small irregular cereal flakes rest on the desktop.
  const flakeGeometry = geometry(new THREE.SphereGeometry(1, 14, 10));
  const positions = flakeGeometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) { const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index); const ridge = 1 + 0.11 * Math.sin(x * 9 + y * 5); positions.setXYZ(index, x * ridge, y * 0.28 + 0.08 * Math.sin(z * 7), z * ridge); }
  flakeGeometry.computeVertexNormals();
  [[-1.30, 1.78], [0.85, 1.94], [1.90, 1.54]].forEach(([x, z], index) => { const flake = new THREE.Mesh(flakeGeometry, gold); flake.scale.setScalar(0.13 + index * 0.025); flake.position.set(x, -1.68, z); flake.rotation.y = index * 1.3; scene.add(flake); });
  const ambient = new THREE.HemisphereLight(0xe9edff, 0x535068, 2.3); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffefd9, 3); key.position.set(-3, 5, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8b9ff, 2); fill.position.set(4, 2, -3); scene.add(fill);
  const vault = createMascotVault(scene);
  const cloud = createMascotParticles([rooster]); scene.add(cloud.mesh);
  cloud.update(0, options.motion ? 1 : 0);
  canvas.dataset.sceneStyle = 'geometric-particles';
  canvas.dataset.scenePhase = options.motion ? 'assembling' : 'performing';
  canvas.dataset.sceneCycle = '0';
  let motion = options.motion, visible = true, disposed = false, lost = false, elapsed = 0, lastTime = 0;
  let walkedDistance = 0, gaitWeight = 0, loadWeight = 1;
  let previousX = initialPose.x, previousZ = initialPose.z;
  let targetX = 0, targetY = 0;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const render = () => { if (!disposed && !lost) renderer.render(scene, camera); };
  function frame(time: number) {
    if (!motion || !visible || document.hidden || lost || disposed) return;
    if (time - lastTime < 32) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.15) : 0;
    lastTime = time; elapsed += delta;
    const timeline = getMascotTimeline(elapsed);
    const action = timeline.action * Math.PI * 2;
    const formed = 1 - timeline.dispersion;
    const walking = timeline.phase === 'entering' || timeline.phase === 'returning';
    const pose = getMascotPose(timeline.travel);
    const distance = Math.hypot(pose.x - previousX, pose.z - previousZ);
    previousX = pose.x; previousZ = pose.z;
    const smoothing = 1 - Math.exp(-delta * 12);
    if (walking) walkedDistance += distance / pose.scale;
    gaitWeight += ((walking && distance > 0.0001 ? 1 : 0) - gaitWeight) * smoothing;
    loadWeight += ((timeline.carrying ? 1 : 0) - loadWeight) * smoothing;
    const gait = getRoosterGait(walkedDistance, gaitWeight);
    applyLeg(leftLeg, gait.left); applyLeg(rightLeg, gait.right);
    rooster.position.set(pose.x, pose.y + gait.bodyLift * pose.scale, pose.z);
    rooster.scale.setScalar(pose.scale);
    const heading = walking ? pose.heading + (timeline.phase === 'returning' ? Math.PI : 0) : timeline.travel > 0 ? Math.PI : Math.sin(action) * 0.18 * formed;
    rooster.rotation.y += Math.atan2(Math.sin(heading - rooster.rotation.y), Math.cos(heading - rooster.rotation.y)) * 0.14;
    rooster.rotation.z = gait.bodyRoll;
    rooster.rotation.x = gait.bodyPitch;
    head.rotation.y += (Math.sin(action) * 0.3 * formed + targetX * 0.18 - head.rotation.y) * 0.12;
    neck.rotation.x += (-gait.bodyPitch * 0.7 + Math.sin(action * 2) * 0.025 * formed - neck.rotation.x) * smoothing;
    head.rotation.x += (targetY * 0.10 - gait.bodyPitch * 0.3 + Math.sin(action * 2) * 0.035 * formed - head.rotation.x) * smoothing;
    heldFolder.rotation.z = -0.09 + Math.sin(action) * 0.08 * formed;
    heldFolder.position.y = -0.16 + Math.sin(action) * 0.015 * formed;
    [leftWing, rightWing].forEach((rig, index) => {
      const side = index ? 1 : -1;
      rig.shoulder.rotation.z = side * ((1 - loadWeight) * 0.12 + gait.wingSwing * (1 - loadWeight * 0.8));
      rig.shoulder.rotation.x = (1 - loadWeight) * 0.28;
      rig.elbow.rotation.x = -0.65 * (1 - loadWeight);
      rig.elbow.rotation.y = side * 0.5 * (1 - loadWeight);
      rig.wrist.rotation.x = 0.35 * (1 - loadWeight);
    });
    tail.rotation.z = Math.sin(action) * 0.12 * formed;
    const blink = elapsed % 5;
    eyes.scale.y = blink > 4.78 ? Math.max(0.08, Math.min(1, Math.abs(blink - 4.89) / 0.11)) : 1;
    cloud.update(elapsed, timeline.dispersion, timeline.carrying);
    vault.update(timeline.doorOpen, timeline.phase === 'secured' && timeline.doorOpen < 0.1, timeline.stored);
    canvas.dataset.scenePhase = timeline.phase;
    canvas.dataset.sceneCycle = String(timeline.cycle);
    canvas.dataset.sceneTravel = String(timeline.travel);
    canvas.dataset.sceneCargo = timeline.carrying ? 'carrying' : 'stored';
    render();
  }
  function synchronize() {
    if (disposed) return;
    lastTime = 0;
    canvas.dataset.sceneMotion = motion && visible && !document.hidden && !lost ? 'active' : 'paused';
    renderer.setAnimationLoop(motion && visible && !document.hidden && !lost ? frame : null);
    render();
  }
  const resize = new ResizeObserver(() => { if (disposed) return; const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.fov = camera.aspect < 1.1 ? 40 : 32; camera.updateProjectionMatrix(); render(); }); resize.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; synchronize(); }); intersection.observe(host);
  const pointerMove = (event: PointerEvent) => { if (!motion || !finePointer.matches) return; const bounds = host.getBoundingClientRect(); targetX = (event.clientX - bounds.left) / bounds.width - 0.5; targetY = (event.clientY - bounds.top) / bounds.height - 0.5; };
  const pointerLeave = () => { targetX = 0; targetY = 0; };
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; synchronize(); options.onUnavailable?.(); };
  host.addEventListener('pointermove', pointerMove); host.addEventListener('pointerleave', pointerLeave); canvas.addEventListener('webglcontextlost', contextLost); document.addEventListener('visibilitychange', synchronize);
  function setTheme(dark: boolean) { vault.setTheme(dark); pedestalMaterial.color.setHex(dark ? 0x262c44 : 0xe3e4f5); ambient.intensity = dark ? 2.1 : 2.6; renderer.toneMappingExposure = dark ? 1.05 : 0.95; render(); }
  setTheme(options.dark); synchronize();
  return {
    setMotion(enabled) { motion = enabled; synchronize(); }, setTheme,
    dispose() {
      disposed = true; renderer.setAnimationLoop(null); resize.disconnect(); intersection.disconnect();
      host.removeEventListener('pointermove', pointerMove); host.removeEventListener('pointerleave', pointerLeave); canvas.removeEventListener('webglcontextlost', contextLost); document.removeEventListener('visibilitychange', synchronize);
      cloud.dispose();
      vault.dispose();
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
