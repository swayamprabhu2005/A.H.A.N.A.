import * as THREE from 'three';
import { gsap } from 'gsap';

export class HeadSystem {
  public rotation = new THREE.Euler(0, 0, 0);
  public position = new THREE.Vector3(0, 0, 0);
  
  private targetRotation = new THREE.Euler(0, 0, 0);
  private currentRotation = new THREE.Euler(0, 0, 0);
  
  private time = 0;
  private nodTimeline: gsap.core.Timeline | null = null;

  constructor() {}

  /**
   * Updates head rotation and position (breathing and cursor tracking).
   */
  public update(deltaTime: number, mousePos: THREE.Vector3, isMouseActive: boolean) {
    this.time += deltaTime;
    
    // 1. Idle Breathing Motion (slow, organic sine oscillations)
    const breathPos = Math.sin(this.time * 1.2) * 0.03; // vertical float
    const breathRotX = Math.sin(this.time * 1.2) * 0.012; // breathing tilt
    const breathRotY = Math.cos(this.time * 0.6) * 0.015; // slow drift left/right
    
    // 2. Head Tracking (look at cursor & translate position to follow cursor)
    const targetPos = new THREE.Vector3(0, 0, 0);
    if (isMouseActive) {
      // Scale down mouse coordinates for gentle head rotation
      this.targetRotation.y = THREE.MathUtils.clamp(mousePos.x * 0.28, -0.45, 0.45);
      this.targetRotation.x = THREE.MathUtils.clamp(-mousePos.y * 0.2, -0.3, 0.3);
      this.targetRotation.z = THREE.MathUtils.clamp(mousePos.x * 0.08, -0.12, 0.12);
      
      // Translate position to physically follow the mouse
      targetPos.x = THREE.MathUtils.clamp(mousePos.x * 0.55, -1.0, 1.0);
      targetPos.y = THREE.MathUtils.clamp(mousePos.y * 0.55, -0.8, 0.8) + breathPos;
    } else {
      // Idle return to center
      this.targetRotation.set(0, 0, 0);
      targetPos.y = breathPos;
    }
    
    // Smoothly interpolate current tracking rotation towards target
    const speed = isMouseActive ? 6.0 : 3.0;
    this.currentRotation.x = THREE.MathUtils.lerp(this.currentRotation.x, this.targetRotation.x, deltaTime * speed);
    this.currentRotation.y = THREE.MathUtils.lerp(this.currentRotation.y, this.targetRotation.y, deltaTime * speed);
    this.currentRotation.z = THREE.MathUtils.lerp(this.currentRotation.z, this.targetRotation.z, deltaTime * speed);
    
    // Smoothly interpolate position to track cursor
    const posSpeed = isMouseActive ? 5.0 : 2.5;
    this.position.lerp(targetPos, deltaTime * posSpeed);
    
    // 3. Combine tracking rotation + breathing rotation
    this.rotation.x = this.currentRotation.x + breathRotX;
    this.rotation.y = this.currentRotation.y + breathRotY;
    this.rotation.z = this.currentRotation.z;
  }

  /**
   * Triggers a lifelike head-nod sequence, used to emphasize speech or greet the user.
   */
  public triggerNod() {
    if (this.nodTimeline) {
      this.nodTimeline.kill();
    }
    
    this.nodTimeline = gsap.timeline();
    
    // Quick nod: down, slightly up, settle
    this.nodTimeline.to(this.currentRotation, {
      x: 0.12,
      duration: 0.2,
      ease: 'power1.out'
    }).to(this.currentRotation, {
      x: -0.06,
      duration: 0.25,
      ease: 'power1.inOut'
    }).to(this.currentRotation, {
      x: 0,
      duration: 0.2,
      ease: 'power1.inOut'
    });
  }

  /**
   * Triggers a subtle head shake (e.g. for confusion or thinking).
   */
  public triggerShake() {
    if (this.nodTimeline) {
      this.nodTimeline.kill();
    }
    
    this.nodTimeline = gsap.timeline();
    
    this.nodTimeline.to(this.currentRotation, {
      y: 0.1,
      duration: 0.15,
      ease: 'power1.out'
    }).to(this.currentRotation, {
      y: -0.1,
      duration: 0.2,
      ease: 'power1.inOut'
    }).to(this.currentRotation, {
      y: 0.06,
      duration: 0.15,
      ease: 'power1.inOut'
    }).to(this.currentRotation, {
      y: 0,
      duration: 0.15,
      ease: 'power1.inOut'
    });
  }
}
