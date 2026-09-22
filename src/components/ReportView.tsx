import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  CalendarRange,
  CircleDollarSign,
  FileText,
  CheckCircle2,
  Copy,
  Download,
  Gauge,
  Lightbulb,
  List,
  Loader2,
  PenTool,
  Printer,
  RefreshCcw,
  Square,
  Stethoscope,
  Wand2,
  X,
} from 'lucide-react'
import { DISCLAIMER, MODULES } from '../lib/types'
import type { AccountForm, CheckItem, CheckRecord, ModuleMeta } from '../lib/types'
import { moduleComplete, splitReport, stripFirstHeading } from '../lib/modules'
import { buildFullMarkdown, copyText, downloadMarkdown } from '../lib/export'
import { cn, fmtDateTime } from '../lib/utils'
import { Badge, Button, Card, Dialog, Markdown, Skeleton, Textarea, useToast } from './ui'
import { CheckinCard } from './CheckinCard'

const moduleIcons: Record<number, typeof Stethoscope> = {
  1: Stethoscope,
  2: Lightbulb,
  3: PenTool,
  4: CalendarRange,
  5: Gauge,
  6: CircleDollarSign,
}

const REFINE_PRESETS = [
  '再口语化一点,像平时聊天',
  '执行起来再省事一点,我是新手',
  '选题方向整体换一批',
  '多考虑我没时间拍摄的情况',
]

function Cursor() {
  return <span className="animate-blink ml-0.5 inline-block text-brand-500">▍</span>
}

function TocRow({
  label,
  target,
  active,
  onJump,
}: {
  label: string
  target: string
  active: boolean
  onJump: (target: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onJump(target)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          active ? 'bg-brand-500' : 'bg-stone-200',
        )}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}

/** 返回顶部悬浮钮:滚动超过一屏后出现(长报告导航补全) */
function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="返回顶部"
          className="no-print fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-500 shadow-[var(--shadow-pop)] backdrop-blur transition-colors hover:text-brand-600 sm:right-6"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export function ReportView({
  form,
  createdAt,
  report,
  demo,
  streaming,
  error,
  refining,
  checkItems,
  checkRecords,
  checkStartDate,
  onChangeCheckStartDate,
  onRefine,
  onStop,
  onBack,
  onRetry,
  onToggleCheck,
  onSaveStats,
  onAddCheckItem,
  onDeleteCheckItem,
}: {
  form: AccountForm
  createdAt: number
  report: string
  demo: boolean
  streaming: boolean
  error: string | null
  refining: { n: number; buffer: string } | null
  checkItems: CheckItem[]
  checkRecords: Record<string, CheckRecord>
  checkStartDate?: string
  onChangeCheckStartDate?: (d: string) => void
  onRefine: (n: number, instruction: string) => void
  onStop: () => void
  onBack: () => void
  onRetry: () => void
  onToggleCheck: (id: string, done: boolean) => void
  onSaveStats: (id: string, stats: CheckRecord['stats']) => void
  onAddCheckItem: (title: string) => void
  onDeleteCheckItem: (id: string) => void
}) {
  const toast = useToast()
  const [refineTarget, setRefineTarget] = useState<number | null>(null)
  const [refineText, setRefineText] = useState('')
  const [tocOpen, setTocOpen] = useState(false)

  const { preamble, modules, trailing } = useMemo(() => splitReport(report), [report])
  const done = !streaming && !error && report.length > 0 && moduleComplete(report)
  const nextItem = done ? checkItems.find((i) => !checkRecords[i.id]?.done) : undefined
  const allChecked = done && checkItems.length > 0 && !nextItem

  /* ---- 流式输出时,只要用户没往上翻,就跟随滚动到底部 ---- */
  const pinnedRef = useRef(true)
  const scrollTimer = useRef<number | null>(null)
  useEffect(() => {
    const onScroll = () => {
      pinnedRef.current =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 280
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!streaming || !pinnedRef.current) return
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }, 160)
    return () => {
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    }
  }, [report, streaming])

  const filledWorks = form.works.filter((w) => w.title.trim()).length

  type Item =
    | { meta: ModuleMeta; has: true; content: string; live: boolean }
    | { meta: ModuleMeta; has: false }

  const items: Item[] = MODULES.map((meta) => {
    const refiningThis = refining?.n === meta.n
    if (refiningThis && refining) {
      return { meta, has: true, content: stripFirstHeading(refining.buffer), live: true }
    }
    const found = modules.find((m) => m.n === meta.n)
    if (found) {
      return {
        meta,
        has: true,
        content: found.content,
        live: streaming && refining === null && found.n === modules[modules.length - 1]?.n,
      }
    }
    return { meta, has: false }
  })
  const firstMissing = items.find((x) => !x.has)

  async function copyModule(heading: string, content: string) {
    const ok = await copyText(`${heading}\n\n${content}`)
    toast(ok ? 'success' : 'error', ok ? '已复制该模块' : '复制失败,请长按文本手动复制')
  }

  function submitRefine() {
    if (refineTarget === null || !refineText.trim()) return
    onRefine(refineTarget, refineText.trim())
    setRefineTarget(null)
    setRefineText('')
  }

  function jump(target: string) {
    setTocOpen(false)
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      {/* ---------- 方案摘要卡 ---------- */}
      <Card className="p-5 print-plain sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-stone-900">返青方案</h2>
              {demo ? (
                <Badge tone="amber">演示数据</Badge>
              ) : (
                <Badge tone="green">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  专属方案
                </Badge>
              )}
              {streaming && (
                <Badge tone="brand">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  生成中
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              生成于 {fmtDateTime(createdAt)} · 基于 {filledWorks} 条历史作品
            </p>
          </div>
          {streaming && (
            <Button variant="outline" size="sm" onClick={onStop}>
              <Square className="h-3.5 w-3.5" />
              停止生成
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="neutral" className="max-w-full">
            <span className="truncate">{form.niche || '未填写赛道'}</span>
          </Badge>
          <Badge tone="neutral">断更 {form.gapDuration || '—'}</Badge>
        </div>

        {preamble && (
          <div className="mt-3 rounded-xl bg-stone-50 p-4">
            <Markdown text={preamble} className="text-[13px]" />
          </div>
        )}

        {!streaming && modules.length > 0 && (
          <div className="no-print mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ok = await copyText(buildFullMarkdown(report, form))
                toast(ok ? 'success' : 'error', ok ? '整份方案已复制' : '复制失败')
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              复制全部
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadMarkdown(report, form)}>
              <Download className="h-3.5 w-3.5" />
              导出 .md
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              打印 / 存 PDF
            </Button>
          </div>
        )}
      </Card>

      {/* ---------- 今天只做一件事:把报告转化为即时行动 ---------- */}
      {done && nextItem && (
        <Card className="border-brand-200 bg-gradient-to-r from-brand-50/80 to-white p-5 print-plain">
          <p className="text-[13px] font-semibold text-stone-800">
            🎯 报告看完了?先别贪多——今天只做一件事
          </p>
          <p className="mt-2 text-[15px] font-semibold text-brand-700">{nextItem.title}</p>
          <p className="mt-1 text-xs text-stone-400">
            {[nextItem.when, nextItem.kind, nextItem.difficulty && `难度 ${nextItem.difficulty}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => onToggleCheck(nextItem.id, true)}>
              做完了,标记打卡 ✓
            </Button>
            <span className="text-xs text-stone-400">打完卡就休息,别连着卷</span>
          </div>
        </Card>
      )}
      {done && allChecked && (
        <Card className="border-emerald-100 bg-emerald-50/60 p-5 print-plain">
          <p className="text-[13px] font-semibold text-emerald-700">🎉 这一轮 4 周清单,你全部完成了</p>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-600">
            能坚持走完,已经跑赢了上次断更的自己。想继续,就用新数据再生成一份方案,或在打卡清单里手动补充下一条。
          </p>
        </Card>
      )}

      {/* ---------- 重启打卡清单 ---------- */}
      {!streaming && checkItems.length > 0 && (
        <CheckinCard
          items={checkItems}
          records={checkRecords}
          startDate={checkStartDate}
          planTitle={form.niche ? `${form.niche}重启方案` : '重启方案'}
          onStartDate={onChangeCheckStartDate}
          onToggle={onToggleCheck}
          onSaveStats={onSaveStats}
          onAdd={onAddCheckItem}
          onDelete={onDeleteCheckItem}
        />
      )}

      {/* ---------- 完成横幅 ---------- */}
      {done && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-[13px] leading-relaxed text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          方案生成完成,已自动保存到「历史方案」。顺手「导出 .md」存到手机;然后先通读模块 1
          的诊断,再按打卡清单、照模块 4 的节奏慢慢执行——不着急。
        </motion.div>
      )}

      {/* ---------- 不完整提示 ---------- */}
      {!streaming && !error && report.length > 0 && !done && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          内容还没生成完整(可能中途停止了)。已有部分仍然有效,你可以返回重新生成,或直接对现有模块「微调」补齐。
        </div>
      )}

      {/* ---------- 错误提示 ---------- */}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="flex items-start gap-2 text-sm font-medium text-red-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            生成失败了
          </p>
          <p className="mt-2 break-all text-[13px] leading-relaxed text-red-500">{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCcw className="h-3.5 w-3.5" />
              重试一次
            </Button>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              返回检查信息与设置
            </Button>
          </div>
        </div>
      )}

      {/* ---------- 模块卡片 ---------- */}
      {items.map((item, idx) => {
        if (!item.has) {
          const isNext = item === firstMissing
          if (!streaming || !isNext) return null
          return (
            <Card key={item.meta.n} className="p-5 print-plain">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-4/6" />
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-stone-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI 正在写:模块 {item.meta.n} · {item.meta.title}
              </p>
              {item === firstMissing && (
                <p className="mt-1 text-[11px] text-stone-300">
                  完整方案约需 1~3 分钟;推理型模型会先思考一阵子,暂时不出字是正常的
                </p>
              )}
            </Card>
          )
        }

        // 防御:未知模块号(未来扩展)时回退到通用图标,避免 <undefined/> 白屏
        const Icon = moduleIcons[item.meta.n] ?? FileText
        const showSkeletonBody = item.live && item.content.length < 40
        return (
          <motion.div
            key={item.meta.n}
            id={`module-${item.meta.n}`}
            className="scroll-mt-20"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.12) }}
          >
            <Card className="overflow-hidden print-plain">
              <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-gradient-to-r from-brand-50/60 to-transparent px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_4px_12px_-4px_rgb(226_58_48/0.5)]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-stone-900">
                      模块 {item.meta.n} · {item.meta.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-400">{item.meta.blurb}</p>
                  </div>
                </div>
                <div className="no-print flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyModule(item.meta.title, item.content)}
                    disabled={item.content.length === 0}
                    className="rounded-full p-2 text-stone-400 transition-colors hover:bg-white hover:text-brand-600 disabled:opacity-40"
                    aria-label="复制本模块"
                    title="复制本模块"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefineTarget(item.meta.n)}
                    disabled={streaming || demo}
                    className="rounded-full p-2 text-stone-400 transition-colors hover:bg-white hover:text-brand-600 disabled:opacity-40"
                    aria-label="微调本模块"
                    title={demo ? '演示模式不支持微调' : '微调本模块'}
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                {showSkeletonBody ? (
                  <div className="space-y-2.5 py-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ) : (
                  <Markdown text={item.content} />
                )}
                {item.live && <Cursor />}
              </div>
            </Card>
          </motion.div>
        )
      })}

      {/* ---------- 报告为空且非流式(异常兜底) ---------- */}
      {!streaming && report.length === 0 && !error && (
        <Card className="p-8 text-center text-sm text-stone-500">
          方案内容为空,请返回重新生成。
        </Card>
      )}

      {/* ---------- 免责声明 ---------- */}
      {(trailing || (!streaming && report.length > 0)) && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-4 py-3 text-center text-xs leading-relaxed text-stone-400">
          {trailing ? trailing.replace(/^>\s*/gm, '') : DISCLAIMER}
        </div>
      )}

      {/* ---------- 底部操作 ---------- */}
      {!streaming && report.length > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-4 pt-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            返回修改信息 / 重新生成
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUp className="h-4 w-4" />
            回到顶部
          </Button>
        </div>
      )}

      {/* ---------- 悬浮目录导航 ---------- */}
      {(modules.length > 0 || checkItems.length > 0) && !error && (
        <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
          {tocOpen && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setTocOpen(false)} />
              <Card className="w-48 p-1.5 shadow-pop">
                {checkItems.length > 0 && (
                  <TocRow label="打卡清单" target="checkin-card" active={done} onJump={jump} />
                )}
                {MODULES.map((m) => {
                  const found = modules.find((x) => x.n === m.n)
                  // 模块6(变现)为可选项,未生成时不显示目录项
                  if (m.n === 6 && !found) return null
                  return (
                    <TocRow
                      key={m.n}
                      label={`${m.n} · ${m.title}`}
                      target={`module-${m.n}`}
                      active={!!found && found.content.length > 0 && !streaming}
                      onJump={jump}
                    />
                  )
                })}
                <TocRow label="回到顶部" target="top" active={false} onJump={jump} />
              </Card>
            </>
          )}
          <button
            type="button"
            onClick={() => setTocOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-white shadow-pop transition-transform active:scale-95"
            aria-label="报告目录"
          >
            {tocOpen ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
          </button>
        </div>
      )}

      {/* ---------- 微调对话框 ---------- */}
      <Dialog
        open={refineTarget !== null}
        onClose={() => setRefineTarget(null)}
        title={`微调 · 模块 ${refineTarget ?? ''} ${MODULES.find((m) => m.n === refineTarget)?.title ?? ''}`}
        subtitle="只重写这一个模块,其余内容保持不变。说得越具体,改得越准。"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REFINE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRefineText(p)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  refineText === p
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50',
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Textarea
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="例:选题里不要有需要出镜的,我只方便拍产品和手部操作"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">微调会重新调用 AI,消耗少量额度</p>
            <Button onClick={submitRefine} disabled={!refineText.trim()}>
              <Wand2 className="h-4 w-4" />
              开始微调
            </Button>
          </div>
        </div>
      </Dialog>
      <BackToTop />
    </div>
  )
}
