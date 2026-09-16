import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  )
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 把 "1.2万" / "3.4k" / "8500" 统一成可读短文本(仅展示用,不参与计算) */
export function shortNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'
  return String(n)
}

/** 把 "1.2万" / "3.4k" / "8,500" 解析成数字;解析失败返回 null */
export function parseCount(s: string): number | null {
  const t = (s ?? '').trim().replace(/[,，\s]/g, '')
  if (!t) return null
  const m = /^(\d+(?:\.\d+)?)([万wWkK]?)$/.exec(t)
  if (!m) return null
  const n = Number.parseFloat(m[1])
  if (!Number.isFinite(n)) return null
  const unit = m[2].toLowerCase()
  if (unit === '万' || unit === 'w') return Math.round(n * 10000)
  if (unit === 'k') return Math.round(n * 1000)
  return Math.round(n)
}
