import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is disabled for this specific MediaPipe implementation to prevent double-initialization issues in development
  // In production, proper cleanup handles this, but for the demo, this ensures stability.
  <>
    <App />
  </>
);