// Supabase Authentication & Database Integration for Temple BEI (temple-BEI-V2)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://znbosnwimjklfaooxnjv.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const SESSION_KEY = 'temple_bei_supabase_session';
const REGISTERED_USERS_KEY = 'temple_bei_registered_users';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your-anon-key'));
}

/**
 * Get stored session from localStorage
 */
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session?.user) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save session to localStorage
 */
export function setStoredSession(session) {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to update localStorage session:', e);
  }
}

// Local mock registered users helper for testing when offline or before Supabase key is configured
function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save local users:', e);
  }
}

/**
 * Generic fetcher for Supabase Auth API
 */
async function supabaseAuthRequest(endpoint, body, token = '') {
  const url = `${SUPABASE_URL}/auth/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.error_description || data.msg || data.message || `Auth request failed (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data.error || data.error_code;
    throw error;
  }
  return data;
}

/**
 * Sign up with email, password, and full name.
 * Mandatory email confirmation is enforced.
 */
export async function signUp({ email, password, name }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (!isSupabaseConfigured()) {
    // Local development mode: simulate user creation requiring email confirmation
    const users = getLocalUsers();
    if (users.some((u) => u.email === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 10),
      email: cleanEmail,
      name: cleanName || cleanEmail.split('@')[0],
      password, // Local dev simulation only
      confirmed: false,
      created: new Date().toISOString(),
    };
    users.push(newUser);
    saveLocalUsers(users);

    return {
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
      confirmationRequired: true,
      message: `Registration submitted! A verification link has been sent to ${cleanEmail}. You must confirm your email before you can officially sign in.`,
    };
  }

  const data = await supabaseAuthRequest('signup', {
    email: cleanEmail,
    password,
    data: {
      name: cleanName,
    },
  });

  const confirmationRequired = !data.session || !data.user?.confirmed_at;

  return {
    user: data.user,
    session: data.session,
    confirmationRequired,
    message: `Account created for ${cleanEmail}! Please check your email inbox to verify and confirm your account before logging in.`,
  };
}

/**
 * Confirm email locally (simulator helper for local testing)
 */
export function confirmLocalEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  const users = getLocalUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (user) {
    user.confirmed = true;
    saveLocalUsers(users);
    return true;
  }
  return false;
}

/**
 * Sign in with email and password.
 * Enforces email confirmation check.
 */
export async function signInWithPassword({ email, password }) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Please provide both your email and password.');
  }

  if (!isSupabaseConfigured()) {
    // Standardized local administrator account verification
    const isAdminEmail = cleanEmail === 'admin@temple.edu' || cleanEmail === 'local-admin@example.test';
    if (isAdminEmail) {
      if (password !== 'admin' && password !== 'admin123') {
        throw new Error('Incorrect password for administrator account. Standard password is: admin123');
      }
      const adminSession = {
        access_token: 'local-admin-token-' + Date.now(),
        user: {
          id: 'local-development-admin',
          email: cleanEmail,
          name: 'Jace Roman',
          admin: true,
        },
      };
      setStoredSession(adminSession);
      return adminSession;
    }

    const users = getLocalUsers();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      throw new Error('No account found with this email. Please click "Create account" to register.');
    }
    if (user.password !== password) {
      throw new Error('Incorrect password. Please verify your credentials and try again.');
    }
    if (!user.confirmed) {
      const err = new Error(`Your email (${cleanEmail}) has not been confirmed yet. You must confirm your email from your inbox before signing in.`);
      err.unconfirmedEmail = cleanEmail;
      throw err;
    }

    const session = {
      access_token: 'local-token-' + Date.now(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        admin: user.email.includes('admin') || user.email.includes('president'),
      },
    };
    setStoredSession(session);
    return session;
  }

  try {
    const data = await supabaseAuthRequest('token?grant_type=password', {
      email: cleanEmail,
      password,
    });

    if (data.user && !data.user.confirmed_at && data.user.email_confirmed_at === null) {
      throw new Error('Your email address has not been confirmed yet. Please verify your email before logging in.');
    }

    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email.split('@')[0],
        admin: data.user.email.toLowerCase() === 'owner@temple.edu' || data.user.email.toLowerCase().includes('admin'),
      },
    };

    setStoredSession(session);
    return session;
  } catch (err) {
    if (err.message?.toLowerCase().includes('email not confirmed')) {
      throw new Error('Your email address has not been confirmed yet. Please check your inbox for the confirmation link before signing in.');
    }
    if (err.message?.toLowerCase().includes('invalid login credentials')) {
      throw new Error('Incorrect email or password. Please check your credentials and try again.');
    }
    throw err;
  }
}

/**
 * Sign out and clear stored sessions
 */
export async function signOut() {
  const session = getStoredSession();
  setStoredSession(null);
  if (isSupabaseConfigured() && session?.access_token) {
    try {
      await supabaseAuthRequest('logout', null, session.access_token);
    } catch {
      // Ignore network errors on logout
    }
  }
}

/**
 * Fetch member profile from Supabase
 */
export async function fetchSupabaseProfile(userId) {
  if (!isSupabaseConfigured()) return null;
  const session = getStoredSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;

  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) return null;
  const list = await response.json();
  return list[0] || null;
}

/**
 * Save / Update member profile (name, major, class year, bio) to Supabase
 */
export async function updateSupabaseProfile(userId, { name, major, year, bio, email }) {
  if (!isSupabaseConfigured()) return { ok: true };
  const session = getStoredSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;

  const payload = {
    id: userId,
    name: (name || '').trim().slice(0, 80),
    major: (major || '').trim().slice(0, 120),
    year: (year || '').trim().slice(0, 40),
    bio: (bio || '').trim().slice(0, 500),
  };
  if (email) payload.email = email;

  const url = `${SUPABASE_URL}/rest/v1/profiles`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update profile in database.');
  }

  const result = await response.json();
  return result[0] || payload;
}

/**
 * Fetch active member profiles from Supabase for the chapter directory
 */
export async function fetchSupabaseDirectory() {
  if (!isSupabaseConfigured()) return null;
  const session = getStoredSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const url = `${SUPABASE_URL}/rest/v1/profiles?disabled=eq.0&select=id,name,major,year,bio&order=name.asc`;
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return null;
    const members = await response.json();
    return Array.isArray(members) ? members : null;
  } catch (e) {
    console.warn('Failed to fetch directory from Supabase:', e);
    return null;
  }
}

/**
 * Fetch single member profile details from Supabase
 */
export async function fetchSupabaseMember(id) {
  if (!isSupabaseConfigured()) return null;
  const session = getStoredSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&disabled=eq.0&select=id,name,major,year,bio`;
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return null;
    const list = await response.json();
    return list[0] || null;
  } catch (e) {
    console.warn('Failed to fetch member from Supabase:', e);
    return null;
  }
}
