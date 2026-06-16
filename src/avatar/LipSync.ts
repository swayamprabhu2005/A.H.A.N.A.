import * as THREE from 'three';
import type { FaceVertex } from './FaceMesh';

export type VisemeType =
  | 'neutral'
  | 'A'
  | 'E'
  | 'I'
  | 'O'
  | 'U'
  | 'M' // B, P share this (closed lips)
  | 'F' // V shares this (lower lip tucked)
  | 'L' // Tongue raised
  | 'S'; // Teeth showing, wide

export class LipSync {
  public currentViseme: VisemeType = 'neutral';
  public intensity = 0.0; // Dynamic scale (e.g. driven by audio volume)
  
  private visemeWeights: Record<VisemeType, number> = {
    neutral: 1.0,
    A: 0.0,
    E: 0.0,
    I: 0.0,
    O: 0.0,
    U: 0.0,
    M: 0.0,
    F: 0.0,
    L: 0.0,
    S: 0.0
  };
  
  private targetWeights: Record<VisemeType, number> = {
    neutral: 1.0,
    A: 0.0,
    E: 0.0,
    I: 0.0,
    O: 0.0,
    U: 0.0,
    M: 0.0,
    F: 0.0,
    L: 0.0,
    S: 0.0
  };
  
  private blendSpeed = 16.0; // Fast blending for speech (15-20 units)

  constructor() {}

  /**
   * Targets a specific viseme.
   */
  public setTargetViseme(viseme: VisemeType, intensity: number = 1.0) {
    this.currentViseme = viseme;
    this.intensity = intensity;
    
    // Reset target weights
    for (const key in this.targetWeights) {
      this.targetWeights[key as VisemeType] = 0.0;
    }
    this.targetWeights[viseme] = 1.0;
  }

  /**
   * Frame update - smoothly interpolates current viseme weights towards targets.
   */
  public update(deltaTime: number, speechVolume: number = 1.0) {
    // Smoothly blend weights
    for (const key in this.visemeWeights) {
      const type = key as VisemeType;
      this.visemeWeights[type] = THREE.MathUtils.lerp(
        this.visemeWeights[type],
        this.targetWeights[type],
        deltaTime * this.blendSpeed
      );
    }
    
    // Scale intensity slightly based on speech volume for organic reaction
    // (Louder volume = wider mouth opening)
    if (this.currentViseme !== 'neutral' && this.currentViseme !== 'M') {
      const volBoost = 0.12 + speechVolume * 0.08;
      this.intensity = THREE.MathUtils.clamp(volBoost, 0.10, 0.20);
    } else {
      this.intensity = THREE.MathUtils.lerp(this.intensity, 0.0, deltaTime * this.blendSpeed);
    }
  }

  /**
   * Calculates the mouth offsets for the active visemes.
   */
  public getOffsetForVertex(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const yCenter = -0.45; // Center of the lips line
    const yDist = Math.abs(v.basePos.y - yCenter);
    
    // Strict proximity check focused only on the lips line
    if (v.basePos.z > 0 && yDist < 0.06 && Math.abs(v.basePos.x) < 0.28) {
      // Smooth Gaussian falloff within the lips line
      const horizontalFalloff = Math.exp(-Math.pow(v.basePos.x / 0.16, 2.0));
      const verticalFalloff = Math.exp(-Math.pow(yDist / 0.035, 2.0));
      const totalFalloff = horizontalFalloff * verticalFalloff;
      
      if (totalFalloff > 0.01) {
        // Sum offsets from all active visemes
        for (const key in this.visemeWeights) {
          const type = key as VisemeType;
          const weight = this.visemeWeights[type];
          
          if (weight > 0.001) {
            const visemeOffset = this.calculateVisemeOffset(v, type);
            offset.addScaledVector(visemeOffset, weight * this.intensity * totalFalloff);
          }
        }
      }
    }
    
    return offset;
  }

  private calculateVisemeOffset(v: FaceVertex, viseme: VisemeType): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const signX = x >= 0 ? 1 : -1;
    const d = Math.abs(x);
    const y = v.basePos.y;
    const yCenter = -0.33;

    switch (viseme) {
      case 'M': // B, P (closed mouth)
        if (y >= yCenter) {
          offset.y = -0.04;
          offset.z = 0.01;
        } else {
          offset.y = 0.045;
          offset.z = 0.01;
        }
        break;
        
      case 'A': // Wide open
        if (y >= yCenter) {
          offset.y = 0.08;
          offset.z = -0.02;
        } else {
          offset.y = -0.15;
          offset.z = -0.03;
        }
        break;
        
      case 'E': // Wide width, thin open
        offset.x = signX * 0.09 * Math.exp(-Math.pow((d - 0.42) / 0.2, 2));
        if (y >= yCenter) offset.y = 0.03;
        else offset.y = -0.04;
        break;
        
      case 'I': // Similar to E but more open
        offset.x = signX * 0.07 * Math.exp(-Math.pow((d - 0.42) / 0.2, 2));
        if (y >= yCenter) offset.y = 0.05;
        else offset.y = -0.07;
        break;
        
      case 'O': // Round, puckered
        offset.x = -signX * 0.06 * Math.exp(-Math.pow((d - 0.42) / 0.2, 2));
        if (y >= yCenter) {
          offset.y = 0.06;
          offset.z = 0.04; // pucker forward
        } else {
          offset.y = -0.1;
          offset.z = 0.04;
        }
        break;
        
      case 'U': // Tight round
        offset.x = -signX * 0.08 * Math.exp(-Math.pow((d - 0.42) / 0.2, 2));
        if (y >= yCenter) {
          offset.y = 0.04;
          offset.z = 0.07; // push forward strongly
        } else {
          offset.y = -0.06;
          offset.z = 0.07;
        }
        break;
        
      case 'F': // Lower lip tucked
        if (y >= yCenter) {
          offset.y = -0.01;
        } else {
          offset.y = 0.05; // pull up to touch upper teeth
          offset.z = -0.04; // pull backward under upper lip
        }
        break;
        
      case 'L': // Tongue position
        if (y >= yCenter) {
          offset.y = 0.06;
        } else {
          offset.y = -0.08;
        }
        break;
        
      case 'S': // Teeth showing, flat horizontal slit
        offset.x = signX * 0.05 * Math.exp(-Math.pow((d - 0.42) / 0.2, 2));
        if (y >= yCenter) offset.y = 0.025;
        else offset.y = -0.025;
        break;
        
      case 'neutral':
      default:
        break;
    }
    
    return offset;
  }
}
