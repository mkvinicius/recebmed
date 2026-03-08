const TOKEN_KEY = "recebmed_token";
const USER_KEY = "recebmed_user";
const PW_UPDATE_KEY = "recebmed_pw_update";

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
  localStorage.removeItem(PW_UPDATE_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function setRequiresPasswordUpdate(required: boolean) {
  if (required) {
    localStorage.setItem(PW_UPDATE_KEY, "true");
  } else {
    localStorage.removeItem(PW_UPDATE_KEY);
  }
}

export function getRequiresPasswordUpdate(): boolean {
  return localStorage.getItem(PW_UPDATE_KEY) === "true";
}