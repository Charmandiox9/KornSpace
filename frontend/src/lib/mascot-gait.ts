import type { RoosterGait, RoosterLegPose } from '../types/mascot';

export const roosterLeg = { upper: 0.37, lower: 0.39, hipY: -0.48, ankleY: -1.16, ankleZ: 0.05 };

function solveLeg(targetY: number, targetZ: number, lift: number, toePitch: number): RoosterLegPose {
  const down = roosterLeg.hipY - targetY;
  const forward = targetZ - 0.02;
  const distance = Math.min(Math.hypot(down, forward), roosterLeg.upper + roosterLeg.lower - 0.0001);
  const clamp = (value: number) => Math.min(1, Math.max(-1, value));
  const hip = -Math.atan2(forward, down) + Math.acos(clamp((roosterLeg.upper ** 2 + distance ** 2 - roosterLeg.lower ** 2) / (2 * roosterLeg.upper * distance)));
  const knee = -Math.acos(clamp((distance ** 2 - roosterLeg.upper ** 2 - roosterLeg.lower ** 2) / (2 * roosterLeg.upper * roosterLeg.lower)));
  return { hip, knee, ankle: -hip - knee + toePitch, targetY, targetZ, lift };
}

/** Distance drives the steps so the feet do not keep marching when the body stops. */
export function getRoosterGait(distance: number, weight: number): RoosterGait {
  const blend = Math.min(1, Math.max(0, weight));
  const phase = blend === 0 ? 0 : ((distance / 0.6) % 1 + 1) % 1;
  const bodyLift = Math.cos(phase * Math.PI * 4) * 0.015 * blend;
  const bodyRoll = Math.sin(phase * Math.PI * 2) * 0.025 * blend;
  function step(offset: number, side: number) {
    const t = (phase + offset) % 1;
    const swing = Math.max(0, (t - 0.6) / 0.4);
    const smooth = swing * swing * (3 - 2 * swing);
    const stride = t < 0.6 ? 0.18 - t * 0.6 : -0.18 + smooth * 0.36;
    const lift = Math.sin(swing * Math.PI) * 0.13 * blend;
    return solveLeg(roosterLeg.ankleY - bodyLift - side * 0.25 * Math.sin(bodyRoll) + lift, roosterLeg.ankleZ + stride * blend, lift, Math.sin(swing * Math.PI) * 0.18 * blend);
  }
  return { left: step(0, -1), right: step(0.5, 1), bodyLift, bodyRoll, bodyPitch: 0.045 * blend, wingSwing: Math.sin(phase * Math.PI * 2) * 0.10 * blend };
}
