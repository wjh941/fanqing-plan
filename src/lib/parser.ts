import { newWork } from './types'
import type { WorkItem } from './types'
import { parseCount, uid } from './utils'

export interface ParsedWork {
  date: string
  title: string
  summary: string
  likes: string
  collects: string
  plays: string
}

/* ================= 行模式(每行一条随手写) ================= */

const NUM = String.raw`(\d[\d,.,]*\s*[万wWkK＋+]?)`

const DATE_PATTERNS: RegExp[] = [
  /(\d{4}\s*[年.\-/]\s*\d{1,2}\s*[月.\-/]\s*\d{1,2}\s*日?)/,
  /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/,
  /(\d{1,2}\s*月\s*\d{1,2}\s*日?)/,
]

const METRIC_PATTERNS: Array<{ key: 'likes' | 'collects' | 'plays'; re: RegExp }> = [
  { key: 'likes', re: new RegExp(String.raw`(?:点赞|赞|喜欢|❤)[^\d]{0,3}` + NUM, 'i') },
  { key: 'collects', re: new RegExp(String.raw`(?:收藏|★|⭐|藏)[^\d]{0,3}` + NUM, 'i') },
  {
    key: 'plays',
    re: new RegExp(String.raw`(?:播放量?|浏览量?|阅读量?|观看|小眼睛|view|播)[^\d]{0,3}` + NUM, 'i'),
  },
]

/** "123 / 45 / 1.2w" 顺序识别为 赞/藏/播 */
const SLASH_RE = new RegExp(
  NUM + String.raw`\s*[/|｜]\s*` + NUM + String.raw`\s*[/|｜]\s*` + NUM,
)

function cut(line: string, re: RegExp): { text: string; cap: string } | null {
  const m = re.exec(line)
  if (!m) return null
  return { text: line.slice(0, m.index) + line.slice(m.index + m[0].length), cap: (m[1] ?? m[0]).trim() }
}

function tidy(text: string): string {
  return text
    .replace(/[\s|｜·,，、\-—:：~+]+/g, ' ')
    .trim()
}

function parseLineMode(rawLine: string): ParsedWork | null {
  let line = rawLine.trim()
  if (line.length < 3) return null
  // 去掉行首序号 "1. " "1、" "①"
  line = line.replace(/^[\s(（]*\d{1,2}\s*[.、)）]\s*/, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')

  const out: ParsedWork = { date: '', title: '', summary: '', likes: '', collects: '', plays: '' }

  // 1) 日期
  for (const re of DATE_PATTERNS) {
    const hit = cut(line, re)
    if (hit) {
      out.date = hit.cap
      line = hit.text
      break
    }
  }

  // 2) 斜杠三连数据
  const slash = cut(line, SLASH_RE)
  if (slash) {
    const m = SLASH_RE.exec(slash.cap)
    if (m) {
      out.likes = m[1]?.trim() ?? ''
      out.collects = m[2]?.trim() ?? ''
      out.plays = m[3]?.trim() ?? ''
    }
    line = slash.text
  } else {
    // 3) 关键词式数据
    for (const { key, re } of METRIC_PATTERNS) {
      const hit = cut(line, re)
      if (hit) {
        out[key] = hit.cap
        line = hit.text
      }
    }
  }

  // 4) 剩余文字 → 标题 + 简述
  const rest = tidy(line)
  if (rest) {
    const sepIdx = rest.search(/[ |｜,，、:：—\-]{1,}/)
    if (sepIdx > 0 && sepIdx <= 42) {
      out.title = rest.slice(0, sepIdx).trim()
      out.summary = rest.slice(sepIdx).replace(/^[ |｜,，、:：—\-]{1,}/, '').trim()
    } else if (rest.length <= 48) {
      out.title = rest
    } else {
      // 长句:前 46 个字符左右找断点
      const slice = rest.slice(0, 46)
      const brk = Math.max(slice.lastIndexOf('，'), slice.lastIndexOf(','), slice.lastIndexOf(' '))
      if (brk > 8) {
        out.title = rest.slice(0, brk).trim()
        out.summary = rest.slice(brk).replace(/^[，,、\s]+/, '').trim()
      } else {
        out.title = slice.trim()
        out.summary = rest.slice(46).trim()
      }
    }
  }

  if (!out.title && !out.summary && !out.likes && !out.plays && !out.collects) return null
  return out
}

/* ================= 表格模式(TSV / 竖线表 / Excel 粘贴) ================= */

type HeaderMap = Partial<Record<'date' | 'title' | 'likes' | 'collects' | 'plays', number>>

const HEADER_KEYS: Array<{ key: keyof HeaderMap; words: string[] }> = [
  { key: 'date', words: ['发布时间', '时间', '日期'] },
  { key: 'title', words: ['标题', '笔记', '作品', '名称'] },
  { key: 'likes', words: ['点赞', '喜欢', '爱心', '赞'] },
  { key: 'collects', words: ['收藏', '藏'] },
  { key: 'plays', words: ['播放', '浏览', '阅读', '观看', '小眼睛', 'view'] },
]

const CELL_NUM_RE = /^[\d.,]+\s*[万wWkK＋+]?$/i
const CELL_DATE_RE =
  /^\d{4}\s*[年.\-/]\s*\d{1,2}\s*[月.\-/]\s*\d{1,2}\s*日?$|^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$|^\d{1,2}\s*月\s*\d{1,2}\s*日?$/

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim())
  if ((line.match(/\|/g) ?? []).length >= 2) {
    const parts = line.split('|').map((c) => c.trim())
    if (parts[0] === '') parts.shift()
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
    return parts
  }
  return line.split(/\s{2,}/).map((c) => c.trim())
}

function detectHeaderMap(cells: string[]): HeaderMap | null {
  let hits = 0
  const map: HeaderMap = {}
  for (const { key, words } of HEADER_KEYS) {
    const idx = cells.findIndex((c) => {
      // 含数字的单元格不是列名(如数据行里的「赞1.2万」)
      if (/\d/.test(c)) return false
      const s = c.toLowerCase()
      return words.some((w) => s.includes(w.toLowerCase()))
    })
    if (idx >= 0) {
      map[key] = idx
      hits++
    }
  }
  return hits >= 2 ? map : null
}

function tableRowToWork(cells: string[], headerMap: HeaderMap | null): ParsedWork | null {
  const out: ParsedWork = { date: '', title: '', summary: '', likes: '', collects: '', plays: '' }

  /* ---- 有表头:按列名精确映射 ---- */
  if (headerMap) {
    const take = (idx: number | undefined): string =>
      idx !== undefined && idx < cells.length ? cells[idx].trim() : ''
    out.date = take(headerMap.date)
    out.title = take(headerMap.title)
    out.likes = take(headerMap.likes)
    out.collects = take(headerMap.collects)
    out.plays = take(headerMap.plays)

    const usedIdx = new Set(
      Object.values(headerMap).filter((x): x is number => x !== undefined),
    )
    const extras = cells
      .filter((_, i) => !usedIdx.has(i))
      .map((c) => c.trim())
      .filter((c) => c && !CELL_NUM_RE.test(c) && !CELL_DATE_RE.test(c))
    if (!out.title && extras.length > 0) out.title = extras.shift() as string
    out.summary = extras.join(' ')

    return out.title || out.summary || out.likes || out.collects || out.plays ? out : null
  }

  /* ---- 无表头:启发式 ---- */
  const used = new Set<number>()

  // 忽略明显的序号列(0~9 的个位数)
  cells.forEach((c, i) => {
    if (/^\d$/.test(c)) used.add(i)
  })

  // 日期列
  const dateIdx = cells.findIndex((c, i) => !used.has(i) && CELL_DATE_RE.test(c))
  if (dateIdx >= 0) {
    out.date = cells[dateIdx]
    used.add(dateIdx)
  }

  // 数字单元格(排除个位数序号)
  const numIdx = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => !used.has(i) && /\d/.test(c) && CELL_NUM_RE.test(c) && !/^\d$/.test(c))
    .map(({ i }) => i)
  numIdx.forEach((i) => used.add(i))
  const nums = numIdx.map((i) => cells[i])

  if (nums.length >= 2) {
    const values = nums.map((v) => parseCount(v) ?? 0)
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
    out.plays = nums[order[0]?.i ?? 0] ?? ''
    out.likes = nums[order[1]?.i ?? 0] ?? ''
    out.collects =
      nums.length === 2 ? '' : (nums[order[2]?.i ?? 0] ?? '')
  }

  // 文本单元格:最长的当标题,其余为摘要
  const textCells = cells
    .map((c, i) => ({ c: c.trim(), i }))
    .filter(({ c, i }) => c && !used.has(i) && !CELL_NUM_RE.test(c) && !CELL_DATE_RE.test(c))
  if (textCells.length > 0) {
    textCells.sort((a, b) => b.c.length - a.c.length)
    out.title = textCells[0]?.c ?? ''
    out.summary = textCells.slice(1).map((x) => x.c).join(' ')
  }

  return out.title || out.likes || out.collects || out.plays ? out : null
}

/* ================= 主入口 ================= */

function isTableLine(line: string): boolean {
  if (line.includes('\t')) return true
  if ((line.match(/\|/g) ?? []).length >= 2) return true
  return line.split(/\s{2,}/).length >= 3
}

/**
 * 把用户粘贴的历史作品文本解析成结构化条目。
 * 支持:① 创作者中心/Excel 表格直接粘贴(带表头自动对列,无表头按数量级猜列);
 *      ② 竖线分隔的表格行;③ 每行一条的随手记(关键词或「赞/藏/播」斜杠写法)。
 */
export function parseWorksText(raw: string): ParsedWork[] {
  const results: ParsedWork[] = []
  const lines = raw.split(/\r?\n/)
  let headerMap: HeaderMap | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length < 3) continue
    // markdown 分隔行(---|---)等
    if (/^[\s|:\-+]+$/.test(line)) continue

    if (isTableLine(line)) {
      const cells = splitCells(line)
      if (cells.length >= 2) {
        if (!headerMap) {
          const detected = detectHeaderMap(cells)
          if (detected) {
            headerMap = detected
            continue
          }
        }
        // 含数据关键词的"伪表格"行(如 `标题 | 赞1.2万 藏3400 播18万`)回落到行模式
        const metricKeywords = (
          line.match(/点赞量?|喜欢|收藏|播放量?|浏览量?|阅读量?|观看|小眼睛|赞|藏|播/g) ?? []
        ).length
        if (headerMap || metricKeywords < 2) {
          const row = tableRowToWork(cells, headerMap)
          if (row) results.push(row)
          continue
        }
      }
    }

    const parsed = parseLineMode(line)
    if (parsed) results.push(parsed)
  }

  return results
}

export function toWorkItems(parsed: ParsedWork[]): WorkItem[] {
  return parsed.map((p) => ({ ...newWork(), id: uid(), ...p }))
}
