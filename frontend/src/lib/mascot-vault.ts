import * as THREE from 'three';
import type { VaultSceneHandle } from '@/types';

/** A working miniature vault, built entirely from reusable geometric primitives. */
export function createMascotVault(scene: THREE.Scene): VaultSceneHandle {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const root = new THREE.Group(); root.position.set(0.95, -0.04, -0.65); scene.add(root);
  function surface(color: number, metalness = 0.35) {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.4 });
    materials.add(material); return material;
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); parent.add(object); return object;
  }
  function box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) {
    return mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
  }
  const frame = surface(0x5b5980), trim = surface(0xa5a4c4, 0.65), doorSurface = surface(0x383952), interior = surface(0x171c30, 0.1);
  const gold = surface(0xdfb368, 0.65), paper = surface(0xf1ece1, 0.05), violet = surface(0x8a78d7, 0.15);
  box(root, interior, 0, 0, -0.55, 2.5, 3.12, 0.15);
  [-1.27, 1.27].forEach((x) => box(root, frame, x, 0, -0.1, 0.22, 3.3, 1.0));
  [-1.54, 1.54].forEach((y) => box(root, frame, 0, y, -0.1, 2.7, 0.22, 1.0));
  [-1.12, 1.12].forEach((x) => box(root, trim, x, 0, 0.43, 0.055, 2.9, 0.055));
  [-1.43, 1.43].forEach((y) => box(root, trim, 0, y, 0.43, 2.25, 0.055, 0.055));
  // Documents and a recessed shelf remain visible while the door is open.
  box(root, trim, 0, -0.57, -0.22, 2.15, 0.045, 0.54);
  [0x8a78d7, 0x6c95bd, 0xd6ad62].forEach((color, index) => {
    const folder = box(root, surface(color, 0.05), -0.63 + index * 0.56, -0.21, -0.28, 0.45, 0.65, 0.15);
    folder.rotation.z = (index - 1) * 0.06;
    box(folder, paper, 0, 0.31, -0.02, 0.36, 0.06, 0.09);
    box(folder, paper, -0.055, -0.10, 0.082, 0.17, 0.045, 0.01);
  });
  const door = new THREE.Group(); door.position.set(1.14, 0, 0.51); root.add(door);
  box(door, trim, -1.14, 0, 0, 2.25, 2.84, 0.18);
  box(door, doorSurface, -1.14, 0, 0.11, 2.1, 2.68, 0.12);
  const ring = mesh(door, new THREE.TorusGeometry(0.78, 0.045, 10, 64), trim, -1.14, 0, 0.21);
  mesh(door, new THREE.TorusGeometry(0.63, 0.018, 8, 64), violet, -1.14, 0, 0.22);
  const wheel = new THREE.Group(); wheel.position.set(-1.14, 0, 0.25); door.add(wheel);
  mesh(wheel, new THREE.SphereGeometry(0.17, 16, 12), gold, 0, 0, 0.06).scale.z = 0.5;
  for (let index = 0; index < 3; index += 1) {
    const angle = index * Math.PI * 2 / 3;
    const spoke = box(wheel, trim, Math.sin(angle) * 0.26, Math.cos(angle) * 0.26, 0.07, 0.075, 0.54, 0.08); spoke.rotation.z = -angle;
    mesh(wheel, new THREE.SphereGeometry(0.075, 12, 8), gold, Math.sin(angle) * 0.51, Math.cos(angle) * 0.51, 0.07);
  }
  const boltGeometry = new THREE.SphereGeometry(0.035, 8, 6); geometries.add(boltGeometry);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI / 6;
    const bolt = new THREE.Mesh(boltGeometry, gold); bolt.position.set(-1.14 + Math.cos(angle) * 0.9, Math.sin(angle) * 0.9, 0.21); door.add(bolt);
  }
  [-0.95, 0.95].forEach((y) => mesh(root, new THREE.CylinderGeometry(0.1, 0.1, 0.33, 16), trim, 1.16, y, 0.55));
  const lightMaterial = surface(0x8a78d7, 0.05); lightMaterial.emissive.setHex(0x6c5bb7); lightMaterial.emissiveIntensity = 0.6;
  const indicator = mesh(root, new THREE.SphereGeometry(0.06, 16, 12), lightMaterial, 0.80, 1.54, 0.46); indicator.scale.z = 0.35;
  const interiorLight = new THREE.PointLight(0xa89bea, 1.5, 3); interiorLight.position.set(0, 0.8, 0.0); root.add(interiorLight);
  // Small cereal-shaped brass inlays tie the safe to the mascot's world.
  [-0.16, 0, 0.16].forEach((x, index) => {
    const inlay = mesh(door, new THREE.SphereGeometry(1, 12, 8), gold, -1.14 + x, -1.08, 0.19); inlay.scale.set(0.065, 0.10, 0.012); inlay.rotation.z = (index - 1) * -0.5;
  });
  return {
    update(open, secured) {
      door.rotation.y = open * 1.9;
      wheel.rotation.z = open * Math.PI * 0.75;
      ring.rotation.z = open * 0.2;
      lightMaterial.color.setHex(secured ? 0x79cba6 : 0xa89bea);
      lightMaterial.emissive.setHex(secured ? 0x42956d : 0x6c5bb7);
    },
    setTheme(dark) {
      frame.color.setHex(dark ? 0x5b5980 : 0x9693b8);
      doorSurface.color.setHex(dark ? 0x383952 : 0xb9b7d0);
      trim.color.setHex(dark ? 0xa5a4c4 : 0x666481);
    },
    dispose() { root.removeFromParent(); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); },
  };
}
