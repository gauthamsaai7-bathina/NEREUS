import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from '../context/AuthContext'
import { LogoMark } from '../components/Logo'

// The one deliberate flourish of the app: a sonar sweep with expanding return rings.
function SonarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="absolute left-[34%] top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="absolute inset-0 rounded-full border border-sonar/40"
            style={{ animation: `ping-ring 7s ${i * 1.75}s infinite cubic-bezier(.2,.6,.3,1)` }} />
        ))}
        <div className="absolute inset-0 rounded-full border border-line" />
        <div className="absolute inset-[15%] rounded-full border border-line/70" />
        <div className="absolute inset-[32%] rounded-full border border-line/50" />
        <div className="absolute inset-0" style={{ animation: 'sweep 9s linear infinite' }}>
          <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left rounded-tr-full"
            style={{ background: 'conic-gradient(from -70deg at 0% 0%, rgba(55,213,214,0) 0deg, rgba(55,213,214,0.22) 68deg, rgba(55,213,214,0) 70deg)', transform: 'rotate(-90deg)' }} />
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-abyss/40 to-abyss" />
    </div>
  )
}

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!signIn(email, password, remember)) setError('Email or password is incorrect. Use the demo credentials shown below.')
  }

  return (
    <div className="relative flex min-h-full items-center bg-abyss">
      <SonarField />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1fr_400px]">
        <div className="hidden lg:block">
          <div className="flex items-center gap-4"><LogoMark size={44} /><span className="text-4xl font-semibold tracking-[0.28em]">NEREUS</span></div>
          <p className="mt-5 text-[15px] tracking-[0.2em] text-sonar">INTELLIGENT SONAR. SAFER SEAS.</p>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-haze">
            Side-scan sonar analysis for underwater marine debris and anomaly detection: preprocessing, candidate detection, noise filtering,
            confidence scoring and geo-referenced reporting in one workspace.
          </p>
        </div>
        <form onSubmit={submit} className="panel space-y-4 bg-trench/90 p-7 shadow-2xl shadow-black/50 backdrop-blur" aria-label="Sign in">
          <div className="lg:hidden"><div className="flex items-center gap-3"><LogoMark /><span className="text-xl font-semibold tracking-[0.24em]">NEREUS</span></div></div>
          <div>
            <h1 className="text-base font-semibold">Sign in</h1>
            <p className="mt-1 text-[12px] text-haze">Demo sign-in. This screen only gates the interface; the backend API has no authorization layer.</p>
          </div>
          <label className="block"><span className="label">Email</span>
            <input className="input mt-1" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder={DEMO_EMAIL} /></label>
          <label className="block"><span className="label">Password</span>
            <input className="input mt-1" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-[13px] text-haze"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-[#37d5d6]" />Remember me</label>
          {error && <div role="alert" className="flex items-start gap-2 rounded border border-coral/40 bg-coral/10 px-3 py-2 text-[12px]"><AlertCircle size={14} className="mt-0.5 shrink-0 text-coral" />{error}</div>}
          <button className="btn btn-primary w-full" type="submit">Sign in</button>
          <button type="button" className="btn w-full" onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD) }}>Fill demo credentials</button>
          <div className="rounded border border-line bg-shelf px-3 py-2 font-mono text-[11px] text-haze">
            <div>{DEMO_EMAIL}</div><div>{DEMO_PASSWORD}</div>
          </div>
        </form>
      </div>
    </div>
  )
}
