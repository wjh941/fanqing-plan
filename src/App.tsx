import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Settings, Sprout } from 'lucide-react'
import { AccountForm } from './components/AccountForm'
import { HistoryDrawer } from './components/HistoryDrawer'
import { ResumeBanner } from './components/ResumeBanner'
import { ReportView } from './components/ReportView'
import { SettingsDialog } from './components/SettingsDialog'
import { Badge, Button, Card, ToastProvider, useToast } from './components/ui'
import { streamChat } from './lib/ai'
import { DEMO_FORM, DEMO_REPORT } from './lib/demo'
import { extractSchedule, replaceModule } from './lib/modules'
import { buildMessages, buildRefineMessages } from './lib/prompt'
import {
  deletePlan,
  isOnboarded,
  listPlans,
  loadChecklist,
  loadConfig,
  loadDraft,
  saveChecklist,
  saveConfig,
  saveDraft,
  savePlan,
  setOnboarded,
  updatePlanReport,
} from './lib/storage'
import { DISCLAIMER } from './lib/types'
import type {
  AccountForm as AccountFormData,
  AIConfig,
  CheckItem,
  CheckRecord,
  SavedPlan,
} from './lib/types'
import { uid } from './lib/utils'
import { PrivacyDialog, WelcomeDialog } from './components/InfoDialogs'

const HERO_POINTS = [
  '基于你的历史爆款,而非全网爆款',
  '低压力 · 渐进式重启',
  '小红书文案 + 抖音口播一次给全',
]

/** 演示模式:模拟流式输出内置报告 */
function streamDemoText(
  signal: AbortSignal,
  onDelta: (s: string) => void,
): Promise<string> {
  return new Promise((resolve) => {
    let i = 0
    const step = 14
    const tick = () => {
      if (signal.aborted) {
        resolve(DEMO_REPORT.slice(0, i))
        return
      }
      if (i >= DEMO_REPORT.length) {
        resolve(DEMO_REPORT)
        return
      }
      onDelta(DEMO_REPORT.slice(i, i + step))
      i += step
      window.setTimeout(tick, 10)
    }
    tick()
  })
}

function Shell() {
  const toast = useToast()
  const [config, setConfig] = useState<AIConfig>(() => loadConfig())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [plans, setPlans] = useState<SavedPlan[]>(() => listPlans())
  const [form, setForm] = useState<AccountFormData>(() => loadDraft())
  const [view, setView] = useState<'form' | 'report'>('form')
  const [currentForm, setCurrentForm] = useState<AccountFormData>(DEMO_FORM)
  const [createdAt, setCreatedAt] = useState<number>(() => Date.now())
  const [report, setReport] = useState('')
  const [demo, setDemo] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refining, setRefining] = useState<{ n: number; buffer: string } | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [checkItems, setCheckItems] = useState<CheckItem[]>([])
  const [checkRecords, setCheckRecords] = useState<Record<string, CheckRecord>>({})
  const [welcomeOpen, setWelcomeOpen] = useState(() => !isOnboarded())
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const hasKey = config.apiKey.trim().length > 0

  /* 回访唤醒:找到最近一份带打卡清单的方案 */
  const resume = useMemo(() => {
    if (view !== 'form') return null
    for (const p of plans) {
      const cl = loadChecklist(p.id)
      const items = cl.items.length > 0 ? cl.items : (p.schedule ?? [])
      if (items.length > 0) return { plan: p, items, records: cl.records }
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, view])

  /* 草稿自动保存,防中途退出丢失 */
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(form), 400)
    return () => window.clearTimeout(t)
  }, [form])

  function persistPlan(
    f: AccountFormData,
    fullReport: string,
    isDemo: boolean,
    schedule?: CheckItem[],
  ): string {
    const id = uid()
    const plan: SavedPlan = {
      id,
      createdAt: Date.now(),
      title: f.niche.trim().slice(0, 24) || '未命名账号',
      demo: isDemo,
      form: f,
      report: fullReport,
      ...(schedule && schedule.length > 0 ? { schedule } : {}),
    }
    setPlans(savePlan(plan))
    setSavedId(id)
    return id
  }

  function persistChecklist(
    planId: string | null,
    items: CheckItem[],
    records: Record<string, CheckRecord>,
  ) {
    if (planId) saveChecklist(planId, { items, records })
  }

  async function runGeneration(f: AccountFormData, isDemo: boolean) {
    if (streaming) return
    setCurrentForm(f)
    setCreatedAt(Date.now())
    setReport('')
    setError(null)
    setRefining(null)
    setSavedId(null)
    setDemo(isDemo)
    setView('report')
    setStreaming(true)
    window.scrollTo({ top: 0 })

    const ac = new AbortController()
    abortRef.current = ac
    const onDelta = (d: string) => setReport((r) => r + d)

    try {
      const full = isDemo
        ? await streamDemoText(ac.signal, onDelta)
        : await streamChat(config, buildMessages(f), onDelta, ac.signal)

      if (ac.signal.aborted) {
        toast('info', '已停止生成,已完成的部分保留')
      } else if (full.trim().length < 200) {
        setError('AI 返回的内容过短,可能是模型名称或参数配置问题。建议在「设置」里检查模型(如 deepseek-chat),然后重试。')
      } else {
        const { items: schedule, report: cleaned } = extractSchedule(full)
        setReport(cleaned)
        persistPlan(f, cleaned, isDemo, schedule)
        setCheckItems(schedule)
        setCheckRecords({})
        toast('success', isDemo ? '演示方案已生成(内置示例数据)' : '方案生成完成,已保存到「历史方案」')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      toast('error', '生成失败,请检查网络与设置')
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleGenerate = (f: AccountFormData) => {
    if (!hasKey) {
      toast('info', '请先在「设置」里填 API Key,或先体验演示数据')
      setSettingsOpen(true)
      return
    }
    void runGeneration(f, false)
  }

  const handleDemo = () => void runGeneration(structuredClone(DEMO_FORM), true)

  const handleStop = () => abortRef.current?.abort()

  async function handleRefine(n: number, instruction: string) {
    if (demo) {
      toast('info', '演示模式不支持微调,配置 API Key 后即可使用')
      return
    }
    if (!hasKey || streaming) return
    const ac = new AbortController()
    abortRef.current = ac
    setRefining({ n, buffer: '' })
    setStreaming(true)

    try {
      const final = await streamChat(
        config,
        buildRefineMessages(currentForm, report, n, instruction),
        (d) => setRefining((r) => (r ? { ...r, buffer: r.buffer + d } : r)),
        ac.signal,
      )
      if (!ac.signal.aborted && final.trim()) {
        const parsed = [...final.matchAll(/#{2,4}\s*模块\s*([1-6])/g)]
        let content = final
        if (parsed.length > 0) {
          // 取目标模块标题之后到结尾(去掉尾部免责声明由 replaceModule 保留)
          const targetIdx = parsed.findIndex((m) => Number(m[1]) === n)
          if (targetIdx >= 0) {
            const match = parsed[targetIdx]
            content = final.slice(match.index)
          }
        }
        const headingRe = new RegExp(`^#{2,4}\\s*模块\\s*${n}\\s*[:：]?[^\\n]*\\n?`)
        content = content.replace(headingRe, '').replace(/本方案仅为内容创作策略参考[^。]*。?\s*$/, '').trim()
        const newReport = replaceModule(report, n, content)
        setReport(newReport)
        if (savedId) updatePlanReport(savedId, newReport)
        toast('success', `模块 ${n} 已按你的要求重写`)
      } else if (ac.signal.aborted) {
        toast('info', '已停止微调')
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '微调失败,请稍后重试')
    } finally {
      setRefining(null)
      setStreaming(false)
      abortRef.current = null
    }
  }

  const toggleCheck = (id: string, done: boolean) => {
    const next: Record<string, CheckRecord> = {
      ...checkRecords,
      [id]: { ...checkRecords[id], done, doneAt: done ? Date.now() : undefined },
    }
    setCheckRecords(next)
    persistChecklist(savedId, checkItems, next)
  }

  const saveStats = (id: string, stats: CheckRecord['stats']) => {
    const next: Record<string, CheckRecord> = {
      ...checkRecords,
      [id]: { ...checkRecords[id], done: checkRecords[id]?.done ?? false, stats: { ...checkRecords[id]?.stats, ...stats } },
    }
    setCheckRecords(next)
    persistChecklist(savedId, checkItems, next)
  }

  const addCheckItem = (title: string) => {
    const item: CheckItem = {
      id: uid(),
      week: 0,
      when: '自定义',
      title,
      kind: '巩固标签内容',
      difficulty: '中',
    }
    const nextItems = [...checkItems, item]
    setCheckItems(nextItems)
    persistChecklist(savedId, nextItems, checkRecords)
  }

  const deleteCheckItem = (id: string) => {
    const nextItems = checkItems.filter((i) => i.id !== id)
    const nextRecords = { ...checkRecords }
    delete nextRecords[id]
    setCheckItems(nextItems)
    setCheckRecords(nextRecords)
    persistChecklist(savedId, nextItems, nextRecords)
  }

  function openPlan(p: SavedPlan) {
    setCurrentForm(p.form)
    setForm(p.form)
    setCreatedAt(p.createdAt)
    setReport(p.report)
    setDemo(p.demo)
    setSavedId(p.id)
    setError(null)
    setRefining(null)
    const saved = loadChecklist(p.id)
    setCheckItems(saved.items.length > 0 ? saved.items : (p.schedule ?? []))
    setCheckRecords(saved.records)
    setView('report')
    setHistoryOpen(false)
    window.scrollTo({ top: 0 })
  }

  function backToForm() {
    setView('form')
    setRefining(null)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-dvh">
      {/* 背景装饰 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute left-[-12%] top-[38%] h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute bottom-[-8%] right-[18%] h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" />
      </div>

      {/* 顶栏 */}
      <header className="no-print sticky top-0 z-40 border-b border-stone-200/60 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_4px_12px_-4px_rgb(226_58_48/0.5)]">
              <Sprout className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-stone-900">返青计划</p>
              <p className="hidden text-xs text-stone-400 sm:block">断更账号重启与陪伴 · 小红书 & 抖音</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">历史方案</span>
              {plans.length > 0 && <Badge>{plans.length}</Badge>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">设置</span>
              {!hasKey && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        {view === 'form' ? (
          <>
            {resume && (
              <div className="pt-5">
                <ResumeBanner
                  plan={resume.plan}
                  items={resume.items}
                  records={resume.records}
                  onOpen={() => openPlan(resume.plan)}
                />
              </div>
            )}
            <section className="pb-6 pt-6 text-center sm:pt-10">
              <Badge tone="brand" className="mb-4">
                🌱 返青计划 · 停更是蓄力,不是终点
              </Badge>
              <h1 className="text-[26px] font-bold leading-snug text-stone-900 sm:text-4xl sm:leading-tight">
                停更不可怕,
                <br className="sm:hidden" />
                我们慢慢把账号养回来
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-500 sm:text-[15px]">
                基于你自己账号的历史作品数据,生成重启诊断、低风险选题、双平台文案和渐进式排期。
                不追热点、不承诺流量,只帮你重新开始。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {HERO_POINTS.map((p) => (
                  <Badge key={p} tone="neutral">
                    {p}
                  </Badge>
                ))}
              </div>
              <button
                type="button"
                onClick={handleDemo}
                className="mt-4 text-xs font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline"
              >
                没填过?先看一份示例方案,30 秒感受输出效果 →
              </button>
            </section>

            {/* 价值对比:诚实回答「为什么不用自己问 AI」 */}
            <section className="pb-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="p-4 print-plain">
                  <p className="text-[13px] font-semibold text-stone-500">直接问通用 AI</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-stone-400">
                    <li>· 你得自己想问什么、准备什么背景资料</li>
                    <li>· 容易得到「正确的废话」,越看越焦虑</li>
                    <li>· 聊完就散,报告之后没有然后</li>
                  </ul>
                </Card>
                <Card className="border-brand-100 bg-brand-50/40 p-4 print-plain">
                  <p className="text-[13px] font-semibold text-brand-700">用「重启计划」</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-stone-600">
                    <li>· 问题已替你问对:5 大模块 + 防跑偏规则内置</li>
                    <li>· 每条结论锚定你自己的历史爆款,不空谈</li>
                    <li>· 报告之后还有打卡清单,陪你走完 4 周</li>
                  </ul>
                </Card>
              </div>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-stone-400">
                你当然可以自己写提示词问 AI——我们只是把这条路上踩过的坑,都提前替你铺好了。
              </p>
            </section>

            <AccountForm
              initial={form}
              generating={streaming}
              hasKey={hasKey}
              aiConfig={config}
              onGenerate={handleGenerate}
              onDemo={handleDemo}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </>
        ) : (
          <div className="pt-5 sm:pt-8">
            <ReportView
              form={currentForm}
              createdAt={createdAt}
              report={report}
              demo={demo}
              streaming={streaming}
              error={error}
              refining={refining}
              checkItems={checkItems}
              checkRecords={checkRecords}
              onRefine={(n, instruction) => void handleRefine(n, instruction)}
              onStop={handleStop}
              onBack={backToForm}
              onRetry={() => void runGeneration(currentForm, demo)}
              onToggleCheck={toggleCheck}
              onSaveStats={saveStats}
              onAddCheckItem={addCheckItem}
              onDeleteCheckItem={deleteCheckItem}
            />
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="no-print border-t border-stone-200/60 bg-white/50 px-4 py-6 text-center sm:px-6">
        <p className="text-xs leading-relaxed text-stone-400">{DISCLAIMER}</p>
        <p className="mt-1.5 text-xs text-stone-300">
          账号数据仅保存在本设备浏览器,不上传任何服务器 · 内容策略辅助工具,不是流量外挂
        </p>
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="mt-2 text-xs text-stone-400 underline-offset-2 transition-colors hover:text-stone-600 hover:underline"
        >
          隐私与免责声明
        </button>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSave={(cfg) => {
          setConfig(cfg)
          saveConfig(cfg)
          toast('success', cfg.apiKey ? '设置已保存,可以开始生成了' : '设置已保存(未填 Key,可先体验演示)')
        }}
      />
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        plans={plans}
        onOpenPlan={openPlan}
        onDelete={(id) => {
          setPlans(deletePlan(id))
          if (savedId === id) setSavedId(null)
          toast('success', '已删除')
        }}
      />
      <WelcomeDialog
        open={welcomeOpen}
        onClose={() => {
          setOnboarded()
          setWelcomeOpen(false)
        }}
        onDemo={() => {
          setOnboarded()
          setWelcomeOpen(false)
          handleDemo()
        }}
        onSettings={() => {
          setOnboarded()
          setWelcomeOpen(false)
          setSettingsOpen(true)
        }}
      />
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}
