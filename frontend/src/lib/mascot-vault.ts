import * as THREE from 'three';
import type { VaultMediaKind, VaultSceneHandle } from '@/types';
import { vaultLayout } from './mascot-spatial';

/** A working miniature vault, built entirely from reusable geometric primitives. */
export function createMascotVault(scene: THREE.Scene): VaultSceneHandle {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const root = new THREE.Group(); root.position.set(vaultLayout.x, vaultLayout.y, vaultLayout.z); scene.add(root);
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
  const depth = vaultLayout.front - vaultLayout.back;
  const depthCenter = (vaultLayout.front + vaultLayout.back) / 2;
  interior.roughness = 0.95;
  box(root, interior, 0, 0, vaultLayout.back, 2.5, 3.3, 0.15);
  [-1.27, 1.27].forEach((x) => box(root, frame, x, -0.04, depthCenter, 0.22, 3.4, depth));
  box(root, frame, 0, 1.54, depthCenter, 2.7, 0.22, depth);
  box(root, frame, 0, -1.72, depthCenter, 2.7, 0.1, depth);
  box(root, interior, 0, -1.66, depthCenter, 2.3, 0.06, depth - 0.1);
  [-1.12, 1.12].forEach((x) => box(root, trim, x, 0, 0.43, 0.055, 2.9, 0.055));
  [-1.6, 1.43].forEach((y) => box(root, trim, 0, y, 0.43, 2.25, 0.055, 0.055));
  // Receding ribs and floor rails make the full chamber depth visible.
  [-0.3, -1.0, -1.7].forEach((z) => {
    [-1.14, 1.14].forEach((x) => box(root, trim, x, -0.06, z, 0.025, 3.0, 0.03));
  });
  [-0.97, 0.18].forEach((x) => box(root, violet, x, -1.62, depthCenter, 0.018, 0.01, depth - 0.1));
  // Storage occupies only the right bay, leaving the entire left aisle clear.
  const storageWidth = vaultLayout.storageRight - vaultLayout.storageLeft;
  const storageX = (vaultLayout.storageLeft + vaultLayout.storageRight) / 2;
  const storageZ = (vaultLayout.storageFront + vaultLayout.storageBack) / 2;
  const storageDepth = vaultLayout.storageFront - vaultLayout.storageBack;
  [-0.83, -0.10, 0.63].forEach((y) => box(root, trim, storageX, y, storageZ, storageWidth, 0.035, storageDepth));
  box(root, trim, vaultLayout.storageRight, -0.1, storageZ, 0.025, 1.5, storageDepth);
  function triangle(parent: THREE.Object3D, material: THREE.Material, points: number[], z: number) {
    const shape = new THREE.Shape(); shape.moveTo(points[0], points[1]); shape.lineTo(points[2], points[3]); shape.lineTo(points[4], points[5]); shape.closePath();
    return mesh(parent, new THREE.ShapeGeometry(shape), material, 0, 0, z);
  }
  const mediaInk = surface(0x4f4a78, 0.05), imageAccent = surface(0x6c95bd, 0.05), videoAccent = surface(0xcd6d77, 0.05);
  function mediaCard(kind: VaultMediaKind, x: number, y: number) {
    const card = new THREE.Group(); card.position.set(x, y, -0.96); root.add(card);
    box(card, paper, 0, 0, 0, 0.29, 0.46, 0.055);
    triangle(card, trim, [0.07, 0.23, 0.07, 0.155, 0.145, 0.155], 0.03);
    if (kind === 'image') {
      box(card, imageAccent, 0, 0, 0.033, 0.23, 0.22, 0.01);
      triangle(card, paper, [-0.105, -0.08, 0.06, -0.08, -0.025, 0.045], 0.045);
      triangle(card, violet, [-0.01, -0.08, 0.11, -0.08, 0.05, 0.005], 0.05);
      mesh(card, new THREE.CircleGeometry(0.025, 14), gold, 0.065, 0.06, 0.045);
    } else if (kind === 'video') {
      box(card, videoAccent, 0, 0, 0.033, 0.23, 0.24, 0.01);
      triangle(card, paper, [-0.04, -0.065, 0.065, 0, -0.04, 0.065], 0.045);
      [-0.09, 0.09].forEach((x) => [-0.08, 0, 0.08].forEach((y) => box(card, paper, x, y, 0.045, 0.02, 0.025, 0.01)));
    } else if (kind === 'text') {
      [0.07, 0.01, -0.05, -0.11].forEach((y, index) => box(card, mediaInk, index === 3 ? -0.035 : 0, y, 0.035, index === 3 ? 0.11 : 0.18, 0.018, 0.01));
    } else {
      box(card, gold, 0, -0.025, 0.035, 0.24, 0.16, 0.02);
      box(card, gold, -0.065, 0.065, 0.035, 0.11, 0.055, 0.02);
      box(card, paper, -0.035, -0.025, 0.05, 0.10, 0.018, 0.01);
    }
  }
  const kinds: VaultMediaKind[] = ['image', 'video', 'text', 'folder'];
  kinds.forEach((kind, index) => mediaCard(kind, index % 2 ? 0.89 : 0.53, index < 2 ? 0.15 : -0.58));
  const deliveredFolder = new THREE.Group(); deliveredFolder.position.set(storageX, 0.89, -1.12); deliveredFolder.visible = false; root.add(deliveredFolder);
  box(deliveredFolder, violet, 0, 0, 0, 0.49, 0.46, 0.10);
  box(deliveredFolder, violet, -0.13, 0.25, 0, 0.20, 0.07, 0.10);
  box(deliveredFolder, paper, -0.08, -0.03, 0.058, 0.16, 0.025, 0.01);
  const door = new THREE.Group(); door.position.set(1.14, 0, 0.51); root.add(door);
  box(door, trim, -1.14, -0.1, 0, 2.25, 3.02, 0.18);
  box(door, doorSurface, -1.14, -0.1, 0.11, 2.1, 2.86, 0.12);
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
  const interiorLight = new THREE.PointLight(0xc3b7ef, 2.5, 4); interiorLight.position.set(-0.15, 1.1, -0.65); root.add(interiorLight);
  // Small cereal-shaped brass inlays tie the safe to the mascot's world.
  [-0.16, 0, 0.16].forEach((x, index) => {
    const inlay = mesh(door, new THREE.SphereGeometry(1, 12, 8), gold, -1.14 + x, -1.08, 0.19); inlay.scale.set(0.065, 0.10, 0.012); inlay.rotation.z = (index - 1) * -0.5;
  });
  return {
    update(open, secured, stored) {
      deliveredFolder.visible = stored;
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
