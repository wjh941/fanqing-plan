import { DISCLAIMER, MODULES } from './types'
import type { CheckItem } from './types'
import { uid } from './utils'

export interface ParsedModule {
  n: number
  heading: string
  content: string
}

const HEAD_RE = /(^|\n)#{2,4}\s*模块\s*([1-6])\s*[:：]?\s*([^\n]*)/g

/** 把 AI 输出的整段 markdown 拆成:开场白 + 5 个模块 + 结尾免责声明 */
export function splitReport(report: string): {
  preamble: string
  modules: ParsedModule[]
  trailing: string
  hasDisclaimer: boolean
} {
  let body = report
  let trailing = ''
  let hasDisclaimer = false

  const dIdx = report.lastIndexOf(DISCLAIMER)
  if (dIdx >= 0) {
    const tail = report.slice(dIdx)
    // 只有当免责声明基本处于结尾时才视为独立尾行
    if (tail.replace(DISCLAIMER, '').trim().length <= 2) {
      body = report.slice(0, dIdx)
      trailing = report.slice(dIdx).trim()
      hasDisclaimer = true
    } else {
      hasDisclaimer = true
    }
  }

  const marks: Array<{ n: number; heading: string; start: number; end: number }> = []
  HEAD_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HEAD_RE.exec(body)) !== null) {
    const heading = `### 模块${m[2]}:${(m[3] || '').replace(/^[:：]\s*/, '').trim()}`
    marks.push({ n: Number(m[2]), heading, start: m.index + m[1].length, end: m.index + m[0].length })
  }

  const preamble = marks.length > 0 ? body.slice(0, marks[0].start).trim() : ''
  const modules: ParsedModule[] = []
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i]
    const nextStart = i + 1 < marks.length ? marks[i + 1].start : body.length
    const content = body.slice(cur.end, nextStart).trim()
    const exist = modules.findIndex((x) => x.n === cur.n)
    if (exist >= 0) modules[exist] = { n: cur.n, heading: cur.heading, content }
    else modules.push({ n: cur.n, heading: cur.heading, content })
  }
  modules.sort((a, b) => a.n - b.n)

  return { preamble, modules, trailing, hasDisclaimer }
}

/** 用新内容替换整份报告中的某个模块(保留其他模块与结尾免责声明) */
export function replaceModule(report: string, n: number, newContent: string): string {
  const meta = MODULES.find((m) => m.n === n)
  const heading = `### 模块${n}:${meta ? meta.title : ''}`
  const section = `${heading}\n\n${newContent.trim()}`

  const { trailing, hasDisclaimer } = splitReport(report)
  const body = hasDisclaimer && trailing ? report.slice(0, report.lastIndexOf(trailing)) : report

  HEAD_RE.lastIndex = 0
  const marks: Array<{ n: number; start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = HEAD_RE.exec(body)) !== null) {
    marks.push({ n: Number(m[2]), start: m.index + m[1].length, end: m.index + m[0].length })
  }
  const idx = marks.findIndex((x) => x.n === n)
  if (idx === -1) {
    // 原文没有该模块:追加到末尾
    return `${body.trimEnd()}\n\n${section}${trailing ? `\n\n${trailing}` : ''}`
  }
  const start = marks[idx].start
  const end =
    idx + 1 < marks.length ? marks[idx + 1].start : body.length
  return `${body.slice(0, start)}${section}${body.slice(end).trimEnd()}${trailing ? `\n\n${trailing}` : ''}`
}

/** 从微调输出中剥掉首个模块标题行,用于流式过程展示 */
export function stripFirstHeading(text: string): string {
  return text.replace(/^#{2,4}\s*模块\s*\d\s*[:：]?[^\n]*\n?/, '')
}

export function moduleComplete(report: string): boolean {
  const { modules, hasDisclaimer } = splitReport(report)
  // 核心 5 模块齐全 + 免责声明;模块6(变现)为可选项,不强制
  return (
    MODULES.filter((m) => m.n <= 5).every((m) =>
      modules.some((x) => x.n === m.n && x.content.length > 0),
    ) && hasDisclaimer
  )
}

/* ---------------- 结构化排期提取(AI 输出的 schedule-json 数据块) ---------------- */

const SCHEDULE_RE = /```schedule-json\s*([\s\S]*?)```/i

function toCheckItem(u: unknown): CheckItem | null {
  if (typeof u !== 'object' || u === null) return null
  const o = u as Record<string, unknown>
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  if (!title) return null
  const weekNum = Number(o.week)
  const week = weekNum === 1 || weekNum === 2 || weekNum === 3 ? weekNum : 0
  return {
    id: uid(),
    week,
    when: typeof o.when === 'string' ? o.when.trim() : '',
    title,
    kind: typeof o.kind === 'string' && o.kind.includes('测试') ? '测试内容' : '巩固标签内容',
    difficulty: typeof o.difficulty === 'string' && o.difficulty.trim() ? o.difficulty.trim() : '中',
  }
}

/** 从报告原文中剥离 schedule-json 数据块,并解析成打卡清单;没有则原样返回 */
export function extractSchedule(raw: string): { items: CheckItem[]; report: string } {
  const m = SCHEDULE_RE.exec(raw)
  if (!m) return { items: [], report: raw }

  let items: CheckItem[] = []
  const jsonText = m[1].trim()
  const tryParse = (text: string): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  }
  let parsed: unknown = tryParse(jsonText)
  if (parsed === undefined) {
    const arrMatch = /\[[\s\S]*\]/.exec(jsonText)
    if (arrMatch) parsed = tryParse(arrMatch[0])
  }
  if (Array.isArray(parsed)) {
    items = parsed.map(toCheckItem).filter((x): x is CheckItem => x !== null)
  }

  const report = (raw.slice(0, m.index) + raw.slice(m.index + m[0].length))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { items, report }
}
