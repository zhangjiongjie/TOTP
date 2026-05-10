import React from 'react';
import ReactDOM from 'react-dom/client';
import { popupRootId } from './popup/bootstrap';
import { App } from './popup/App';

ReactDOM.createRoot(document.getElementById(popupRootId)!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
