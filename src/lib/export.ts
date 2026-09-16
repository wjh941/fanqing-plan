import { DISCLAIMER } from './types'
import type { AccountForm } from './types'
import { fmtDateTime } from './utils'

export function buildFullMarkdown(report: string, form: AccountForm): string {
  const lines: string[] = []
  lines.push('# 返青方案')
  lines.push('')
  lines.push('> 停更是蓄力,不是终点。')
  lines.push(`> 账号赛道&人设:${form.niche.trim() || '未填写'}`)
  lines.push(`> 断更时长:${form.gapDuration.trim() || '未填写'} · 历史作品:${form.works.filter((w) => w.title.trim()).length} 条`)
  lines.push(`> 生成时间:${fmtDateTime(Date.now())}`)
  lines.push('')
  lines.push(report.trim())
  if (!report.includes(DISCLAIMER)) {
    lines.push('')
    lines.push(`> ${DISCLAIMER}`)
  }
  return lines.join('\n')
}

export function downloadMarkdown(report: string, form: AccountForm): void {
  const md = buildFullMarkdown(report, form)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const tag = (form.niche.trim() || '账号').slice(0, 12).replace(/[\\/:*?"<>|\s]+/g, '-')
  a.href = url
  a.download = `返青方案-${tag}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
