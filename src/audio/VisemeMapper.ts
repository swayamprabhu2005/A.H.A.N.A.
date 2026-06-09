import type { VisemeType } from '../avatar/LipSync';

export interface VisemeFrame {
  time: number; // Start time in milliseconds
  duration: number; // Duration in milliseconds
  viseme: VisemeType;
}

export class VisemeMapper {
  constructor() {}

  /**
   * Maps a single character to its corresponding viseme.
   */
  public charToViseme(char: string): VisemeType {
    const c = char.toLowerCase();
    
    if (c === 'a') return 'A';
    if (c === 'o') return 'O';
    if (c === 'u') return 'U';
    if (c === 'e') return 'E';
    if (c === 'i' || c === 'y') return 'I';
    
    if ('mbp'.includes(c)) return 'M';
    if ('fv'.includes(c)) return 'F';
    if ('lrdtn'.includes(c)) return 'L';
    if ('sczxjgkquw'.includes(c)) return 'S';
    
    return 'neutral';
  }

  /**
   * Generates a timeline of viseme frames for a given word.
   * @param word The word being spoken.
   * @param startTime The start timestamp in milliseconds.
   * @param estimatedDuration The total estimated duration of the word in milliseconds.
   */
  public getVisemesForWord(word: string, startTime: number, estimatedDuration: number): VisemeFrame[] {
    const cleanWord = word.trim().replace(/[^a-zA-Z]/g, '');
    if (!cleanWord.length) {
      return [{ time: startTime, duration: estimatedDuration, viseme: 'neutral' }];
    }

    const frames: VisemeFrame[] = [];
    const charCount = cleanWord.length;
    const charDuration = estimatedDuration / charCount;

    for (let i = 0; i < charCount; i++) {
      const char = cleanWord[i];
      const viseme = this.charToViseme(char);
      
      frames.push({
        time: startTime + i * charDuration,
        duration: charDuration,
        viseme
      });
    }

    // Smooth out redundant consecutive visemes to prevent jitter
    const smoothedFrames: VisemeFrame[] = [];
    let currentFrame = frames[0];

    for (let i = 1; i < frames.length; i++) {
      const nextFrame = frames[i];
      if (nextFrame.viseme === currentFrame.viseme) {
        // Extend duration of current frame
        currentFrame.duration += nextFrame.duration;
      } else {
        smoothedFrames.push(currentFrame);
        currentFrame = nextFrame;
      }
    }
    smoothedFrames.push(currentFrame);

    return smoothedFrames;
  }

  /**
   * Creates a full-sentence viseme timeline.
   * @param text The sentence to speak.
   * @param totalDuration The estimated total duration of the sentence in milliseconds.
   */
  public getVisemesForSentence(text: string, totalDuration: number): VisemeFrame[] {
    const words = text.split(/\s+/);
    const validWords = words.filter(w => w.length > 0);
    if (!validWords.length) return [];

    const totalChars = validWords.reduce((sum, w) => sum + w.length, 0);
    const msPerChar = totalDuration / (totalChars + validWords.length * 2); // account for word gaps

    const timeline: VisemeFrame[] = [];
    let currentTime = 0;

    for (const word of validWords) {
      const wordChars = word.length;
      const wordDuration = wordChars * msPerChar;
      
      const wordFrames = this.getVisemesForWord(word, currentTime, wordDuration);
      timeline.push(...wordFrames);

      currentTime += wordDuration;
      
      // Add a brief neutral pause between words
      const pauseDuration = msPerChar * 2;
      timeline.push({
        time: currentTime,
        duration: pauseDuration,
        viseme: 'neutral'
      });
      currentTime += pauseDuration;
    }

    return timeline;
  }
}
