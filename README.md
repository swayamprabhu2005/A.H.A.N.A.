# Neural Avatar AI

A real-time, AI-powered holographic digital human assistant. A glowing 3D wireframe face — built with Three.js — tracks your cursor, lip-syncs to spoken AI responses, and holds full conversations using **Gemini AI** as its brain and **Hugging Face TTS** (with browser Web Speech as fallback) as its voice.

---

## Features

### 🧠 Gemini AI Chat
- Full conversational chat panel on the right — type or speak your query
- Powered by **Gemini 2.5 Flash** for fast, natural responses
- Microphone input button in the chat field for hands-free voice queries

### 🎙️ Text-to-Speech Voice
- Primary: **Hugging Face Inference API** (`facebook/mms-tts-eng`)
- Fallback: Browser **Web Speech API** (no API key required)
- Subtitles panel shows the text being spoken in real time

### 👤 3D Holographic Face
- Loads a custom high-poly `.obj` head mesh (up to 50,000+ vertices)
- Renders glowing wireframe points and pulsing grid edges
- Mouse-tracking — the entire face follows your cursor in 3D space
- **Dual-pipeline rendering**: WebGL with Unreal Bloom post-processing, or automatic CPU 2D-canvas fallback

### 👄 Lip Sync
- Mouth visemes (`A, E, I, O, U, M, F, L, S`) animate only while the AI is speaking
- Gaussian spatial falloff blends mouth deformation smoothly into surrounding geometry
- Intensity scales organically with audio volume

### 🌊 Voice Vibration Dashboard
- 20-bar symmetrical frequency visualizer centered below the face
- Bounces in real time to the AI's audio output
- Subtle idle jitter when silent; full bounce during speech

### ✨ Cyberpunk HUD
- Glassmorphic right-side chat panel
- Orbitron + Outfit fonts with neon-cyan / neon-pink color palette
- CRT scanline overlay, radial vignette, animated status dot

---

## Project Structure

```
Neural Avatar/
├── public/
│   ├── extension.obj     # Your high-poly 3D head mesh (required)
│   └── favicon.svg       # App tab icon
├── src/
│   ├── ai/
│   │   └── Gemini.ts     # Gemini API chat session
│   ├── app/
│   │   └── index.ts      # App orchestrator — render loop, UI, animations
│   ├── audio/
│   │   ├── Analyzer.ts   # Web Audio API frequency & volume tracker
│   │   ├── TTS.ts        # HuggingFace & WebSpeech TTS engines
│   │   └── VisemeMapper.ts # Word → phoneme → viseme mapping
│   ├── avatar/
│   │   ├── Expressions.ts  # Emotion morph offsets (smile, sad, angry…)
│   │   ├── EyeSystem.ts    # Eye blinking & mouse pupil tracking
│   │   ├── FaceMesh.ts     # OBJ parser, auto-rigging, procedural fallback
│   │   ├── HeadSystem.ts   # Breathing, micro-motion, cursor tracking
│   │   └── LipSync.ts      # Viseme deformation calculations
│   ├── effects/
│   │   └── bloomEffect.ts  # Unreal Bloom post-processing
│   ├── ui/
│   │   └── index.css       # Glassmorphic cyberpunk styles
│   └── main.ts             # Entry point
├── index.html              # HUD layout & canvas
├── vite.config.ts          # Build config & env variable mapping
├── package.json
└── tsconfig.json
```

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Required — Gemini AI (get yours at https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional — Hugging Face TTS (get yours at https://huggingface.co/settings/tokens)
# Without this, the app falls back to the browser's built-in Web Speech API
HF_TOKEN=your_huggingface_token_here
```

> **Note:** `.env` is listed in `.gitignore` — your keys will never be committed.

### 3. Add Your 3D Head Model

Place your Wavefront `.obj` head file at:
```
public/extension.obj
```

The app auto-parses, centers, and rigs the mesh on load. Any standard head export works.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
```

Output goes to the `dist/` folder.

---

## Usage

| Action | What Happens |
|---|---|
| **Type in chat → Send** | Gemini AI responds in chat; avatar speaks the reply with lip sync |
| **Click 🎤 mic button** | Voice recording starts; your speech is transcribed and sent to Gemini |
| **Move mouse** | The 3D face follows your cursor in real time |
| **AI speaking** | Mouth animates, vibration bars bounce, subtitle panel shows the text |
| **AI idle** | Face is still, mouth closed, vibration bars show subtle idle noise |

---

## Troubleshooting

### "Transmission delay" error message
Your `GEMINI_API_KEY` is either missing, incorrect, or the network request failed. Double-check your `.env` file and restart the dev server (`Ctrl+C` → `npm run dev`).

### Hugging Face TTS not working
If you see `Hugging Face TTS error, falling back to Web Speech API` in the browser console, your `HF_TOKEN` is missing or invalid. The app will automatically use the browser's built-in Web Speech API instead — this is expected behavior with no token configured.

### WebGL fallback active
If you see `WebGL Context creation failed` in the console, WebGL is disabled in your browser:
1. Open browser settings → search **Hardware Acceleration** → ensure it is ON
2. In Chrome: visit `chrome://flags` → search **WebGL** → set to *Enabled*
3. Restart your browser
