import React, { useEffect, useRef } from 'react';

interface GoogleCredentialResponse { credential?: string; }
interface GoogleButtonApi {
  initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select: false }): void;
  renderButton(element: HTMLElement, options: { theme: 'outline'; size: 'large'; text: 'continue_with'; shape: 'rectangular'; width: number; click_listener: () => void }): void;
}
declare global {
  interface Window { google?: { accounts?: { id?: GoogleButtonApi } }; }
}

interface Props { clientId: string; disabled?: boolean; onCredential: (credential: string) => void; onError: (message: string) => void; onClick: () => void; }
const SCRIPT_ID = 'google-identity-services';

export const GoogleSignInButton: React.FC<Props> = ({ clientId, disabled = false, onCredential, onError, onClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onCredential, onError, onClick });
  callbacks.current = { onCredential, onError, onClick };

  useEffect(() => {
    if (!clientId || disabled || !containerRef.current) return;
    let active = true;
    const render = () => {
      if (!active || !containerRef.current) return;
      const identity = window.google?.accounts?.id;
      if (!identity) {
        callbacks.current.onError('Google sign-in could not load. Check the network connection and try again.');
        return;
      }
      identity.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (response) => {
          if (!response.credential) {
            callbacks.current.onError('Google did not return an ID token. Please try again.');
            return;
          }
          callbacks.current.onCredential(response.credential);
        },
      });
      identity.renderButton(containerRef.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(400, containerRef.current.clientWidth || 340), click_listener: () => callbacks.current.onClick() });
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (window.google?.accounts?.id) render();
    else if (existing) {
      existing.addEventListener('load', render, { once: true });
      existing.addEventListener('error', () => callbacks.current.onError('Google sign-in could not load. Check the network connection and try again.'), { once: true });
    } else {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => callbacks.current.onError('Google sign-in could not load. Check the network connection and try again.');
      document.head.appendChild(script);
    }
    return () => { active = false; };
  }, [clientId, disabled]);

  if (clientId && !disabled) return <div className="google-button-host" ref={containerRef} aria-label="Continue with Google" />;
  return <div className="google-signin-unavailable" role="note">{disabled
    ? 'Google sign-in is unavailable in frontend demo mode. Use development demo access only when explicitly enabled.'
    : 'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and configure server-side verification.'}</div>;
};
