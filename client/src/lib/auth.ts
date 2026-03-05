const TOKEN_KEY = "recebmed_token";
const USER_KEY = "recebmed_user";

export interface UserData {
  id: string;
  name: string;
  email: string;
  profilePhotoUrl?: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): UserData | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: UserData) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateUserData(updates: Partial<UserData>) {
  const current = getUser();
  if (current) {
    localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...updates }));
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}