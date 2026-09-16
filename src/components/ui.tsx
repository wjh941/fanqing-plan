import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn, uid } from '../lib/utils'

/* ---------------- Button ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white shadow-[0_1px_2px_rgb(28_25_23/0.08),0_8px_20px_-8px_rgb(226_58_48/0.5)] hover:bg-brand-600 active:bg-brand-700',
  secondary: 'bg-stone-900 text-white hover:bg-stone-700 active:bg-stone-800',
  outline:
    'border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  danger: 'bg-white border border-red-200 text-red-600 hover:bg-red-50',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        'disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

/* ---------------- Card ---------------- */

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-stone-200/70 bg-white shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ---------------- 表单原子 ---------------- */

const fieldBase =
  'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50 disabled:text-stone-400'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, 'min-h-[88px] resize-y leading-relaxed', className)}
        {...props}
      />
    )
  },
)

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-stone-800">
          {label}
          {required && <span className="ml-0.5 text-brand-500">*</span>}
        </label>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

/* ---------------- Badge / Chip / Skeleton ---------------- */

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'brand' | 'green' | 'amber'
  className?: string
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-600 border-stone-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50',
      )}
    >
      {children}
    </button>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-stone-100', className)} />
}

/* ---------------- Markdown ---------------- */

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'markdown-body prose prose-stone prose-sm sm:prose-base max-w-none',
        'prose-headings:font-semibold prose-headings:text-stone-900',
        'prose-strong:font-semibold prose-strong:text-brand-800',
        'prose-li:my-1 prose-p:my-2.5 prose-table:text-[13px]',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

/* ---------------- Dialog / Drawer ---------------- */

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  side,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** side=true 时作为右侧抽屉(历史方案列表) */
  side?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col bg-white shadow-pop',
              side
                ? 'mt-auto h-[92dvh] rounded-t-3xl sm:mt-0 sm:ml-auto sm:h-full sm:max-h-none sm:max-w-md sm:rounded-l-3xl sm:rounded-r-none'
                : 'mt-auto rounded-t-3xl sm:mt-0 sm:max-w-lg sm:rounded-3xl',
            )}
            initial={side ? { x: '100%' } : { y: '100%', opacity: 0.5 }}
            animate={side ? { x: 0 } : { y: 0, opacity: 1 }}
            exit={side ? { x: '100%' } : { y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            {(title || !side) && (
              <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 pb-4 pt-5">
                <div>
                  {title && <h2 className="text-base font-semibold text-stone-900">{title}</h2>}
                  {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="scroll-slim flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------------- Toast ---------------- */

type ToastType = 'success' | 'error' | 'info'
interface ToastItem {
  id: string
  type: ToastType
  text: string
}

const ToastCtx = createContext<(type: ToastType, text: string) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

const toastIcon: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-brand-500" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const push = useCallback((type: ToastType, text: string) => {
    const id = uid()
    setToasts((prev) => [...prev.slice(-2), { id, type, text }])
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
      timers.current.delete(id)
    }, 3400)
    timers.current.set(id, t)
  }, [])

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[120] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-stone-200/80 bg-white/95 px-4 py-2 text-[13px] font-medium text-stone-700 shadow-pop backdrop-blur"
            >
              {toastIcon[t.type]}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
