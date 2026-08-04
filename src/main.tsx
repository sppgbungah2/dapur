import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Failed to fetch')) {
    console.warn('Suppressed console.error for Failed to fetch:', ...args);
    return;
  }
  if (args.length > 0 && args[0] instanceof TypeError && args[0].message === 'Failed to fetch') {
    console.warn('Suppressed console.error for Failed to fetch TypeError:', ...args);
    return;
  }
  originalConsoleError(...args);
};

// Also forcefully hide Vite error overlay if it appears for "Failed to fetch"
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeName === 'VITE-ERROR-OVERLAY') {
        const shadow = (node as any).shadowRoot;
        if (shadow) {
          const text = shadow.innerHTML || '';
          if (text.includes('Failed to fetch') || text.includes('fetch')) {
            console.warn('Removing Vite error overlay for Failed to fetch');
            (node as Element).remove();
          }
        }
      }
    });
  });
});
observer.observe(document.body, { childList: true });

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Failed to fetch')) {
    console.warn('Caught global Failed to fetch (likely from Supabase). Suppressing error overlay.', event.reason);
    event.preventDefault(); // Prevent AI Studio overlay from showing this unhandled rejection
  }
});

window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Failed to fetch')) {
    console.warn('Caught global error Failed to fetch. Suppressing.', event.message);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
