import type { MascotPose } from '../types/mascot';

/** Shared geometry and motion coordinates keep the aisle separate from stored items. */
export const vaultLayout = {
  x: 0.95, y: -0.04, z: -0.65,
  front: 0.45, back: -2.25,
  innerLeft: -1.12, innerRight: 1.12,
  floor: -1.67,
  storageLeft: 0.35, storageRight: 1.08,
  storageFront: -0.65, storageBack: -2.0,
};

function smooth(value: number): number {
  const progress = Math.max(0, Math.min(1, value));
  return progress * progress * (3 - 2 * progress);
}

/** First align outside the doorway, then walk along its clear left aisle. */
export function getMascotPose(travel: number): MascotPose {
  const alignment = smooth(travel / 0.4);
  const depth = smooth((travel - 0.4) / 0.6);
  const scale = 0.95 - alignment * 0.30;
  return {
    x: -1.1 + alignment * 1.67,
    y: vaultLayout.floor + 1.25 * scale,
    z: 0.95 - depth * 2.8,
    scale,
    heading: Math.PI / 2 + smooth((travel - 0.28) / 0.12) * Math.PI / 2,
  };
}
