import type { ConfidenceLevel, Detection } from '../types/api'

export const levelColor: Record<ConfidenceLevel, string> = { High: '#34d8a0', Medium: '#f2b84b', Low: '#8aa0b6' }

export function fmtCoord(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return 'Location unavailable'
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}   ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '-'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

/** Map filter groups used by the Anomaly Map page. */
export const CLASS_GROUPS: Record<string, string[] | null> = {
  All: null,
  'Ghost Nets': ['Ghost Net'],
  Wrecks: ['Shipwreck'],
  Pipes: ['Pipe', 'Cylinder'],
  Debris: ['Fishing Gear', 'Metal Debris', 'Other Man-Made Object'],
  Unknown: ['Unknown Anomaly'],
}

export const matchesGroup = (d: Detection, group: string) => {
  const g = CLASS_GROUPS[group]
  return !g || g.includes(d.class)
}
