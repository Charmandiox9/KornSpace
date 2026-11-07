import * as THREE from 'three';
import type { MascotParticle, MascotParticleCloud, MascotSurfaceTriangle } from '@/types';

/** Samples the procedural model into one draw call of small geometric pieces. */
export function createMascotParticles(sources: THREE.Object3D[], count = 14000): MascotParticleCloud {
  let seed = 281;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const triangles: MascotSurfaceTriangle[] = [];
  const surfaceAreas = new Map<THREE.Mesh, number>();
  let area = 0;
  sources.forEach((root) => {
    root.updateWorldMatrix(true, true);
    root.traverse((source) => {
      if (!(source instanceof THREE.Mesh)) return;
      const positions = source.geometry.getAttribute('position');
      const indices = source.geometry.getIndex();
      const length = indices?.count ?? positions.count;
      for (let index = 0; index < length; index += 3) {
        const vertex = (offset: number) => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(index + offset) : index + offset);
        const a = vertex(0), b = vertex(1), c = vertex(2);
        const world = new THREE.Triangle(a.clone().applyMatrix4(source.matrixWorld), b.clone().applyMatrix4(source.matrixWorld), c.clone().applyMatrix4(source.matrixWorld));
        const triangleArea = world.getArea();
        area += triangleArea;
        surfaceAreas.set(source, (surfaceAreas.get(source) ?? 0) + triangleArea);
        triangles.push({ source, a, b, c, cumulativeArea: area });
      }
    });
    root.visible = false;
  });
  // Reserve density for small features such as pupils, toes and folder labels.
  let previousArea = 0;
  area = 0;
  triangles.forEach((triangle) => {
    const originalArea = triangle.cumulativeArea;
    const sourceArea = surfaceAreas.get(triangle.source) ?? 0;
    area += (originalArea - previousArea) * (1 + 0.16 / Math.max(sourceArea, 0.001));
    triangle.cumulativeArea = area;
    previousArea = originalArea;
  });
  const geometry = new THREE.TetrahedronGeometry(1);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.04, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // The cloud expands during its entrance; its assembled bounds are insufficient.
  mesh.frustumCulled = false;
  const particles: MascotParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = random() * area;
    let low = 0, high = triangles.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (triangles[middle].cumulativeArea < target) low = middle + 1;
      else high = middle;
    }
    const triangle = triangles[low];
    const u = Math.sqrt(random()), v = random();
    const position = triangle.a.clone().multiplyScalar(1 - u).addScaledVector(triangle.b, u * (1 - v)).addScaledVector(triangle.c, u * v);
    const surface = triangle.source.material;
    const color = !Array.isArray(surface) && surface instanceof THREE.MeshStandardMaterial ? surface.color.clone() : new THREE.Color(0x8174db);
    color.multiplyScalar(0.95 + random() * 0.10);
    mesh.setColorAt(index, color);
    const sourceArea = surfaceAreas.get(triangle.source) ?? 1;
    const size = sourceArea < 0.025 ? 0.008 + random() * 0.006 : 0.019 + random() * 0.009;
    let ancestor: THREE.Object3D | null = triangle.source;
    let cargo = false;
    while (ancestor) { if (ancestor.userData.mascotCargo === true) { cargo = true; break; } ancestor = ancestor.parent; }
    particles.push({ source: triangle.source, position, scatter: new THREE.Vector3((random() - 0.5) * 4.5, (random() - 0.5) * 3, (random() - 0.5) * 2), phase: random() * Math.PI * 2, size, cargo });
  }
  const dummy = new THREE.Object3D();
  function update(elapsed: number, dispersion: number, carrying = true) {
    sources.forEach((root) => root.updateWorldMatrix(true, true));
    particles.forEach((particle, index) => {
      dummy.position.copy(particle.position).applyMatrix4(particle.source.matrixWorld).addScaledVector(particle.scatter, dispersion);
      dummy.position.y += Math.sin(elapsed * 1.1 + particle.phase) * (0.003 + dispersion * 0.035);
      dummy.rotation.set(particle.phase + elapsed * 0.12, particle.phase * 0.7 + elapsed * 0.09, particle.phase);
      dummy.scale.setScalar(particle.cargo && !carrying ? 0 : particle.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);
  return { mesh, update, dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); } };
}
