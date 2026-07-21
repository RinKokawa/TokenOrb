import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const storedTheme = window.localStorage.getItem('token-floating-ball:theme');
document.documentElement.dataset.theme = storedTheme === 'light' ? 'light' : 'dark';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
