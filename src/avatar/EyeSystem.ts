import * as THREE from 'three';
import type { FaceVertex } from './FaceMesh';

export class EyeSystem {
  public blinkProgress = 0.0;
  public pupilLPosition = new THREE.Vector3(0.36, 0.3, 0.02);
  public pupilRPosition = new THREE.Vector3(-0.36, 0.3, 0.02);
  
  private targetGaze = new THREE.Vector3(0, 0, 4); // Points forward initially
  private currentGaze = new THREE.Vector3(0, 0, 4);
  
  private eyeCenterL = new THREE.Vector3(0.21, 0.20, 0.65);
  private eyeCenterR = new THREE.Vector3(-0.21, 0.20, 0.65);
  private eyeRadius = 0.045; // Orbit radius of pupils
  
  private saccadeTimer = 0;

  constructor() {
  }

  /**
   * Dynamically calibrates eye tracking centers based on loaded 3D mesh eye region vertices.
   */
  public setEyeCenters(centerL: THREE.Vector3, centerR: THREE.Vector3) {
    this.eyeCenterL.copy(centerL);
    this.eyeCenterR.copy(centerR);
    this.pupilLPosition.copy(centerL).add(new THREE.Vector3(0, 0, 0.002));
    this.pupilRPosition.copy(centerR).add(new THREE.Vector3(0, 0, 0.002));
    
    // Scale pupil orbit radius to a small, natural amount to keep them in sockets
    const dist = centerL.distanceTo(centerR);
    this.eyeRadius = Math.max(0.008, dist * 0.022);
    console.log(`EyeSystem calibrated: Left Eye=${centerL.toArray().map(v=>v.toFixed(3))}, Right Eye=${centerR.toArray().map(v=>v.toFixed(3))}, Radius=${this.eyeRadius.toFixed(4)}`);
  }


  /**
   * Main update loop for blinking timers and random idle eye movements (saccades).
   */
  public update(deltaTime: number, mousePos: THREE.Vector3, isMouseActive: boolean) {
    // 1. Natural Blinking (Disabled as requested)
    this.blinkProgress = 0.0;
    
    // 2. Eye Focus and Tracking
    if (isMouseActive) {
      // Look at mouse
      this.targetGaze.copy(mousePos);
    } else {
      // Idle random gaze drift (saccades)
      this.saccadeTimer -= deltaTime;
      if (this.saccadeTimer <= 0) {
        // Look at a new random point in front of the face
        this.targetGaze.set(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.2 + 0.3,
          2.0 + Math.random() * 2.0
        );
        this.saccadeTimer = 1.0 + Math.random() * 3.0; // New gaze every 1-4 seconds
      }
    }
    
    // Smoothly interpolate current gaze towards target
    const speed = isMouseActive ? 8.0 : 4.0;
    this.currentGaze.lerp(this.targetGaze, deltaTime * speed);
    
    // 3. Compute Pupil Positions
    this.updatePupils();
  }

  public triggerBlink() {
    this.blinkProgress = 0.0;
  }

  private updatePupils() {
    // Left eye gaze direction
    const dirL = new THREE.Vector3().subVectors(this.currentGaze, this.eyeCenterL).normalize();
    // Offset pupil from eye center along the gaze vector, capped by eye radius
    this.pupilLPosition.copy(this.eyeCenterL).addScaledVector(dirL, this.eyeRadius);
    // Move pupil slightly forward to sit on the surface
    this.pupilLPosition.z += 0.002;

    // Right eye gaze direction
    const dirR = new THREE.Vector3().subVectors(this.currentGaze, this.eyeCenterR).normalize();
    this.pupilRPosition.copy(this.eyeCenterR).addScaledVector(dirR, this.eyeRadius);
    this.pupilRPosition.z += 0.002;
  }

  /**
   * Modifies the eyelid vertices of the FaceMesh to close the eyes.
   */
  public getOffsetForVertex(v: FaceVertex): THREE.Vector3 {
    const offset = new THREE.Vector3();
    
    if (v.region === 'eyeL' && this.blinkProgress > 0.001) {
      const distY = v.basePos.y - this.eyeCenterL.y;
      // Pull eyelid vertices vertically toward the center of the eye
      offset.y = -distY * this.blinkProgress * 0.95;
      // Push slightly backward when closed
      offset.z = -0.02 * this.blinkProgress;
    } else if (v.region === 'eyeR' && this.blinkProgress > 0.001) {
      const distY = v.basePos.y - this.eyeCenterR.y;
      offset.y = -distY * this.blinkProgress * 0.95;
      offset.z = -0.02 * this.blinkProgress;
    }
    
    return offset;
  }
}
