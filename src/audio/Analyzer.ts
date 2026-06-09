export class AudioAnalyzer {
  public audioContext: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  public volume = 0.0;
  public frequencies: number[] = [];
  
  private dataArray: Uint8Array = new Uint8Array(0);
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  constructor() {}

  /**
   * Initializes the AudioContext (must be triggered by a user interaction, e.g. click).
   */
  public init() {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.frequencies = new Array(bufferLength).fill(0);
    } catch (e) {
      console.error('Failed to initialize Web Audio API Analyser:', e);
    }
  }

  /**
   * Connects an HTMLAudioElement (e.g., played TTS sound) to the analyzer.
   */
  public connectAudioElement(audio: HTMLAudioElement) {
    if (!this.audioContext || !this.analyser) {
      this.init();
    }
    
    if (!this.audioContext || !this.analyser) return;

    // Disconnect old source node if it exists
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
    }

    try {
      this.sourceNode = this.audioContext.createMediaElementSource(audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      // In some environments, re-connecting an element can fail. Re-route directly.
      console.warn('Media element already connected or failed to connect:', e);
    }
  }

  /**
   * Connects microphone input to the analyzer.
   */
  public async connectMicrophone(): Promise<MediaStream | null> {
    if (!this.audioContext || !this.analyser) {
      this.init();
    }
    if (!this.audioContext || !this.analyser) return null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
      }

      this.micSourceNode = this.audioContext.createMediaStreamSource(stream);
      // Connect to analyser, but NOT to destination to prevent audio feedback loop (screeching)!
      this.micSourceNode.connect(this.analyser);
      return stream;
    } catch (e) {
      console.error('Error accessing microphone:', e);
      return null;
    }
  }

  public disconnectMicrophone() {
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      } catch (e) {}
    }
  }

  /**
   * Updates real-time FFT frequency data and RMS volume.
   */
  public update() {
    if (!this.analyser || !this.dataArray.length) {
      this.volume = 0;
      return;
    }

    // Retrieve frequency domain data
    this.analyser.getByteFrequencyData(this.dataArray as any);
    
    let sum = 0;
    const length = this.dataArray.length;
    
    for (let i = 0; i < length; i++) {
      const val = this.dataArray[i];
      // Store normalized frequency value (0 to 1)
      this.frequencies[i] = val / 255.0;
      sum += val * val;
    }
    
    // Root Mean Square (RMS) volume calculation
    const rms = Math.sqrt(sum / length);
    // Normalize volume between 0 and 1, applying a scale boost for responsiveness
    this.volume = Math.min(rms / 128.0, 1.0);
  }

  public resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
