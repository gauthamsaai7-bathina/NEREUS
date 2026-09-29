import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getStats } from '../services/api'
import type { Stats } from '../types/api'
import { ConfidenceBadge, EmptyState, ErrorState, PageHeader, SkeletonRows, StatCard } from '../components/ui'
import { fmtDate, fmtMs, levelColor } from '../utils/format'

const PALETTE = ['#37d5d6', '#34d8a0', '#f2b84b', '#7aa2ff', '#ef6a5b', '#b48cff', '#8aa0b6', '#5fd0ff']
const tip = { contentStyle: { background: '#0a1522', border: '1px solid #1a2c40', borderRadius: 6, fontSize: 12 }, labelStyle: { color: '#d8e6f2' }, itemStyle: { color: '#d8e6f2' }, cursor: { fill: 'rgba(55,213,214,0.06)' } }
const axis = { stroke: '#4d6379', fontSize: 11, tickLine: false, axisLine: { stroke: '#1a2c40' } }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="panel p-4"><div className="panel-title mb-3">{title}</div><div className="h-56">{children}</div></div>
}
const NoData = () => <div className="grid h-full place-items-center text-[12px] text-haze">No data yet</div>

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => { setError(null); getStats().then(setStats).catch(e => setError(e.message)) }
  useEffect(load, [])

  if (error) return <div><PageHeader title="Overview" /><ErrorState message={error} onRetry={load} /></div>
  const empty = stats && stats.total_scans === 0
  const classData = stats ? Object.entries(stats.by_class).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) : []
  const levelData = stats ? (['High', 'Medium', 'Low'] as const).map(l => ({ name: l, value: stats.by_level[l] })) : []

  return (
    <div>
      <PageHeader title="Overview" subtitle="Live statistics computed from scans stored by the backend."
        actions={<Link to="/analysis" className="btn btn-primary">New analysis</Link>} />
      {empty && (
        <div className="panel mb-4 border-sonar/30"><EmptyState title="No scans yet"
          body="Every figure on this page is computed from real stored scans. Run a scan (or a demo scan) to populate it."
          action={<Link to="/analysis" className="btn btn-primary mt-1">Go to Sonar Analysis</Link>} /></div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard loading={!stats} label="Total scans" value={stats?.total_scans} />
        <StatCard loading={!stats} label="Anomalies detected" value={stats?.total_detections} />
        <StatCard loading={!stats} label="High confidence" value={stats?.high_confidence} hint="score 80-100" />
        <StatCard loading={!stats} label="Marine debris" value={stats?.marine_debris} hint="nets, gear, metal, other man-made" />
        <StatCard loading={!stats} label="Avg processing time" value={fmtMs(stats?.avg_processing_time_ms)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Anomaly distribution by class">
          {classData.length ? (
            <ResponsiveContainer><PieChart><Pie data={classData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} stroke="#0a1522" paddingAngle={2}>
              {classData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
          ) : <NoData />}
        </Card>
        <Card title="Confidence distribution">
          {stats && stats.total_detections ? (
            <ResponsiveContainer><BarChart data={stats.confidence_histogram} margin={{ left: -20 }}><CartesianGrid stroke="#12253a" vertical={false} /><XAxis dataKey="range" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>{stats.confidence_histogram.map((_, i) => <Cell key={i} fill={i >= 8 ? levelColor.High : i >= 6 ? levelColor.Medium : levelColor.Low} />)}</Bar></BarChart></ResponsiveContainer>
          ) : <NoData />}
        </Card>
        <Card title="Detections over time">
          {stats && stats.over_time.length ? (
            <ResponsiveContainer><LineChart data={stats.over_time} margin={{ left: -20 }}><CartesianGrid stroke="#12253a" vertical={false} /><XAxis dataKey="date" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} />
              <Line dataKey="detections" name="Detections" stroke="#37d5d6" strokeWidth={2} dot={{ r: 3 }} /><Line dataKey="scans" name="Scans" stroke="#7aa2ff" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
          ) : <NoData />}
        </Card>
        <Card title="Confidence levels">
          {stats && stats.total_detections ? (
            <ResponsiveContainer><BarChart data={levelData} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="#12253a" horizontal={false} /><XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" {...axis} /><Tooltip {...tip} />
              <Bar dataKey="value" radius={[0, 2, 2, 0]}>{levelData.map(l => <Cell key={l.name} fill={levelColor[l.name]} />)}</Bar></BarChart></ResponsiveContainer>
          ) : <NoData />}
        </Card>
      </div>
      <div className="panel mt-4">
        <div className="border-b border-line px-4 py-3 panel-title">Recent detections</div>
        {!stats ? <SkeletonRows /> : stats.recent_detections.length === 0 ? <p className="px-4 py-6 text-center text-[13px] text-haze">Nothing to show yet.</p> : (
          <div className="overflow-auto"><table className="w-full"><thead><tr><th className="th">Scan</th><th className="th">ID</th><th className="th">Class</th><th className="th">Confidence</th><th className="th">Time</th></tr></thead>
            <tbody>{stats.recent_detections.map(r => (
              <tr key={r.scan_id + r.id} className="hover:bg-shelf"><td className="td font-mono text-haze">{r.scan_id}</td><td className="td font-mono text-sonar">{r.id}</td><td className="td">{r.class}</td>
                <td className="td"><ConfidenceBadge level={r.confidence_level} value={r.confidence} /></td><td className="td text-haze">{fmtDate(r.timestamp)}</td></tr>))}</tbody></table></div>
        )}
      </div>
    </div>
  )
}
