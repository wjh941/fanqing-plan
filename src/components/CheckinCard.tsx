import { useMemo, useState } from 'react'
import { CalendarCheck, CalendarDays, Check, Download, FlaskConical, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { CheckItem, CheckRecord } from '../lib/types'
import { dateItems, downloadIcs, fmtDateCN } from '../lib/ics'
import { cn, fmtDateTime, parseCount } from '../lib/utils'
import { Badge, Button, Card, Chip, Dialog, Input, useToast } from './ui'

const WEEK_GROUPS: Array<{ w: number; label: string }> = [
  { w: 1, label: '第 1 周 · 测试期' },
  { w: 2, label: '第 2 周 · 小幅加量' },
  { w: 3, label: '第 3~4 周 · 稳步提升' },
  { w: 0, label: '自定义' },
]

export function CheckinCard({
  items,
  records,
  startDate,
  planTitle,
  onStartDate,
  onToggle,
  onSaveStats,
  onAdd,
  onDelete,
}: {
  items: CheckItem[]
  records: Record<string, CheckRecord>
  /** 返青开始日(YYYY-MM-DD);不传则默认今天 */
  startDate?: string
  planTitle?: string
  onStartDate?: (d: string) => void
  onToggle: (id: string, done: boolean) => void
  onSaveStats: (id: string, stats: CheckRecord['stats']) => void
  onAdd: (title: string) => void
  onDelete: (id: string) => void
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [reflecting, setReflecting] = useState<CheckItem | null>(null)
  const [ans, setAns] = useState<{ q1: string; q2: string; q3: string }>({ q1: '', q2: '', q3: '' })

  const effectiveStart = startDate || new Date().toISOString().slice(0, 10)
  const dated = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const d of dateItems(items, effectiveStart)) map.set(d.item.id, d.date)
    return map
  }, [items, effectiveStart])

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

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          <CalendarDays className="h-3.5 w-3.5" />
          返青开始日
          <input
            type="date"
            className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700"
            value={effectiveStart}
            onChange={(e) => onStartDate?.(e.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            downloadIcs(items, effectiveStart, planTitle || '重启方案')
            toast('success', '日历文件已下载,导入手机日历即可按天提醒')
          }}
        >
          <Download className="h-4 w-4" />
          导出日历(.ics)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onAdd('降档任务:发一张图+一句话,维持账号活跃(约10分钟)')
            toast('info', '已加入降档任务——今天只想躺着,就做这一条')
          }}
        >
          <RotateCcw className="h-4 w-4" />
          今天没状态?降档
        </Button>
      </div>

      {/* 预期管理:前 3 篇不盯数据 */}
      {doneCount < 3 && (
        <p className="mt-3 rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-amber-700">
          先说好:重启后的前 3 篇笔记,数据差是常态——平台在重新认识你,这是流程的一部分,不是你的能力判决。
          前 3 篇建议发布满 24 小时再回来看数据,我们只统计「你做了没有」,不评判数据好坏。
        </p>
      )}

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
          const weekDates = group
            .map((i) => dated.get(i.id))
            .filter((d): d is string => Boolean(d))
          const range =
            weekDates.length > 0
              ? w === 0
                ? ''
                : ` · ${fmtDateCN(weekDates[0])}${weekDates.length > 1 ? '~' + fmtDateCN(weekDates[weekDates.length - 1]) : ''}`
              : ''
          return (
            <div key={w}>
              <p className="mb-2 text-xs font-semibold text-stone-500">
                {label}
                {range}
              </p>
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
                            {dated.get(item.id) && (
                              <span className="inline-flex items-center gap-1 font-medium text-stone-500">
                                <CalendarDays className="h-3 w-3" />
                                {fmtDateCN(dated.get(item.id) as string)}
                              </span>
                            )}
                            {item.when && <span>{item.when}</span>}
                            <Badge tone={item.kind.includes('测试') ? 'amber' : 'green'}>
                              {item.kind.includes('测试') ? '测试内容' : '巩固标签'}
                            </Badge>
                            {item.difficulty && <span>难度 {item.difficulty}</span>}
                            {done && rec?.doneAt && <span>完成于 {fmtDateTime(rec.doneAt)}</span>}
                          </div>
                          {!done && item.detail && (
                            <p className="mt-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-stone-500">
                              {item.detail}
                            </p>
                          )}
                          {done && (
                            <>
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
                              <button
                                type="button"
                                onClick={() => setReflecting(item)}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 transition-colors hover:text-brand-700"
                              >
                                <FlaskConical className="h-3.5 w-3.5" />
                                数据不理想?花 30 秒复盘三问
                              </button>
                            </>
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
          打卡数据只存本机;播放/赞藏填个大概就行,复盘看的是趋势,不是比大小。
        </p>
      </div>

      {/* 复盘三问:把失败翻译成下一个实验 */}
      <Dialog open={reflecting !== null} onClose={() => setReflecting(null)} title="复盘三问" subtitle="30 秒,把「我不行」翻译成「下一个变量」">
        {reflecting && (
          <div className="space-y-4 text-[13px] leading-relaxed text-stone-600">
            <p className="rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-700">
              先说结论:这一条不是失败,是一份数据。重启期前几篇播放几十到几千都属常见区间,别跟别人的爆款比,以你自己的第一条为基准线。
            </p>
            {(
              [
                ['q1', '前 3 秒,别人会留下来吗?', ['大概率会', '多半划走了', '没数据/说不准']],
                ['q2', '选题是大众痛点,还是偏自嗨?', ['大众痛点', '偏自嗨', '说不准']],
                ['q3', '形式是平台当下喜欢的吗?', ['图文/视频选对了', '形式可能不合适', '说不准']],
              ] as const
            ).map(([key, question, options]) => (
              <div key={key}>
                <p className="font-medium text-stone-700">{question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {options.map((o) => (
                    <Chip key={o} active={ans[key] === o} onClick={() => setAns((a) => ({ ...a, [key]: o }))}>
                      {o}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
            {(ans.q1 || ans.q2 || ans.q3) && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <p className="text-[13px] font-semibold text-stone-800">下一篇实验:只改一个变量</p>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">{experimentText(ans)}</p>
                <p className="mt-1.5 text-[11px] text-stone-400">其他所有东西都不变——一次只改一个,才知道是哪个在起作用。</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    onAdd(`实验:${experimentText(ans).slice(0, 30)}`)
                    setReflecting(null)
                    setAns({ q1: '', q2: '', q3: '' })
                    toast('success', '已加入打卡清单,下一篇就按这个来')
                  }}
                >
                  <Plus className="h-4 w-4" />
                  把这条实验加进清单
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </Card>
  )
}

/** 根据三问回答,给出"只改一个变量"的具体实验(纯本地规则,不调用 AI) */
function experimentText(ans: { q1: string; q2: string; q3: string }): string {
  if (ans.q1 === '多半划走了') return '只换开头钩子:第一句直接给结论或利益点,删掉所有铺垫,正文其他部分保持不变。'
  if (ans.q2 === '偏自嗨') return '只换选题角度:领域不变,挑一个大众都会遇到的痛点问题来写,形式复制这一篇。'
  if (ans.q3 === '形式可能不合适') return '只换形式:图文换短视频(或反过来),内容框架照搬这一篇。'
  return '只换封面和标题:数字式或悬念式二选一重写,正文一个字不动。'
}
