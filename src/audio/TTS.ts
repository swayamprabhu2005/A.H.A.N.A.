import { AudioAnalyzer } from './Analyzer';

export interface ITTSEngine {
  speak(text: string, onWordBoundary?: (word: string, charIndex: number, duration: number) => void): Promise<void>;
  stop(): void;
  isPlaying(): boolean;
}

export class WebSpeechTTSEngine implements ITTSEngine {
  private utterance: SpeechSynthesisUtterance | null = null;
  private playing = false;

  constructor() {}

  public speak(
    text: string,
    onWordBoundary?: (word: string, charIndex: number, duration: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop();
      
      this.utterance = new SpeechSynthesisUtterance(text);
      this.playing = true;

      // Select a decent English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                           voices.find(v => v.lang.startsWith('en')) || 
                           voices[0];
      
      if (englishVoice) {
        this.utterance.voice = englishVoice;
      }
      
      this.utterance.rate = 1.0;
      this.utterance.pitch = 1.0;

      this.utterance.onend = () => {
        this.playing = false;
        resolve();
      };

      this.utterance.onerror = (e) => {
        this.playing = false;
        if (e.error !== 'interrupted') {
          reject(e);
        } else {
          resolve();
        }
      };

      this.utterance.onboundary = (event) => {
        if (event.name === 'word' && onWordBoundary) {
          const charIndex = event.charIndex;
          // Extract the word being spoken
          const remainingText = text.slice(charIndex);
          const nextSpace = remainingText.indexOf(' ');
          const word = nextSpace === -1 ? remainingText : remainingText.slice(0, nextSpace);
          
          // Estimate word speaking duration based on length (average 350ms)
          const duration = Math.max(150, word.length * 55);
          onWordBoundary(word, charIndex, duration);
        }
      };

      window.speechSynthesis.speak(this.utterance);
    });
  }

  public stop() {
    if (this.playing) {
      window.speechSynthesis.cancel();
      this.playing = false;
    }
  }

  public isPlaying(): boolean {
    return this.playing;
  }
}

export class HuggingFaceTTSEngine implements ITTSEngine {
  private audio: HTMLAudioElement | null = null;
  private playing = false;
  private fallbackEngine: WebSpeechTTSEngine | null = null;
  private modelUrl = 'https://api-inference.huggingface.co/models/facebook/mms-tts-eng'; // Default lightweight model
  private apiToken = process.env.HF_TOKEN || ''; // Loaded from environment configuration
  private analyzer: AudioAnalyzer;

  constructor(analyzer: AudioAnalyzer) {
    this.analyzer = analyzer;
  }

  public setApiToken(token: string) {
    this.apiToken = token;
  }

  public setModel(modelName: string) {
    // Allows swapping to other models: 'facebook/mms-tts-eng', 'microsoft/speecht5_tts', etc.
    this.modelUrl = `https://api-inference.huggingface.co/models/${modelName}`;
  }

  public async speak(
    text: string,
    onWordBoundary?: (word: string, charIndex: number, duration: number) => void
  ): Promise<void> {
    this.stop();
    this.playing = true;

    try {
      // If we don't have a token, we alert in console and fallback to a mock client-side synthesize
      // or try to fetch anonymously (HF inference API sometimes allows limited anonymous requests).
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      const response = await fetch(this.modelUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: text })
      });

      if (!response.ok) {
        throw new Error(`HF TTS request failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      this.audio = new Audio(audioUrl);
      this.audio.crossOrigin = 'anonymous';
      
      // Connect audio element to Web Audio analyzer for real-time mesh mouth reacts
      this.analyzer.connectAudioElement(this.audio);

      return new Promise((resolve) => {
        if (!this.audio) return resolve();

        this.audio.onplay = () => {
          // Trigger estimated boundary events sequentially for lip sync
          this.playEstimatedBoundaries(text, onWordBoundary);
        };

        this.audio.onended = () => {
          this.playing = false;
          resolve();
        };

        this.audio.onerror = () => {
          this.playing = false;
          resolve();
        };

        this.audio.play();
      });
    } catch (e) {
      console.warn('Hugging Face TTS error, falling back to Web Speech API:', e);
      this.playing = false;
      // Fallback to Web Speech Synthesis so the user gets a working app
      this.fallbackEngine = new WebSpeechTTSEngine();
      return this.fallbackEngine.speak(text, onWordBoundary);
    }
  }

  /**
   * Helper that estimates word timelines and fires word boundary callbacks in sync with audio play.
   */
  private playEstimatedBoundaries(
    text: string,
    onWordBoundary?: (word: string, charIndex: number, duration: number) => void
  ) {
    if (!onWordBoundary || !this.audio) return;
    
    const words = text.split(/\s+/);
    const totalDuration = (this.audio.duration || text.length * 0.06) * 1000; // ms
    const totalChars = text.length;
    
    let charAccumulator = 0;
    
    words.forEach((word) => {
      if (!word.length) return;
      
      // Calculate fraction of total audio duration for this word
      const wordRatio = word.length / totalChars;
      const wordDuration = Math.max(150, totalDuration * wordRatio);
      const startDelay = (charAccumulator / totalChars) * totalDuration;
      
      const currentCharIndex = charAccumulator;
      setTimeout(() => {
        if (this.playing && this.audio && !this.audio.paused) {
          onWordBoundary(word, currentCharIndex, wordDuration);
        }
      }, startDelay);
      
      charAccumulator += word.length + 1; // +1 for space
    });
  }

  public stop() {
    this.playing = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    if (this.fallbackEngine) {
      this.fallbackEngine.stop();
      this.fallbackEngine = null;
    }
  }

  public isPlaying(): boolean {
    if (this.fallbackEngine) {
      return this.fallbackEngine.isPlaying();
    }
    return this.playing;
  }
}
