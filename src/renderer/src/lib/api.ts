export async function call<T>(channel: string, payload?: unknown): Promise<T> {
  const res = (await window.api.invoke(channel, payload)) as {
    ok: boolean
    data?: T
    error?: string
  }
  if (!res.ok) throw new Error(res.error ?? 'Lỗi không xác định')
  return res.data as T
}

export function onEvent<T>(channel: string, cb: (data: T) => void): () => void {
  return window.api.on(channel, cb as (data: unknown) => void)
}
