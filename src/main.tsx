import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 구버전 더미 데이터 localStorage 정리
const OLD_KEYS = [
  'review-data-v1',
  'review-data-v2',
  'review-feedback',
  'review-notifications',
  'review-goals',
];
OLD_KEYS.forEach(k => localStorage.removeItem(k));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
