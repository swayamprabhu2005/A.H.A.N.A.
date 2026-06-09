import * as THREE from 'three';
import type { FaceVertex } from './FaceMesh';
import { gsap } from 'gsap';

export interface ExpressionWeights {
  neutral: number;
  smile: number;
  laugh: number;
  sad: number;
  angry: number;
  surprise: number;
  thinking: number;
  confused: number;
  listening: number;
}

export class Expressions {
  public weights: ExpressionWeights = {
    neutral: 1.0,
    smile: 0.0,
    laugh: 0.0,
    sad: 0.0,
    angry: 0.0,
    surprise: 0.0,
    thinking: 0.0,
    confused: 0.0,
    listening: 0.0
  };

  private currentTween: gsap.core.Tween | null = null;

  constructor() {}

  /**
   * Sets or blends to a specific target expression.
   * Smoothly interpolates the weights using GSAP.
   */
  public transitionTo(target: keyof ExpressionWeights, duration: number = 0.6) {
    if (this.currentTween) {
      this.currentTween.kill();
    }

    const targetWeights: Partial<ExpressionWeights> = {
      neutral: 0,
      smile: 0,
      laugh: 0,
      sad: 0,
      angry: 0,
      surprise: 0,
      thinking: 0,
      confused: 0,
      listening: 0
    };

    targetWeights[target] = 1.0;
    
    // If setting to neutral, ensure neutral is 1.0
    if (target === 'neutral') {
      targetWeights.neutral = 1.0;
    }

    this.currentTween = gsap.to(this.weights, {
      duration,
      ...targetWeights,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }

  /**
   * Calculates the combined vertex offset based on the active expression weights.
   */
  public getOffsetForVertex(v: FaceVertex): THREE.Vector3 {
    const totalOffset = new THREE.Vector3();

    if (this.weights.smile > 0.001) {
      totalOffset.addScaledVector(this.getSmileOffset(v), this.weights.smile);
    }
    if (this.weights.laugh > 0.001) {
      totalOffset.addScaledVector(this.getLaughOffset(v), this.weights.laugh);
    }
    if (this.weights.sad > 0.001) {
      totalOffset.addScaledVector(this.getSadOffset(v), this.weights.sad);
    }
    if (this.weights.angry > 0.001) {
      totalOffset.addScaledVector(this.getAngryOffset(v), this.weights.angry);
    }
    if (this.weights.surprise > 0.001) {
      totalOffset.addScaledVector(this.getSurpriseOffset(v), this.weights.surprise);
    }
    if (this.weights.thinking > 0.001) {
      totalOffset.addScaledVector(this.getThinkingOffset(v), this.weights.thinking);
    }
    if (this.weights.confused > 0.001) {
      totalOffset.addScaledVector(this.getConfusedOffset(v), this.weights.confused);
    }
    if (this.weights.listening > 0.001) {
      totalOffset.addScaledVector(this.getListeningOffset(v), this.weights.listening);
    }

    return totalOffset;
  }

  // --- INDIVIDUAL EXPRESSION GEOMETRY OFFSETS ---

  private getSmileOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const yCenter = -0.33;
    const yDist = Math.abs(v.basePos.y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;

    if (isMouth) {
      const d = Math.abs(x);
      const signX = x >= 0 ? 1 : -1;
      
      // Pull corners outwards and upwards
      offset.x = signX * 0.12 * Math.exp(-Math.pow((d - 0.42) / 0.22, 2));
      offset.y = 0.08 * Math.exp(-Math.pow((d - 0.42) / 0.22, 2));
      
      // Curve upper/lower lips slightly upwards
      offset.y += 0.045 * (1.0 - Math.pow(x / 0.5, 2));
      offset.z = 0.02;
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    } else if (v.region === 'cheekL' || v.region === 'cheekR') {
      // Cheeks lift up and bunch forward slightly
      offset.y = 0.05;
      offset.z = 0.03;
    }
    return offset;
  }

  private getLaughOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const y = v.basePos.y;
    const yCenter = -0.33;
    const yDist = Math.abs(y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;

    if (isMouth) {
      const d = Math.abs(x);
      const signX = x >= 0 ? 1 : -1;
      
      // Wide mouth corners pull
      offset.x = signX * 0.16 * Math.exp(-Math.pow((d - 0.42) / 0.22, 2));
      offset.y = 0.11 * Math.exp(-Math.pow((d - 0.42) / 0.22, 2));
      
      // Open mouth vertically
      if (y >= yCenter) offset.y += 0.06;
      else offset.y -= 0.1;
      
      offset.z = 0.01;
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    } else if (v.region === 'cheekL' || v.region === 'cheekR') {
      offset.y = 0.07;
      offset.z = 0.04;
    } else if (v.region === 'eyeL' || v.region === 'eyeR') {
      // Squint/squeeze eyes slightly
      const signY = y >= 0.3 ? 1 : -1;
      offset.y = -signY * 0.03;
    } else if (v.region === 'chin') {
      offset.y = -0.05;
    }
    return offset;
  }

  private getSadOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const yCenter = -0.33;
    const yDist = Math.abs(v.basePos.y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;

    if (isMouth) {
      const d = Math.abs(x);
      const signX = x >= 0 ? 1 : -1;
      // Pull outer corners down
      offset.x = -signX * 0.02 * Math.exp(-Math.pow((d - 0.4) / 0.2, 2));
      offset.y = -0.1 * Math.exp(-Math.pow((d - 0.4) / 0.2, 2));
      offset.z = -0.01;
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    } else if (v.region === 'eyebrowL') {
      // Inner eyebrow raises, outer lowers (sad tilt)
      const d = x; // positive on left
      const raise = 0.065 * Math.exp(-Math.pow(d / 0.22, 2));
      const lower = -0.03 * Math.exp(-Math.pow((d - 0.45) / 0.2, 2));
      offset.y = raise + lower;
    } else if (v.region === 'eyebrowR') {
      const d = -x; // positive on right
      const raise = 0.065 * Math.exp(-Math.pow(d / 0.22, 2));
      const lower = -0.03 * Math.exp(-Math.pow((d - 0.45) / 0.2, 2));
      offset.y = raise + lower;
    }
    return offset;
  }

  private getAngryOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const y = v.basePos.y;
    const yCenter = -0.33;
    const yDist = Math.abs(y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;
    
    if (v.region === 'eyebrowL') {
      // Pull down and inwards (furrow)
      offset.x = -0.07;
      offset.y = -0.095;
      offset.z = 0.03;
    } else if (v.region === 'eyebrowR') {
      offset.x = 0.07;
      offset.y = -0.095;
      offset.z = 0.03;
    } else if (v.region === 'noseBridge' && v.basePos.y > 0.15) {
      // Wrinkle nose bridge slightly
      offset.y = 0.03;
      offset.z = 0.02;
    } else if (isMouth) {
      // Lips purse slightly
      const signX = x >= 0 ? 1 : -1;
      offset.x = -signX * 0.03;
      if (y >= yCenter) offset.y = -0.02;
      else offset.y = 0.02;
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    }
    return offset;
  }

  private getSurpriseOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const y = v.basePos.y;
    const x = v.basePos.x;
    const yCenter = -0.33;
    const yDist = Math.abs(y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;

    if (v.region.startsWith('eyebrow')) {
      // Raise eyebrows high
      offset.y = 0.13;
      offset.z = 0.015;
    } else if (isMouth) {
      if (y >= yCenter) {
        // Upper lip area
        offset.y = 0.09;
        offset.z = -0.04;
      } else {
        // Lower lip area
        offset.y = -0.18;
        offset.z = -0.04;
      }
      
      // Inner lip area
      if (yDist < 0.03) {
        offset.y = -0.04;
        offset.z = -0.07;
      }
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    } else if (v.region === 'eyeL' || v.region === 'eyeR') {
      // Widen eyelids
      const signY = y >= 0.3 ? 1 : -1;
      offset.y = signY * 0.045;
    } else if (v.region === 'chin') {
      offset.y = -0.09;
    }
    return offset;
  }

  private getThinkingOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const yCenter = -0.33;
    const yDist = Math.abs(v.basePos.y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;
    
    if (v.region === 'eyebrowL') {
      // Raise left brow
      offset.y = 0.08;
    } else if (v.region === 'eyebrowR') {
      // Furrow right brow
      offset.x = 0.03;
      offset.y = -0.06;
    } else if (isMouth) {
      // Pull mouth slightly to the right side
      offset.x = 0.06;
      offset.y = 0.02;
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    }
    return offset;
  }

  private getConfusedOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const yCenter = -0.33;
    const yDist = Math.abs(v.basePos.y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;

    if (v.region === 'eyebrowL') {
      // Furrow left
      offset.x = -0.04;
      offset.y = -0.05;
    } else if (v.region === 'eyebrowR') {
      // Raise right
      offset.y = 0.08;
    } else if (isMouth) {
      // Purse and tilt lips
      const signX = x >= 0 ? 1 : -1;
      offset.x = -signX * 0.05;
      offset.y = -0.03;
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    }
    return offset;
  }

  private getListeningOffset(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    const x = v.basePos.x;
    const y = v.basePos.y;
    const yCenter = -0.33;
    const yDist = Math.abs(y - yCenter);
    const isMouth = v.basePos.z > 0 && yDist < 0.20 && Math.abs(x) < 0.6;
    
    if (v.region.startsWith('eyebrow')) {
      // Soft, engaged brow lift
      offset.y = 0.035;
    } else if (isMouth) {
      // Slightly parted mouth
      if (y < yCenter) {
        offset.y = -0.035;
      }
      
      const falloff = Math.exp(-Math.pow(x / 0.35, 2.0)) * Math.exp(-Math.pow(yDist / 0.12, 2.0));
      offset.multiplyScalar(falloff);
    }
    return offset;
  }
}
