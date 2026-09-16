import { useMemo, useState } from 'react'
import { CalendarCheck, Check, Plus, Trash2 } from 'lucide-react'
import type { CheckItem, CheckRecord } from '../lib/types'
import { cn, fmtDateTime, parseCount } from '../lib/utils'
import { Badge, Button, Card, Input, useToast } from './ui'

const WEEK_GROUPS: Array<{ w: number; label: string }> = [
  { w: 1, label: '第 1 周 · 测试期' },
  { w: 2, label: '第 2 周 · 小幅加量' },
  { w: 3, label: '第 3~4 周 · 稳步提升' },
  { w: 0, label: '自定义' },
]

export function CheckinCard({
  items,
  records,
  onToggle,
  onSaveStats,
  onAdd,
  onDelete,
}: {
  items: CheckItem[]
  records: Record<string, CheckRecord>
  onToggle: (id: string, done: boolean) => void
  onSaveStats: (id: string, stats: CheckRecord['stats']) => void
  onAdd: (title: string) => void
  onDelete: (id: string) => void
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const doneCount = items.filter((i) => records[i.id]?.done).length
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0

  const trend = useMemo(() => {
    const plays = items
      .filter((i) => records[i.id]?.done)
      .map((i) => parseCount(records[i.id]?.stats?.plays ?? ''))
      .filter((n): n is number => n !== null)
    if (plays.length === 0) return null
    if (plays.length === 1) {
      return {
        tone: 'info' as const,
        text: '第一条已记录,这就是你重启期的基准线。之后每条和它比一比就行,不用跟别人比。',
      }
    }
    const baseline = plays[0] as number
    const latest = plays[plays.length - 1] as number
    if (latest >= baseline) {
      return {
        tone: 'up' as const,
        text: `最近一条播放 ${latest.toLocaleString()} ≥ 基准线 ${baseline.toLocaleString()},账号大概率在回暖的路上(仅参考,单条波动很正常)。`,
      }
    }
    return {
      tone: 'down' as const,
      text: '最近一条播放低于基准线——单条波动说明不了什么,连续 4~6 条再下结论,先别否定自己。',
    }
  }, [items, records])

  function confirmAdd() {
    const t = newTitle.trim()
    if (!t) {
      toast('info', '先写一下这条内容是什么')
      return
    }
    onAdd(t)
    setNewTitle('')
    setAdding(false)
    toast('success', '已加入打卡清单')
  }

  return (
    <Card id="checkin-card" className="scroll-mt-20 p-5 print-plain">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 text-white">
            <CalendarCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-stone-900">重启打卡清单</h3>
            <p className="mt-0.5 text-xs text-stone-400">按模块 4 的排期生成,发一条勾一条,只和自己比</p>
          </div>
        </div>
        <Badge tone={doneCount > 0 ? 'green' : 'neutral'}>
          <Check className="h-3.5 w-3.5" />
          {doneCount} / {items.length}
        </Badge>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {trend && (
        <p
          className={cn(
            'mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed',
            trend.tone === 'up'
              ? 'bg-emerald-50 text-emerald-700'
              : trend.tone === 'down'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-stone-50 text-stone-500',
          )}
        >
          {trend.text}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {WEEK_GROUPS.map(({ w, label }) => {
          const group = items.filter((i) => i.week === w)
          if (group.length === 0) return null
          return (
            <div key={w}>
              <p className="mb-2 text-xs font-semibold text-stone-500">{label}</p>
              <div className="space-y-2">
                {group.map((item) => {
                  const rec = records[item.id]
                  const done = !!rec?.done
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'group rounded-xl border p-3 transition-colors',
                        done ? 'border-emerald-100 bg-emerald-50/40' : 'border-stone-200 bg-white',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                          checked={done}
                          onChange={(e) => onToggle(item.id, e.target.checked)}
                          aria-label={`标记「${item.title}」为已发布`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'text-[13px] font-medium',
                              done ? 'text-stone-400' : 'text-stone-800',
                            )}
                          >
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
                            {item.when && <span>{item.when}</span>}
                            <Badge tone={item.kind.includes('测试') ? 'amber' : 'green'}>
                              {item.kind.includes('测试') ? '测试内容' : '巩固标签'}
                            </Badge>
                            {item.difficulty && <span>难度 {item.difficulty}</span>}
                            {done && rec?.doneAt && <span>完成于 {fmtDateTime(rec.doneAt)}</span>}
                          </div>
                          {done && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <Input
                                className="h-8 px-2 py-1 text-xs"
                                value={rec?.stats?.plays ?? ''}
                                onChange={(e) => onSaveStats(item.id, { plays: e.target.value })}
                                placeholder="播放(选填)"
                              />
                              <Input
                                className="h-8 px-2 py-1 text-xs"
                                value={rec?.stats?.likes ?? ''}
                                onChange={(e) => onSaveStats(item.id, { likes: e.target.value })}
                                placeholder="点赞"
                              />
                              <Input
                                className="h-8 px-2 py-1 text-xs"
                                value={rec?.stats?.collects ?? ''}
                                onChange={(e) => onSaveStats(item.id, { collects: e.target.value })}
                                placeholder="收藏"
                              />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="rounded-full p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="删除这条打卡"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-stone-100 pt-3">
        {adding ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmAdd()}
              placeholder="想补充的内容,如:随手发的日常"
            />
            <Button size="sm" onClick={confirmAdd}>
              添加
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-400 transition-colors hover:text-brand-600"
          >
            <Plus className="h-3.5 w-3.5" />
            手动补充一条
          </button>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-stone-300">
          数据只存在本机;播放/赞藏填个大概就行,复盘看的是趋势,不是比大小。
        </p>
      </div>
    </Card>
  )
}
