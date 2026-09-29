import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ScanResult } from '../types/api'
import { getDetection } from '../services/api'

const ACTIVE_KEY = 'nereus.activeScan'
const SETTINGS_KEY = 'nereus.settings'

export interface Settings { demoCoordinates: boolean; showLabels: boolean; showSegmentation: boolean; basemap: boolean }
const DEFAULTS: Settings = { demoCoordinates: true, showLabels: true, showSegmentation: false, basemap: true }

interface ScanState {
  scan: ScanResult | null
  selectedId: string | null
  setScan: (s: ScanResult | null) => void
  select: (id: string | null) => void
  loadScan: (id: string) => Promise<ScanResult>
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}
const Ctx = createContext<ScanState>(null as unknown as ScanState)
export const useScan = () => useContext(Ctx)

/** Holds the scan being reviewed so Analysis, Map, Reports and Live pages stay in sync. */
export function ScanProvider({ children }: { children: ReactNode }) {
  const [scan, setScanState] = useState<ScanResult | null>(null)
  const [selectedId, select] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } } catch { return DEFAULTS }
  })

  const setScan = useCallback((s: ScanResult | null) => {
    setScanState(s); select(null)
    if (s) localStorage.setItem(ACTIVE_KEY, s.scan_id); else localStorage.removeItem(ACTIVE_KEY)
  }, [])

  const loadScan = useCallback(async (id: string) => {
    const s = await getDetection(id)
    setScan(s)
    return s
  }, [setScan])

  // Restore the last reviewed scan from the backend after a refresh (the backend is the source of truth).
  useEffect(() => {
    const id = localStorage.getItem(ACTIVE_KEY)
    if (id) getDetection(id).then(s => setScanState(s)).catch(() => localStorage.removeItem(ACTIVE_KEY))
  }, [])

  const updateSettings = (patch: Partial<Settings>) => setSettings(prev => {
    const next = { ...prev, ...patch }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    return next
  })

  return <Ctx.Provider value={{ scan, selectedId, setScan, select, loadScan, settings, updateSettings }}>{children}</Ctx.Provider>
}
