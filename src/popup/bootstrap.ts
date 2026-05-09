import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

export function bootstrapPopup(container: HTMLElement | null) {
  if (!container) {
    throw new Error('Root container #root not found');
  }

  ReactDOM.createRoot(container).render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(App)
    )
  );
}
