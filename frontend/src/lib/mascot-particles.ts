import * as THREE from 'three';
import type { MascotParticle, MascotParticleCloud, MascotSurfaceTriangle } from '@/types';

/** Samples the procedural model into one draw call of small geometric pieces. */
export function createMascotParticles(sources: THREE.Object3D[], count = 4800): MascotParticleCloud {
  let seed = 281;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const triangles: MascotSurfaceTriangle[] = [];
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
        area += world.getArea();
        triangles.push({ source, a, b, c, cumulativeArea: area });
      }
    });
    root.visible = false;
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
    color.multiplyScalar(0.84 + random() * 0.32);
    mesh.setColorAt(index, color);
    particles.push({ source: triangle.source, position, scatter: new THREE.Vector3((random() - 0.5) * 5, (random() - 0.5) * 3.5, (random() - 0.5) * 3), phase: random() * Math.PI * 2, size: 0.026 + random() * 0.018 });
  }
  const dummy = new THREE.Object3D();
  function update(elapsed: number, assembling: boolean) {
    sources.forEach((root) => root.updateWorldMatrix(true, true));
    const progress = assembling ? Math.min(1, elapsed / 1.8) : 1;
    const remaining = Math.pow(1 - progress, 3);
    particles.forEach((particle, index) => {
      dummy.position.copy(particle.position).applyMatrix4(particle.source.matrixWorld).addScaledVector(particle.scatter, remaining);
      dummy.position.y += Math.sin(elapsed * 1.1 + particle.phase) * 0.009;
      dummy.rotation.set(particle.phase + elapsed * 0.12, particle.phase * 0.7 + elapsed * 0.09, particle.phase);
      dummy.scale.setScalar(particle.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, false);
  return { mesh, update, dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); } };
}
