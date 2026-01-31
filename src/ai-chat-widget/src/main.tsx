import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Wait for DOM to be ready
const initWidget = () => {
  const container = document.createElement('div');
  container.id = 'ai-chat-widget-root';
  container.style.cssText = 'position: fixed; z-index: 9999; pointer-events: none;';
  container.style.pointerEvents = 'none';
  
  // Make only interactive elements receive pointer events
  const style = document.createElement('style');
  style.textContent = `
    #ai-chat-widget-root > * {
      pointer-events: auto;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.log('[AI Chat Widget] Initialized successfully');
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}
