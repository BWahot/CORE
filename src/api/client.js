const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:4000/api';

export function getToken() {
  return localStorage.getItem('referrallink_token');
}

export function setSession(token, user) {
  localStorage.setItem('referrallink_token', token);
  localStorage.setItem('referrallink_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('referrallink_token');
  localStorage.removeItem('referrallink_user');
}

export function getStoredUser() {
  const raw = localStorage.getItem('referrallink_user');
  return raw ? JSON.parse(raw) : null;
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}
