import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { ScrollRestoration } from './components/layout/ScrollRestoration.tsx';
import { loadDefaultRankings } from './lib/loadData.ts';

// The pre-generated rankings are what the rankings page paints before the draft
// classes arrive, so start them here rather than from an effect: mount order put
// this 6 KB request behind ~1.3 MB of draft classes it only had to precede. The
// load cache dedupes it with the effect that consumes the result.
void loadDefaultRankings().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollRestoration />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
