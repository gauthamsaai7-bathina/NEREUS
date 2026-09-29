import { PageHeader } from '../components/ui'
import { useScan } from '../context/ScanContext'
import { API_BASE_URL } from '../services/api'

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 border-b border-line/60 py-3 last:border-0">
      <span><span className="text-[13px] font-medium">{label}</span><span className="mt-0.5 block text-[12px] text-haze">{help}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-[#37d5d6]" />
    </label>
  )
}

export default function SettingsPage() {
  const { settings, updateSettings } = useScan()
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Stored in this browser only." />
      <div className="panel px-4">
        <Toggle label="Use demo coordinates when metadata is missing" help="Uploads without survey metadata get clearly labelled DEMO COORDINATES. Turn off to show 'Location unavailable'." checked={settings.demoCoordinates} onChange={v => updateSettings({ demoCoordinates: v })} />
        <Toggle label="Show confidence labels on the image" help="Default state of the label overlay in the sonar viewer." checked={settings.showLabels} onChange={v => updateSettings({ showLabels: v })} />
        <Toggle label="Show segmentation outlines" help="Draw the detected contour in addition to the bounding box." checked={settings.showSegmentation} onChange={v => updateSettings({ showSegmentation: v })} />
        <Toggle label="Load online base map on the Anomaly Map" help="Requires internet for OpenStreetMap tiles. Turn off for a fully offline demo; markers still render." checked={settings.basemap} onChange={v => updateSettings({ basemap: v })} />
      </div>
      <div className="panel mt-4 p-4 text-[13px]"><div className="label">Backend API</div><div className="mt-1 font-mono">{API_BASE_URL}</div><div className="mt-1 text-[12px] text-haze">Set VITE_API_BASE_URL in frontend/.env to change it.</div></div>
    </div>
  )
}
