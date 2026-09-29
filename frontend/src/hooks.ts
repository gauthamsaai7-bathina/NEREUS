import { useCallback, useEffect, useRef, useState } from 'react'
import type { Health } from './types/api'
import { getHealth } from './services/api'

/** Polls the real /api/health endpoint. `error` is set when the backend cannot be reached. */
export function useHealth(intervalMs = 10_000) {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const timer = useRef<number>()

  const refresh = useCallback(async () => {
    const t0 = performance.now()
    try {
      const h = await getHealth()
      setLatencyMs(Math.round(performance.now() - t0)); setHealth(h); setError(null)
    } catch (e) {
      setHealth(null); setError((e as Error).message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    refresh()
    timer.current = window.setInterval(refresh, intervalMs)
    return () => window.clearInterval(timer.current)
  }, [refresh, intervalMs])

  return { health, error, latencyMs, loading, refresh }
}
