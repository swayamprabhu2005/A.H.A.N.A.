import './ui/index.css';
import { App } from './app/index';

// Initialize the application once the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  try {
    const app = new App();
    (window as any)._app = app; // Expose to window for console debugging if needed
  } catch (error) {
    console.error('Failed to initialize Neural Avatar AI application:', error);
  }
});
