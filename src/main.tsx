import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
if (!GOOGLE_CLIENT_ID) {
  console.error('[Auth] VITE_GOOGLE_CLIENT_ID 가 설정되지 않았습니다. .env.local 을 확인하세요.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID ?? ''}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
