import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file from the current directory
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.GEMINI_KEY': JSON.stringify(env.GEMINI_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_KEY || ''),
      'process.env.HF_TOKEN': JSON.stringify(env.HF_TOKEN || env.VITE_HF_TOKEN || ''),
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
