// API клиент для REST API бота и ML API

const TIMEOUT = 10000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error('Ошибка сети. Проверьте подключение.');
  }
}

async function handleResponse(res: Response): Promise<any> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ====== USERS ======
export async function createUser(data: { role: string; name: string; worker_type?: string; default_address?: string }) {
  const res = await fetchWithTimeout('/api/bot/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function getUser(id: string) {
  const res = await fetchWithTimeout(`/api/bot/users/${id}`);
  return handleResponse(res);
}

export async function updateUser(id: string, data: any) {
  const res = await fetchWithTimeout(`/api/bot/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

// ====== INCIDENTS ======
export async function createIncident(data: any, photo?: File) {
  if (photo) {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    });
    formData.append('photo', photo);
    const res = await fetchWithTimeout('/api/bot/incidents', { method: 'POST', body: formData });
    return handleResponse(res);
  } else {
    const res = await fetchWithTimeout('/api/bot/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  }
}

export async function getIncidents(params: { user_id?: string; master_id?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params.user_id) query.set('user_id', params.user_id);
  if (params.master_id) query.set('master_id', params.master_id);
  if (params.status) query.set('status', params.status);
  const res = await fetchWithTimeout(`/api/bot/incidents?${query}`);
  return handleResponse(res);
}

export async function getIncident(id: number) {
  const res = await fetchWithTimeout(`/api/bot/incidents/${id}`);
  return handleResponse(res);
}

export async function assignIncident(id: number, master_id: string) {
  const res = await fetchWithTimeout(`/api/bot/incidents/${id}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ master_id })
  });
  return handleResponse(res);
}

export async function resolveIncident(id: number, master_id: string, report?: string) {
  const res = await fetchWithTimeout(`/api/bot/incidents/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ master_id, report })
  });
  return handleResponse(res);
}

export async function cancelIncident(id: number, user_id: string) {
  const res = await fetchWithTimeout(`/api/bot/incidents/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id })
  });
  return handleResponse(res);
}

export async function reviewIncident(id: number, user_id: string, rating: number, comment?: string) {
  const res = await fetchWithTimeout(`/api/bot/incidents/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, rating, comment })
  });
  return handleResponse(res);
}

// ====== MASTERS ======
export async function getMasters(worker_type?: string) {
  const query = worker_type ? `?worker_type=${worker_type}` : '';
  const res = await fetchWithTimeout(`/api/bot/masters${query}`);
  return handleResponse(res);
}

// ====== ML API ======
export async function analyzeText(text: string) {
  const res = await fetchWithTimeout('/api/text/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return handleResponse(res);
}

export async function analyzeImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchWithTimeout('/api/vision/analyze', { method: 'POST', body: formData });
  return handleResponse(res);
}

export async function checkMLHealth() {
  const res = await fetchWithTimeout('/api/health');
  return handleResponse(res);
}

// ====== BOT HEALTH ======
export async function checkBotHealth() {
  const res = await fetchWithTimeout('/api/bot/health');
  return handleResponse(res);
}
