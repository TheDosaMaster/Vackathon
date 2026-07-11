export type BackendStatus = 'checking' | 'online' | 'offline'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export async function checkBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/`, { signal })
    if (!response.ok) return false
    const data = (await response.json()) as { status?: string }
    return data.status === 'online'
  } catch {
    return false
  }
}
