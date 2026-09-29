import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: Kind; message: string }
const Ctx = createContext<{ toast: (kind: Kind, message: string) => void }>({ toast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const dismiss = (id: number) => setItems(t => t.filter(x => x.id !== id))
  const toast = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random()
    setItems(t => [...t.slice(-3), { id, kind, message }])
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
  }, [])
  const icon = { success: <CheckCircle2 size={16} className="text-kelp" />, error: <AlertTriangle size={16} className="text-coral" />, info: <Info size={16} className="text-sonar" /> }
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[2000] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 no-print" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
              className="panel flex items-start gap-2.5 px-3 py-2.5 shadow-xl shadow-black/40">
              <span className="mt-0.5">{icon[t.kind]}</span>
              <p className="flex-1 text-[13px] leading-snug">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-haze hover:text-mist"><X size={14} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
