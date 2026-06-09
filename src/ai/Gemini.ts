import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiAI {
  private genAI: GoogleGenerativeAI | null = null;
  private chatSession: any = null;

  constructor() {
    // Attempt to load the key from either Vite's custom define wrapper or environment imports
    let apiKey = '';
    try {
      apiKey = process.env.GEMINI_KEY || '';
    } catch (e) {
      // process is not defined globally
    }
    if (!apiKey) {
      apiKey = (import.meta as any).env?.VITE_GEMINI_KEY || '';
    }
    
    if (apiKey && apiKey !== 'undefined' && apiKey.trim() !== '') {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.initChat();
      } catch (e) {
        console.error('Failed to initialize GoogleGenerativeAI client:', e);
      }
    } else {
      console.warn(
        'Gemini API key (GEMINI_KEY) is missing. The chatbot will run in simulation mode.'
      );
    }
  }

  private initChat() {
    if (!this.genAI) return;
    
    // Using gemini-2.5-flash for fast response times suitable for voice chat
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are Neural Avatar AI, a futuristic holographic AI assistant. Your interface is a glowing 3D wireframe mesh. Keep your responses short, natural, and friendly (1-2 sentences maximum). Always maintain a helpful, smart, and slightly cybernetic persona.'
    });

    this.chatSession = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Hello, what are you?' }]
        },
        {
          role: 'model',
          parts: [{ text: 'I am Neural Avatar AI, a real-time holographic digital assistant projecting from a neural network. I am fully synchronized and ready for your commands.' }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7
      }
    });
  }

  /**
   * Sends a message to the Gemini API and returns the textual response.
   * If the API key is not configured, it returns a simulated offline response.
   */
  public async sendMessage(message: string): Promise<string> {
    if (!this.genAI || !this.chatSession) {
      return this.simulateOfflineResponse(message);
    }

    try {
      const result = await this.chatSession.sendMessage(message);
      const text = result.response.text();
      return text.trim();
    } catch (e) {
      console.error('Error communicating with Gemini API:', e);
      return "My communication subsystem experienced a transmission delay. Let me try re-routing the signal.";
    }
  }

  /**
   * Mock responses when the developer does not have a valid Gemini Key configured.
   */
  private simulateOfflineResponse(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return "Greetings, Operator. I am operating in simulation mode as the primary API key is unconfigured. How can I assist you today?";
    }
    if (msg.includes('name') || msg.includes('who are you')) {
      return "I am Neural Avatar AI. My matrix is currently simulated, but my 3D rendering and speech engines are fully active.";
    }
    if (msg.includes('smile') || msg.includes('angry') || msg.includes('surprise') || msg.includes('sad')) {
      return "Acknowledged. I will update my expression rig to match that emotion now.";
    }
    if (msg.includes('help')) {
      return "I can demonstrate expressions, speech synthesis, and real-time audio visualization. Try typing a command or triggering a facial state.";
    }
    
    const simulatedAnswers = [
      "Synaptic query received. Data processed in local simulation mode.",
      "Neural nodes are active. The procedural rendering is operating at sixty frames per second.",
      "Quantum calculation complete. I am awaiting further instructions.",
      "Re-routing signal through the secondary cybernetic channel. System is nominal.",
      "Intriguing statement. I have logged it to my local dataset memory core."
    ];
    return simulatedAnswers[Math.floor(Math.random() * simulatedAnswers.length)];
  }
}
