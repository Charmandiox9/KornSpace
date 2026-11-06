import type * as THREE from 'three';

export interface MascotParticle {
  source: THREE.Mesh;
  position: THREE.Vector3;
  scatter: THREE.Vector3;
  phase: number;
  size: number;
}

export interface MascotParticleCloud {
  mesh: THREE.InstancedMesh;
  update(elapsed: number, dispersion: number): void;
  dispose(): void;
}

export interface MascotSurfaceTriangle {
  source: THREE.Mesh;
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  cumulativeArea: number;
}

export interface MascotTimeline {
  phase: 'assembling' | 'performing' | 'dispersing';
  cycle: number;
  dispersion: number;
  action: number;
}
