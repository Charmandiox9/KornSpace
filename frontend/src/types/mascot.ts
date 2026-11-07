import type * as THREE from 'three';

export interface MascotParticle {
  source: THREE.Mesh;
  position: THREE.Vector3;
  scatter: THREE.Vector3;
  phase: number;
  size: number;
  cargo: boolean;
}

export interface MascotParticleCloud {
  mesh: THREE.InstancedMesh;
  update(elapsed: number, dispersion: number, carrying?: boolean): void;
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
  phase: 'assembling' | 'performing' | 'opening' | 'entering' | 'secured' | 'returning' | 'dispersing';
  cycle: number;
  dispersion: number;
  action: number;
  doorOpen: number;
  travel: number;
  carrying: boolean;
  stored: boolean;
}

export interface VaultSceneHandle {
  update(open: number, secured: boolean, stored: boolean): void;
  setTheme(dark: boolean): void;
  dispose(): void;
}

export type VaultMediaKind = 'image' | 'video' | 'text' | 'folder';

export interface MascotPose {
  x: number;
  y: number;
  z: number;
  scale: number;
  heading: number;
}

export interface RoosterLegPose {
  hip: number;
  knee: number;
  ankle: number;
  targetY: number;
  targetZ: number;
  lift: number;
}

export interface RoosterGait {
  left: RoosterLegPose;
  right: RoosterLegPose;
  bodyLift: number;
  bodyRoll: number;
  bodyPitch: number;
  wingSwing: number;
}

export interface RoosterLegRig {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
}

export interface RoosterWingRig {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
}
