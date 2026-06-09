import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class BloomEffect {
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    // 1. Setup Render Pass (draws standard scene on composer target)
    const renderPass = new RenderPass(scene, camera);
    
    // 2. Setup Unreal Bloom Pass (creates volumetric sci-fi glow)
    // Args: resolution (Vector2), strength, radius, threshold
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(
      size,
      1.2,  // Bloom Strength (subtle, clean glow)
      0.55, // Bloom Radius (spread)
      0.08  // Bloom Threshold (glow only bright neon parts)
    );
    
    // 3. Bind to Composer
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
  }

  /**
   * Resizes the composer's render targets to match window dimensions.
   */
  public setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  /**
   * Triggers the composer rendering chain.
   */
  public render() {
    this.composer.render();
  }

  /**
   * Sets the bloom strength (can be automated to pulse with sound amplitudes).
   */
  public setStrength(strength: number) {
    this.bloomPass.strength = strength;
  }
}
