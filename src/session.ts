// Сессия пользователя в localStorage

const STORAGE_KEY = 'mkd_user_id';

export function getUserId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setUserId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearUserId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
