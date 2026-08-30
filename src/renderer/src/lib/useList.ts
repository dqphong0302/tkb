import { useCallback, useEffect, useState } from 'react'
import { call } from './api'

export function useList<T>(channel: string, payload: unknown, enabled = true) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(payload)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      setItems(await call<T[]>(channel, JSON.parse(key)))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [channel, key, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, loading, error, reload, setItems }
}
