import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FaceMesh } from '../avatar/FaceMesh';
import { Expressions } from '../avatar/Expressions';
import { EyeSystem } from '../avatar/EyeSystem';
import { HeadSystem } from '../avatar/HeadSystem';
import { LipSync } from '../avatar/LipSync';
import type { VisemeType } from '../avatar/LipSync';
import { BloomEffect } from '../effects/bloomEffect';
import { AudioAnalyzer } from '../audio/Analyzer';
import { VisemeMapper } from '../audio/VisemeMapper';
import type { VisemeFrame } from '../audio/VisemeMapper';
import { WebSpeechTTSEngine, HuggingFaceTTSEngine } from '../audio/TTS';
import type { ITTSEngine } from '../audio/TTS';
import { GeminiAI } from '../ai/Gemini';

export class App {
  // Three.js Core
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private clock = new THREE.Clock();
  
  // WebGL Fallback Settings
  private isWebGL = true;
  private canvas2d: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private cameraRotX = 0.0;
  private cameraRotY = 0.0;
  private cameraZoom = 1.0;
  
  // Custom Modules
  private faceMesh!: FaceMesh;
  private expressions!: Expressions;
  private eyeSystem!: EyeSystem;
  private headSystem!: HeadSystem;
  private lipSync!: LipSync;
  private bloomEffect!: BloomEffect;
  private analyzer!: AudioAnalyzer;
  private visemeMapper!: VisemeMapper;
  private ttsEngine!: ITTSEngine;
  private geminiAI!: GeminiAI;
  
  // Microphone & Speech Recognition
  private micStream: MediaStream | null = null;
  private recognition: any = null;
  private isListeningSpeech = false;
  
  // Scene Groups and Objects
  private faceGroup!: THREE.Group;
  private pointCloud!: THREE.Points;
  private lineSegments!: THREE.LineSegments;
  private pupilL!: THREE.Mesh;
  private pupilR!: THREE.Mesh;
  
  // Material Uniforms
  private pointUniforms!: any;
  private lineUniforms!: any;
  
  // Mouse Gaze Tracking
  private mouse = new THREE.Vector2();
  private mouse3D = new THREE.Vector3(0, 0, 4);
  private isMouseActive = false;
  private mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3); // plane at z=3
  private raycaster = new THREE.Raycaster();
  private lastMouseMoveTime = 0;
  
  // Lip Sync Queues
  private visemeQueue: VisemeFrame[] = [];
  
  // Audio visualizer bars
  private visualizerBars: HTMLDivElement[] = [];
  private vibrationBars: HTMLDivElement[] = [];

  constructor() {
    this.initThree();
    this.initAvatar();
    this.initAudioAndAI();
    this.initSpeechRecognition();
    this.setupUI();
    this.setupResize();
    this.setupMouseTracking();
    this.animate();
    
    console.log('Neural Avatar AI App orchestrator successfully initialized.');
  }

  private initThree() {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    this.canvas2d = canvas;
    
    try {
      // 1. Attempt to initialize WebGL Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      // Scene
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x03030f, 0.08);

      // Camera
      this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20);
      this.camera.position.set(0, 0, 3.8);

      // Orbit Controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 2.0;
      this.controls.maxDistance = 6.0;
      this.controls.enablePan = false; // keep centered on face
      
      // Post Processing (Unreal Bloom)
      this.bloomEffect = new BloomEffect(this.renderer, this.scene, this.camera);
      
      // Lights
      const ambientLight = new THREE.AmbientLight(0x00a8ff, 0.4);
      this.scene.add(ambientLight);
      
      const spotLight = new THREE.SpotLight(0xff00ff, 2.0, 10, 0.5, 1);
      spotLight.position.set(2, 4, 3);
      this.scene.add(spotLight);
      
      this.isWebGL = true;
    } catch (e) {
      console.warn('WebGL Context creation failed. Falling back to custom 2D Canvas 3D Engine:', e);
      this.isWebGL = false;
      this.ctx2d = canvas.getContext('2d');
      
      // Set initial dimensions
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      this.setup2DCanvasControls();
    }
  }

  /**
   * Mouse Orbit Controls implementation for the 2D Canvas 3D render fallback.
   */
  private setup2DCanvasControls() {
    if (!this.canvas2d) return;
    
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    this.canvas2d.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Rotate camera around center of face
      this.cameraRotY += dx * 0.007;
      this.cameraRotX = THREE.MathUtils.clamp(this.cameraRotX + dy * 0.007, -1.2, 1.2);
      
      startX = e.clientX;
      startY = e.clientY;
    });
    
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    this.canvas2d.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Zoom factor clamp
      this.cameraZoom = THREE.MathUtils.clamp(this.cameraZoom - e.deltaY * 0.001, 0.4, 2.5);
    }, { passive: false });
  }

  private initAvatar() {
    this.faceMesh = new FaceMesh();
    this.expressions = new Expressions();
    this.eyeSystem = new EyeSystem();
    this.headSystem = new HeadSystem();
    this.lipSync = new LipSync();
    
    this.faceGroup = new THREE.Group();
    this.scene.add(this.faceGroup);

    // Asynchronously trigger loading and rigging of extension.obj
    this.faceMesh.loadOBJModel('/extension.obj').then((eyeCenters) => {
      // 1. Dynamic calibration of pupil tracking
      this.eyeSystem.setEyeCenters(eyeCenters.eyeCenterL, eyeCenters.eyeCenterR);
      
      // 2. Swapping the scene mesh geometries to the loaded OBJ geometry
      this.pointCloud.geometry = this.faceMesh.geometry;
      this.lineSegments.geometry = this.faceMesh.geometry;
      
      console.log("App: Custom OBJ model successfully loaded, calibrated, and rigged.");
    });
    
    // Shaders uniforms
    this.pointUniforms = {
      time: { value: 0.0 },
      pointScale: { value: window.innerHeight / 720.0 * 24.0 }, // scale based on screen
      glowColor: { value: new THREE.Color(0x00f3ff) }
    };
    
    this.lineUniforms = {
      time: { value: 0.0 },
      lineColor: { value: new THREE.Color(0x0088ff) },
      volume: { value: 0.0 }
    };

    // 1. Point Cloud (Glowing Vertices)
    const pointTexture = this.createCircleTexture();
    const pointMat = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.008,
      map: pointTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true
    });
    this.pointCloud = new THREE.Points(this.faceMesh.geometry, pointMat);
    this.faceGroup.add(this.pointCloud);

    // 2. Line Mesh (Pulsing Grid Edges)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.lineSegments = new THREE.LineSegments(this.faceMesh.geometry, lineMat);
    this.faceGroup.add(this.lineSegments);

    // 3. Pupils (Separate glowing spherules)
    const pupilGeo = new THREE.SphereGeometry(0.014, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({
      color: 0x00dfff,
      transparent: true,
      opacity: 0.95
    });
    
    this.pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    this.pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    
    this.faceGroup.add(this.pupilL);
    this.faceGroup.add(this.pupilR);
  }

  private createCircleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Create tight, crisp radial gradient
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 14);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(0, 243, 255, 0.85)');
    grad.addColorStop(0.6, 'rgba(0, 243, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  private initAudioAndAI() {
    this.analyzer = new AudioAnalyzer();
    this.visemeMapper = new VisemeMapper();
    this.geminiAI = new GeminiAI();
    
    // Default TTS to Hugging Face synthesis
    this.ttsEngine = new HuggingFaceTTSEngine(this.analyzer);
  }

  private setupUI() {
    const exprButtons = document.querySelectorAll('.control-btn[data-expr]');
    exprButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from brothers
        exprButtons.forEach(b => b.classList.remove('active'));
        const targetBtn = e.currentTarget as HTMLButtonElement;
        targetBtn.classList.add('active');
        
        const exprName = targetBtn.getAttribute('data-expr') as any;
        this.expressions.transitionTo(exprName);
        
        // Tilt/nod head slightly based on expression change
        if (exprName === 'thinking' || exprName === 'confused') {
          this.headSystem.triggerShake();
        } else {
          this.headSystem.triggerNod();
        }
      });
    });

    // Voice Engine Swapping
    const selectTTS = document.getElementById('select-tts-mode') as HTMLSelectElement;
    const hfContainer = document.getElementById('hf-model-select-container') as HTMLDivElement;
    
    selectTTS.addEventListener('change', () => {
      this.ttsEngine.stop();
      if (selectTTS.value === 'webspeech') {
        this.ttsEngine = new WebSpeechTTSEngine();
        hfContainer.style.display = 'none';
      } else {
        const hfEngine = new HuggingFaceTTSEngine(this.analyzer);
        this.ttsEngine = hfEngine;
        hfContainer.style.display = 'block';
        
        const selectHF = document.getElementById('select-hf-model') as HTMLSelectElement;
        hfEngine.setModel(selectHF.value);
      }
    });

    const selectHF = document.getElementById('select-hf-model') as HTMLSelectElement;
    selectHF.addEventListener('change', () => {
      if (this.ttsEngine instanceof HuggingFaceTTSEngine) {
        this.ttsEngine.setModel(selectHF.value);
      }
    });

    // Initialize the default TTS selection state in the UI to HuggingFace
    if (selectTTS) {
      selectTTS.value = 'huggingface';
    }
    if (hfContainer) {
      hfContainer.style.display = 'block';
    }
    if (selectHF && this.ttsEngine instanceof HuggingFaceTTSEngine) {
      this.ttsEngine.setModel(selectHF.value);
    }

    // Stop Audio Button
    document.getElementById('btn-stop-audio')?.addEventListener('click', () => {
      this.ttsEngine.stop();
      this.visemeQueue = [];
      this.lipSync.setTargetViseme('neutral');
      this.expressions.transitionTo('neutral');
      
      const exprButtons = document.querySelectorAll('.control-btn[data-expr]');
      exprButtons.forEach(b => b.classList.remove('active'));
      document.getElementById('btn-expr-neutral')?.classList.add('active');
      this.updateSubtitle(false);
    });

    // Microphone Buttons Toggle (supporting both HUD and Chat input mic buttons)
    const btnMic = document.getElementById('btn-toggle-mic') as HTMLButtonElement;
    const btnChatMic = document.getElementById('btn-chat-mic') as HTMLButtonElement;
    
    const toggleMicrophone = async () => {
      this.analyzer.init();
      this.analyzer.resume();
      
      if (!this.micStream) {
        this.micStream = await this.analyzer.connectMicrophone();
        if (this.micStream) {
          if (btnMic) {
            btnMic.classList.add('active');
            btnMic.textContent = 'Mic On';
          }
          if (btnChatMic) {
            btnChatMic.classList.add('active');
          }
          this.expressions.transitionTo('listening');
          document.getElementById('system-status-dot')?.classList.add('listening');
          document.getElementById('status-text')!.textContent = 'LISTENING MIC';
          
          if (this.recognition) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn('SpeechRecognition start error:', e);
            }
          }
        }
      } else {
        this.stopMicrophone();
      }
    };

    btnMic?.addEventListener('click', toggleMicrophone);
    btnChatMic?.addEventListener('click', toggleMicrophone);

    // Send Chat Message
    const chatInput = document.getElementById('user-chat-input') as HTMLInputElement;
    const btnSend = document.getElementById('btn-send-message') as HTMLButtonElement;
    
    const sendMessage = async () => {
      const text = chatInput.value.trim();
      if (!text) return;
      
      chatInput.value = '';
      await this.processUserQuery(text);
    };

    btnSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Add audio visualizer HUD bars dynamically
    const visualizerContainer = document.getElementById('visualizer-bars');
    if (visualizerContainer) {
      // Generate 24 visualizer bars
      for (let i = 0; i < 24; i++) {
        const bar = document.createElement('div');
        bar.className = 'visualizer-bar';
        visualizerContainer.appendChild(bar);
        this.visualizerBars.push(bar);
      }
    }

    // Add voice vibration panel bars dynamically
    const vibrationContainer = document.getElementById('voice-vibration-panel');
    if (vibrationContainer) {
      // Generate 20 vibration bars
      for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'vibration-bar';
        vibrationContainer.appendChild(bar);
        this.vibrationBars.push(bar);
      }
    }
  }

  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API is not supported in this browser.');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      this.isListeningSpeech = true;
      console.log('Speech recognition started...');
    };
    
    this.recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Speech recognition result:', transcript);
      
      if (transcript && transcript.trim()) {
        const text = transcript.trim();
        // Stop microphone listening mode (UI cleanup)
        this.stopMicrophone();
        
        // Send query to Gemini and speak response
        await this.processUserQuery(text);
      }
    };
    
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.stopMicrophone();
    };
    
    this.recognition.onend = () => {
      this.isListeningSpeech = false;
      console.log('Speech recognition ended.');
    };
  }

  private stopMicrophone() {
    const btnMic = document.getElementById('btn-toggle-mic') as HTMLButtonElement;
    const btnChatMic = document.getElementById('btn-chat-mic') as HTMLButtonElement;
    if (this.micStream) {
      this.analyzer.disconnectMicrophone();
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.recognition && this.isListeningSpeech) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    if (btnMic) {
      btnMic.classList.remove('active');
      btnMic.textContent = 'Microphone';
    }
    if (btnChatMic) {
      btnChatMic.classList.remove('active');
    }
    this.expressions.transitionTo('neutral');
    const statusDot = document.getElementById('system-status-dot');
    const statusText = document.getElementById('status-text');
    if (statusDot) statusDot.classList.remove('listening');
    if (statusText) statusText.textContent = 'SYSTEM ACTIVE';
  }

  private async processUserQuery(text: string) {
    if (!text.trim()) return;
    
    // Append user's transcript to chat
    this.appendChatMessage('user', text);
    
    // Unlock AudioContext if not unlocked
    this.analyzer.init();
    this.analyzer.resume();
    
    // Update HUD Status
    const statusDot = document.getElementById('system-status-dot');
    const statusText = document.getElementById('status-text');
    
    if (statusText) statusText.textContent = 'THINKING...';
    this.expressions.transitionTo('thinking', 0.8);
    
    // Query Gemini
    const reply = await this.geminiAI.sendMessage(text);
    this.appendChatMessage('avatar', reply);
    
    if (statusText) statusText.textContent = 'SPEAKING...';
    if (statusDot) statusDot.classList.add('speaking');
    this.expressions.transitionTo('smile', 0.6);
    
    // Play speech
    this.updateSubtitle(true, reply);
    
    try {
      this.visemeQueue = []; // clear old queue
      await this.ttsEngine.speak(reply, (word, _charIndex, duration) => {
        // Sync Lip Sync visemes
        const startTime = performance.now();
        const wordFrames = this.visemeMapper.getVisemesForWord(word, startTime, duration);
        this.visemeQueue.push(...wordFrames);
        
        // Trigger a conversational head nod occasionally
        if (Math.random() < 0.28) {
          this.headSystem.triggerNod();
        }
      });
    } catch (err) {
      console.error('TTS Playback failed:', err);
    } finally {
      // Return to normal
      if (statusDot) statusDot.classList.remove('speaking');
      if (statusText) statusText.textContent = 'SYSTEM ACTIVE';
      this.visemeQueue = [];
      this.lipSync.setTargetViseme('neutral');
      this.expressions.transitionTo('neutral', 1.0);
      this.updateSubtitle(false);
    }
  }

  private appendChatMessage(sender: 'user' | 'avatar', text: string) {
    const chatHistory = document.getElementById('chat-messages') as HTMLDivElement;
    const msg = document.createElement('div');
    msg.className = `message ${sender}`;
    
    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = sender === 'user' ? 'Operator' : 'Neural Avatar AI';
    
    msg.appendChild(label);
    msg.appendChild(document.createTextNode(text));
    
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  private updateSubtitle(visible: boolean, text: string = '') {
    const panel = document.getElementById('speech-subtitles') as HTMLDivElement;
    const txt = document.getElementById('subtitles-text') as HTMLParagraphElement;
    const speakingInd = document.getElementById('speaking-indicator') as HTMLDivElement;
    
    if (visible && text) {
      txt.textContent = text;
      panel.classList.add('active');
      speakingInd.classList.add('active');
    } else {
      panel.classList.remove('active');
      speakingInd.classList.remove('active');
    }
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      if (this.isWebGL) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.bloomEffect.setSize(window.innerWidth, window.innerHeight);
      } else if (this.canvas2d) {
        this.canvas2d.width = window.innerWidth;
        this.canvas2d.height = window.innerHeight;
      }
      
      // Update shader scale ratio
      this.pointUniforms.pointScale.value = window.innerHeight / 720.0 * 24.0;
    });
  }

  private setupMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      this.lastMouseMoveTime = Date.now();
      this.isMouseActive = true;
      
      // Normalized coordinates
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      
      // Raycast onto virtual plane in front of face
      this.raycaster.setFromCamera(this.mouse, this.camera);
      this.raycaster.ray.intersectPlane(this.mousePlane, this.mouse3D);
    });
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    const dt = Math.min(this.clock.getDelta(), 0.1); // Clamp delta
    const time = this.clock.getElapsedTime();
    
    // 1. Check mouse tracking activity timeout (if mouse static for 5 seconds, drop tracking)
    if (this.isMouseActive && Date.now() - this.lastMouseMoveTime > 5000) {
      this.isMouseActive = false;
    }
    
    // 2. Audio Analyzer updates
    this.analyzer.update();
    const volume = this.analyzer.volume;
    
    // Map frequency data to HUD visualizer bars
    if (this.visualizerBars.length && this.analyzer.frequencies.length) {
      const freqLength = this.analyzer.frequencies.length;
      for (let i = 0; i < this.visualizerBars.length; i++) {
        const freqIdx = Math.floor((i / this.visualizerBars.length) * (freqLength * 0.7));
        const freqVal = this.analyzer.frequencies[freqIdx] || 0.0;
        const heightVal = Math.max(2, freqVal * 38);
        this.visualizerBars[i].style.height = `${heightVal}px`;
      }
    }

    // Map frequency data to Voice Vibration Dashboard bars symmetrically
    if (this.vibrationBars.length && this.analyzer.frequencies.length) {
      const freqLength = this.analyzer.frequencies.length;
      const isTransmitting = this.ttsEngine.isPlaying();
      const multiplier = isTransmitting ? 55.0 : 15.0; // Bouncy when active, subtle idle noise otherwise
      
      for (let i = 0; i < this.vibrationBars.length; i++) {
        // Symmetrical index mapping (peaking in the middle, tapering at edges)
        const symIdx = Math.round(9.5 - Math.abs(i - 9.5)); // maps 0..19 to 0..9
        const freqIdx = Math.floor((symIdx / 10) * (freqLength * 0.5));
        
        let freqVal = this.analyzer.frequencies[freqIdx] || 0.0;
        
        if (this.ttsEngine.isPlaying() && volume < 0.01) {
          // Procedural bounce when TTS is playing but not routed to analyzer (e.g. browser Web Speech synthesis)
          const wordFactor = 0.25 + Math.sin(time * 12.0) * 0.15;
          const barFactor = (10 - symIdx) / 10;
          freqVal = wordFactor * barFactor * (0.8 + Math.sin(time * 15.0 + i) * 0.2);
        } else if (!isTransmitting) {
          // Add a bit of natural idle jitter if not transmitting
          freqVal = 0.02 + Math.sin(time * 8.0 + i) * 0.01;
        }
        
        const heightVal = Math.max(4, freqVal * multiplier);
        this.vibrationBars[i].style.height = `${heightVal}px`;
      }
    }
    
    // 3. Lip Sync logic
    let activeVolume = volume;
    if (this.ttsEngine.isPlaying() && volume < 0.01) {
      // Simulate volume modulation during browser speech synthesis (which doesn't route to AudioContext)
      activeVolume = 0.25 + Math.sin(time * 12.0) * 0.15;
    }
    this.lipSync.update(dt, activeVolume);
    
    const now = performance.now();
    this.visemeQueue = this.visemeQueue.filter(f => now < f.time + f.duration);
    const activeFrame = this.visemeQueue.find(f => now >= f.time && now < f.time + f.duration);
    
    if (activeFrame) {
      this.lipSync.setTargetViseme(activeFrame.viseme);
    } else {
      if (this.ttsEngine.isPlaying()) {
        const visemeList: VisemeType[] = ['A', 'E', 'O', 'I'];
        const selected = visemeList[Math.floor(time * 8.0) % visemeList.length];
        this.lipSync.setTargetViseme(selected);
      } else {
        this.lipSync.setTargetViseme('neutral');
      }
    }
    
    // 4. Update head/eye subsystems
    this.eyeSystem.update(dt, this.mouse3D, this.isMouseActive);
    this.headSystem.update(dt, this.mouse3D, this.isMouseActive);
    
    // 5. Morph calculations (combined expressions + eyelids + mouth shapes)
    const vertexCount = this.faceMesh.getVertexCount();
    const offsets: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    
    const baseColor = new THREE.Color(0x00f3ff);
    
    for (let i = 0; i < vertexCount; i++) {
      const v = this.faceMesh.vertices[i];
      
      const offset = new THREE.Vector3();
      offset.add(this.expressions.getOffsetForVertex(v));
      offset.add(this.eyeSystem.getOffsetForVertex(v));
      offset.add(this.lipSync.getOffsetForVertex(v));
      
      // Neural mesh expansion based on audio volume (disabled as requested)
      // if (volume > 0.05) {
      //   offset.addScaledVector(v.basePos.clone().normalize(), volume * v.sizeModifier * 0.07);
      // }
      
      offsets.push(offset);
      // Keep vertex color intensity consistent (no wave animation, no volume fluctuation)
      let intensity = 0.95;
      intensity = THREE.MathUtils.clamp(intensity, 0.8, 1.5);
      
      const color = baseColor.clone();
      if (v.basePos.z < 0) {
        const backRatio = Math.min(1.0, -v.basePos.z / 0.8);
        color.lerp(new THREE.Color(0xb500ff), backRatio * 0.65);
        intensity *= (1.0 - backRatio * 0.4);
      }
      
      color.multiplyScalar(intensity);
      colors.push(color);
    }
    
    // Update geometry buffer (updates v.currentPos internally)
    this.faceMesh.updateGeometry(offsets, colors);
    
    if (this.isWebGL) {
      // --- WebGL Render Chain ---
      this.pointUniforms.time.value = time;
      this.lineUniforms.time.value = time;
      this.lineUniforms.volume.value = volume;
      
      this.bloomEffect.setStrength(1.3);
      
      // Place pupil meshes
      this.pupilL.position.copy(this.eyeSystem.pupilLPosition);
      this.pupilR.position.copy(this.eyeSystem.pupilRPosition);
      
      // Rotate/position the entire face group
      this.faceGroup.rotation.copy(this.headSystem.rotation);
      this.faceGroup.position.copy(this.headSystem.position);
      
      this.controls.update();
      this.bloomEffect.render();
    } else {
      // --- 2D Canvas 3D Render Fallback ---
      this.render2D(time);
    }
  };

  /**
   * Fallback 3D-to-2D Perspective Projection Renderer using standard HTML5 Canvas 2D.
   * Runs at a fluid 60FPS even when browser WebGL acceleration is completely disabled.
   */
  private render2D(time: number) {
    if (!this.ctx2d || !this.canvas2d) return;
    const ctx = this.ctx2d;
    const w = this.canvas2d.width;
    const h = this.canvas2d.height;
    
    // Clear canvas
    ctx.fillStyle = '#03030f';
    ctx.fillRect(0, 0, w, h);
    
    const vertexCount = this.faceMesh.getVertexCount();
    const projected: { x: number; y: number; z: number; visible: boolean }[] = [];
    
    const d = 3.6; // camera distance
    const scale = Math.min(w, h) * 0.46 * this.cameraZoom;
    
    // Project vertices
    for (let i = 0; i < vertexCount; i++) {
      const v = this.faceMesh.vertices[i];
      const pos = v.currentPos.clone();
      
      // Apply Head Rotations (breathing, tracking)
      pos.applyEuler(this.headSystem.rotation);
      pos.add(this.headSystem.position);
      
      // Apply Camera Orbit Rotations
      pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotY);
      pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraRotX);
      
      const zDepth = d - pos.z;
      const visible = zDepth > 0.15;
      
      const px = (pos.x / zDepth) * scale + w / 2;
      const py = (-pos.y / zDepth) * scale + h / 2;
      
      projected.push({ x: px, y: py, z: pos.z, visible });
    }
    
    // 1. Draw Connecting Lines
    // If the OBJ is loaded, we use the downsampled lines list to keep fallback rendering CPU cycles low.
    const indices = this.faceMesh.isOBJLoaded 
      ? this.faceMesh.downsampledLineIndices 
      : (this.faceMesh.geometry.index?.array as any);
      
    if (indices) {
      ctx.beginPath();
      ctx.lineWidth = 0.55;
      const maxLineDist = Math.min(w, h) * 0.35;
      
      for (let i = 0; i < indices.length; i += 2) {
        const idxA = indices[i];
        const idxB = indices[i + 1];
        
        const pA = projected[idxA];
        const pB = projected[idxB];
        
        if (pA.visible && pB.visible) {
          const dist = Math.hypot(pA.x - pB.x, pA.y - pB.y);
          if (dist > maxLineDist) continue;
          
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
        }
      }
      
      // Pulsing grid line style
      const pulse = Math.sin(time * 3.5) * 0.12 + 0.38;
      const opacity = pulse;
      ctx.strokeStyle = `rgba(0, 132, 255, ${opacity * 0.42})`;
      ctx.stroke();
    }
    
    // 2. Draw Glowing Particles (Dual-Layer Glow - Reduced size to match WebGL)
    for (let i = 0; i < vertexCount; i += 2) { // Downsample points by half in 2D fallback for performance
      const p = projected[i];
      if (!p.visible) continue;
      
      const v = this.faceMesh.vertices[i];
      const zDepth = d - v.currentPos.z;
      const rSize = (v.sizeModifier * 0.45) / zDepth;
      
      // Stable particle brightness
      let intensity = 0.85;
      intensity = THREE.MathUtils.clamp(intensity, 0.7, 1.0);
      
      // A. Layer 1: Outer glow halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, rSize * 0.6), 0, Math.PI * 2);
      if (v.basePos.z < 0) {
        ctx.fillStyle = `rgba(180, 0, 255, ${intensity * 0.1})`;
      } else {
        ctx.fillStyle = `rgba(0, 240, 255, ${intensity * 0.15})`;
      }
      ctx.fill();
      
      // B. Layer 2: Inner solid core (white-hot center)
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.3, rSize * 0.25), 0, Math.PI * 2);
      if (v.basePos.z < 0) {
        ctx.fillStyle = `rgba(225, 175, 255, ${intensity})`;
      } else {
        ctx.fillStyle = `rgba(235, 253, 255, ${intensity})`;
      }
      ctx.fill();
    }
    
    // 3. Draw Pupils (Tracking lookAt indicators)
    const pupils = [
      { pos: this.eyeSystem.pupilLPosition.clone(), col: '#00f3ff' },
      { pos: this.eyeSystem.pupilRPosition.clone(), col: '#00f3ff' }
    ];
    
    pupils.forEach(pupil => {
      const pos = pupil.pos;
      pos.applyEuler(this.headSystem.rotation);
      pos.add(this.headSystem.position);
      pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotY);
      pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraRotX);
      
      const zDepth = d - pos.z;
      if (zDepth > 0.15) {
        const px = (pos.x / zDepth) * scale + w / 2;
        const py = (-pos.y / zDepth) * scale + h / 2;
        const rSize = 3.6 / zDepth;
        
        ctx.beginPath();
        ctx.arc(px, py, rSize, 0, Math.PI * 2);
        ctx.fillStyle = pupil.col;
        ctx.fill();
        
        // Pupil glow ring
        ctx.beginPath();
        ctx.arc(px, py, 9.5 / zDepth, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 243, 255, 0.16)';
        ctx.fill();
      }
    });
  }
}
