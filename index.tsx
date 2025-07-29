
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { loader } from '@monaco-editor/react';

// Configure monaco-editor loader to fetch assets from CDN
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs'
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);