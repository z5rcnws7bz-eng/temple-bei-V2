// Sign in with Apple JS Integration for Temple BEI
import { setStoredSession, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

export const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || '';
export const APPLE_REDIRECT_URI =
  import.meta.env.VITE_APPLE_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/login' : '');

let appleInitPromise = null;

export function isAppleConfigured() {
  return Boolean(APPLE_CLIENT_ID);
}

/**
 * Dynamically load and initialize Apple ID SDK
 */
export async function initAppleAuth() {
  if (typeof window === 'undefined') return false;

  if (window.AppleID?.auth) {
    setupAppleID();
    return true;
  }

  if (appleInitPromise) return appleInitPromise;

  appleInitPromise = new Promise((resolve) => {
    if (window.AppleID?.auth) {
      setupAppleID();
      return resolve(true);
    }

    const existing = document.getElementById('apple-auth-sdk');
    if (existing) {
      existing.addEventListener('load', () => {
        setupAppleID();
        resolve(true);
      });
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'apple-auth-sdk';
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      setupAppleID();
      resolve(true);
    };
    script.onerror = () => {
      console.warn('Could not load Apple ID SDK script');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return appleInitPromise;
}

function setupAppleID() {
  if (!window.AppleID?.auth) return;
  try {
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID || 'edu.temple.bei.web',
      scope: 'name email',
      redirectURI: APPLE_REDIRECT_URI,
      state: 'temple-bei-apple-login',
      usePopup: true,
    });
  } catch (err) {
    console.warn('AppleID.auth.init notice:', err);
  }
}

/**
 * Decode JWT token payload
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

/**
 * Initiate Sign in with Apple flow
 */
export async function signInWithApple() {
  // If no Apple Services ID is configured yet (local testing mode), provide simulated Apple user
  if (!isAppleConfigured()) {
    const simulatedAppleUser = {
      id: 'apple_usr_' + Math.random().toString(36).substring(2, 9),
      email: 'volunteer.apple@temple.edu',
      name: 'Temple Apple Member',
      admin: false,
    };
    const session = {
      access_token: 'apple-dev-token-' + Date.now(),
      user: simulatedAppleUser,
    };
    setStoredSession(session);
    return {
      session,
      simulated: true,
      message: 'Signed in via Apple Account! (Test mode: add VITE_APPLE_CLIENT_ID to .env.local for production Apple ID).',
    };
  }

  const loaded = await initAppleAuth();
  if (!loaded || !window.AppleID?.auth) {
    throw new Error('Sign in with Apple JS is loading. Please check your connection and try again.');
  }

  const response = await window.AppleID.auth.signIn();
  const authorization = response?.authorization;
  if (!authorization?.id_token) {
    throw new Error('Apple authorization did not return an identity token.');
  }

  const tokenPayload = parseJwt(authorization.id_token);
  const email = response.user?.email || tokenPayload.email || '';
  let fullName = '';
  if (response.user?.name) {
    const { firstName, lastName } = response.user.name;
    fullName = [firstName, lastName].filter(Boolean).join(' ');
  }
  if (!fullName) {
    fullName = email ? email.split('@')[0] : 'Temple Apple Volunteer';
  }

  const appleSubject = tokenPayload.sub || authorization.code || ('apple_' + Date.now());

  // Connect to Supabase Auth with Apple ID token if configured
  if (isSupabaseConfigured()) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'apple',
          id_token: authorization.id_token,
          nonce: 'temple-bei-apple-login',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: {
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.user_metadata?.name || fullName,
            admin: (data.user.email || email).toLowerCase() === 'owner@temple.edu',
          },
        };
        setStoredSession(session);
        return { session };
      }
    } catch (err) {
      console.warn('Supabase Apple Token Exchange error:', err);
    }
  }

  const session = {
    access_token: authorization.id_token,
    user: {
      id: 'apple_' + appleSubject,
      email: email || `apple-user-${appleSubject.slice(0, 8)}@temple.edu`,
      name: fullName,
      admin: false,
    },
  };
  setStoredSession(session);
  return { session };
}

