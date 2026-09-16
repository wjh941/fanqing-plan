import { ArrowRight, CalendarCheck } from 'lucide-react'
import type { CheckItem, CheckRecord, SavedPlan } from '../lib/types'
import { fmtDateTime } from '../lib/utils'
import { Button, Card } from './ui'

/** 首页的回访唤醒横幅:让老用户一进来就看到自己的重启进度 */
export function ResumeBanner({
  plan,
  items,
  records,
  onOpen,
}: {
  plan: SavedPlan
  items: CheckItem[]
  records: Record<string, CheckRecord>
  onOpen: () => void
}) {
  const done = items.filter((i) => records[i.id]?.done).length
  const next = items.find((i) => !records[i.id]?.done)
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0

  return (
    <Card className="mb-5 border-brand-100 bg-gradient-to-r from-brand-50/80 to-white p-4 print-plain">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800">
            <CalendarCheck className="h-4 w-4 shrink-0 text-brand-500" />
            继续你的返青计划
          </p>
          <p className="mt-1 truncate text-xs text-stone-500">
            {plan.title} · 生成于 {fmtDateTime(plan.createdAt).slice(0, 10)} · 已完成 {done}/{items.length}
          </p>
          {next && <p className="mt-0.5 truncate text-xs text-stone-400">下一件事:{next.title}</p>}
        </div>
        <Button size="sm" onClick={onOpen}>
          打开方案
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
        断了几天也没关系,回来接着打卡就行——重启本来就允许反复。
      </p>
    </Card>
  )
}
