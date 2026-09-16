import type { CheckItem } from './types'

/** 把某个日期字符串(YYYY-MM-DD)加 n 天,返回 YYYY-MM-DD */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD → 9月17日 */
export function fmtDateCN(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}月${Number(d)}日`
}

interface DatedItem {
  item: CheckItem
  date: string | null
}

/** 按「开始日 + 周数」给清单条目计算具体日期;week=0(自定义)不分配日期 */
export function dateItems(items: CheckItem[], startDate?: string): DatedItem[] {
  const counters: Record<number, number> = {}
  return items.map((item) => {
    if (!startDate || !item.week || item.week < 1) return { item, date: null }
    const idx = counters[item.week] ?? 0
    counters[item.week] = idx + 1
    return { item, date: addDays(startDate, (item.week - 1) * 7 + idx) }
  })
}

function icsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** 生成 .ics 日历文件内容(全天事件) */
export function buildIcs(items: CheckItem[], startDate: string, planTitle: string): string {
  const dated = dateItems(items, startDate).filter((x) => x.date !== null)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//fanqing-plan//CN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:返青计划 · ' + planTitle.slice(0, 30),
  ]
  for (const { item, date } of dated) {
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + item.id + '@fanqing-plan',
      'DTSTART;VALUE=DATE:' + icsDate(date as string),
      'DTEND;VALUE=DATE:' + icsDate(addDays(date as string, 1)),
      'SUMMARY:' + escapeIcs('返青打卡:' + item.title),
      'DESCRIPTION:' + escapeIcs([item.when, item.kind, item.difficulty ? '难度 ' + item.difficulty : ''].filter(Boolean).join(' · ')),
      'BEGIN:VALARM',
      'TRIGGER;DURATION=PT10H',
      'ACTION:DISPLAY',
      'DESCRIPTION:返青计划提醒',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(items: CheckItem[], startDate: string, planTitle: string): void {
  const blob = new Blob([buildIcs(items, startDate, planTitle)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '返青排期.ics'
  a.click()
  URL.revokeObjectURL(url)
}
