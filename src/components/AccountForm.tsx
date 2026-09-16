import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { parseWorksText, toWorkItems, type ParsedWork } from '../lib/parser'
import { extractWorksFromImage } from '../lib/vision'
import { DEMO_FORM } from '../lib/demo'
import { NICHE_PRESETS } from '../lib/niches'
import { GAP_OPTIONS, newWork } from '../lib/types'
import type { AccountForm as AccountFormData, AIConfig, WorkItem } from '../lib/types'
import { cn } from '../lib/utils'
import { Badge, Button, Card, Chip, Field, Input, Textarea, useToast } from './ui'
import { MicButton } from './MicButton'

const STEPS = ['账号信息', '历史作品', '目标确认']

function stepError(form: AccountFormData, step: number): string | null {
  if (step === 0) {
    if (!form.positioningConfused && !form.niche.trim())
      return '请先填写「账号赛道&人设」,这是一切分析的基础(实在没想好,就勾选「我还没想清楚定位」)'
    if (!form.gapDuration.trim()) return '请选择你的断更时长'
  }
  if (step === 1) {
    const ok = form.works.filter((w) => w.title.trim()).length
    if (ok < 3) return `历史作品至少需要 3 条(当前 ${ok} 条)。数据太少的话,诊断容易变成瞎猜,先补充几条吧`
  }
  if (step === 2) {
    if (!form.goal.trim()) return '写一句重启目标就好,比如「每周稳定更 2 条,找回账号感觉」'
  }
  return null
}

export function AccountForm({
  initial,
  generating,
  hasKey,
  aiConfig,
  onGenerate,
  onQuick,
  onDemo,
  onOpenSettings,
}: {
  initial: AccountFormData
  generating: boolean
  hasKey: boolean
  aiConfig: AIConfig
  onGenerate: (form: AccountFormData) => void
  onQuick?: (form: AccountFormData) => void
  onDemo: () => void
  onOpenSettings: () => void
}) {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<AccountFormData>(initial)
  const [stepMsg, setStepMsg] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [parsed, setParsed] = useState<ParsedWork[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')

  useEffect(() => setForm(initial), [initial])

  const set = (patch: Partial<AccountFormData>) => setForm((f) => ({ ...f, ...patch }))
  const setWork = (id: string, patch: Partial<WorkItem>) =>
    setForm((f) => ({ ...f, works: f.works.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
  const removeWork = (id: string) =>
    setForm((f) => ({ ...f, works: f.works.filter((w) => w.id !== id) }))
  const addWork = () => setForm((f) => ({ ...f, works: [...f.works, newWork()] }))

  const filledWorks = form.works.filter((w) => w.title.trim())

  function go(next: number) {
    if (next > step) {
      const err = stepError(form, step)
      if (err) {
        setStepMsg(err)
        return
      }
    }
    setStepMsg(null)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function composeNiche() {
    const parts = [
      q1.trim() && `平时发得最多:${q1.trim()}`,
      q2.trim() && `观众常夸:${q2.trim()}`,
      q3.trim() && `身份/背景:${q3.trim()}`,
    ].filter(Boolean)
    if (parts.length === 0) {
      toast('info', '先随便回答一两个小问题,我帮你拼')
      return
    }
    set({ niche: parts.join(';') })
    toast('success', '已拼好你的初步定位,可以继续修改')
  }

  function fillExample() {
    setForm(structuredClone(DEMO_FORM))
    setStepMsg(null)
    toast('info', '已填入示例账号,你可以随意修改或直接体验')
  }

  function doParse() {
    const r = parseWorksText(pasteText)
    setParsed(r)
    setSelected(new Set(r.map((_, i) => i)))
    if (r.length > 0) toast('success', `解析出 ${r.length} 条,勾选后添加`)
  }

  async function readClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        setPasteText(text)
        toast('success', '已从剪贴板读入,点「解析」或直接 Ctrl+Enter')
      } else {
        toast('info', '剪贴板是空的,先去创作者中心复制作品列表')
      }
    } catch {
      toast('info', '浏览器未授权读取剪贴板,请手动 Ctrl+V 粘贴')
    }
  }

  /** 图片压缩:限制最大边长,转 JPEG,控制请求体积 */
  async function fileToDataUrl(file: File): Promise<string> {
    try {
      const bitmap = await createImageBitmap(file)
      const maxDim = 1600
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no ctx')
      ctx.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()
      return canvas.toDataURL('image/jpeg', 0.85)
    } catch {
      return new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(new Error('读取图片失败'))
        fr.readAsDataURL(file)
      })
    }
  }

  async function handleScreenshots(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!hasKey) {
      toast('info', '截图识别需要先配置 AI 接口')
      onOpenSettings()
      return
    }
    setExtracting(true)
    try {
      const found: ParsedWork[] = []
      for (const file of Array.from(files).slice(0, 5)) {
        const dataUrl = await fileToDataUrl(file)
        found.push(...(await extractWorksFromImage(aiConfig, dataUrl)))
      }
      if (found.length === 0) {
        toast('info', '截图里没找到作品列表,试试只截「作品列表」那一块')
        return
      }
      const merged = [...(parsed ?? [])]
      for (const w of found) {
        if (!merged.some((m) => m.title === w.title && m.date === w.date)) merged.push(w)
      }
      setParsed(merged)
      setSelected(new Set(merged.map((_, i) => i)))
      toast('success', `从截图识别出 ${found.length} 条,勾选后添加`)
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '截图识别失败,请重试')
    } finally {
      setExtracting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function confirmAdd() {
    if (!parsed) return
    const items = toWorkItems(parsed.filter((_, i) => selected.has(i)))
    if (items.length === 0) {
      toast('info', '还没有勾选任何条目')
      return
    }
    setForm((f) => ({
      ...f,
      works: [...f.works.filter((w) => w.title.trim()), ...items],
    }))
    setParsed(null)
    setPasteText('')
    toast('success', `已添加 ${items.length} 条作品,记得检查一下数据`)
  }

  return (
    <Card className="overflow-hidden">
      {/* 步骤条 */}
      <div className="border-b border-stone-100 px-5 pb-4 pt-5 sm:px-7">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (            <div key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => i < step && go(i)}
                className={cn(
                  'flex items-center gap-2 text-[13px] font-medium',
                  i <= step ? 'text-stone-900' : 'text-stone-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    i < step
                      ? 'bg-brand-500 text-white'
                      : i === step
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-400',
                  )}
                >
                  {i + 1}
                </span>
                <span className={cn(i === 2 && 'hidden sm:inline')}>{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-stone-200">
                  <div
                    className={cn('h-px bg-brand-400 transition-all duration-500', i < step ? 'w-full' : 'w-0')}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-right text-[11px] text-stone-300">
          3 步 · 约 3 分钟 · 方案与打卡只存本机
        </p>
      </div>

      <div className="px-5 py-5 sm:px-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {/* ---------- Step 0 账号信息 ---------- */}
            {step === 0 && (
              <>
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      账号赛道 &amp; 人设
                      <MicButton getValue={() => form.niche} onChange={(v) => set({ niche: v })} />
                    </span>
                  }
                  required={!form.positioningConfused}
                  hint={form.positioningConfused ? '迷茫模式下选填,定位交给 AI 反推' : '做什么领域 + 什么风格,可以语音说'}
                >
                  <Textarea
                    value={form.niche}
                    onChange={(e) => set({ niche: e.target.value })}
                    placeholder={
                      form.positioningConfused
                        ? '不确定?可以留空,或只写你发过的内容类型'
                        : '例:家居好物分享,普通租房女孩,不是专业博主,风格像朋友聊天'
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => set({ positioningConfused: !form.positioningConfused })}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                    form.positioningConfused
                      ? 'border-brand-300 bg-brand-50/60'
                      : 'border-stone-200 bg-white hover:bg-stone-50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      form.positioningConfused
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-stone-300 bg-white',
                    )}
                  >
                    {form.positioningConfused && <Check className="h-3 w-3" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-stone-800">
                      我还没想清楚定位,也不知道自己的爆点在哪
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-stone-400">
                      选上它:AI 会从你的历史作品反推 2~3 个可选定位,并推荐先按哪个方向跑 4 周
                    </span>
                  </span>
                </button>
                {form.positioningConfused && (
                  <div className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                    <p className="text-xs leading-relaxed text-stone-500">
                      不知道怎么写?回答这几个小问题,我帮你拼成定位描述(选答,说个大概就行):
                    </p>
                    <Input value={q1} onChange={(e) => setQ1(e.target.value)} placeholder="① 你平时发得最多的是哪类内容?" />
                    <Input value={q2} onChange={(e) => setQ2(e.target.value)} placeholder="② 别人在评论区夸过你什么?(如:真实/专业/好笑)" />
                    <Input value={q3} onChange={(e) => setQ3(e.target.value)} placeholder="③ 你的职业/身份/特长是什么?(选填)" />
                    <Button size="sm" variant="outline" onClick={composeNiche}>
                      <Wand2 className="h-4 w-4" />
                      帮我拼一下
                    </Button>
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs text-stone-400">相近赛道一键填入,填完可自由修改:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {NICHE_PRESETS.map((p) => (
                      <Chip
                        key={p.label}
                        active={form.niche === p.text}
                        onClick={() => set({ niche: p.text })}
                      >
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <Field label="断更多久了" required>
                  <div className="flex flex-wrap gap-2">
                    {GAP_OPTIONS.map((opt) => (
                      <Chip
                        key={opt}
                        active={form.gapDuration === opt}
                        onClick={() => set({ gapDuration: form.gapDuration === opt ? '' : opt })}
                      >
                        {opt}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="断更原因" hint="选填,有助于给出更贴合的建议">
                  <Textarea
                    className="min-h-[64px]"
                    value={form.gapReason}
                    onChange={(e) => set({ gapReason: e.target.value })}
                    placeholder="例:工作变忙 + 数据变差没动力,越停越不敢发"
                  />
                </Field>
                <button
                  type="button"
                  onClick={fillExample}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                >
                  <Wand2 className="h-4 w-4" />
                  没想法?一键填入示例账号
                </button>
              </>
            )}

            {/* ---------- Step 1 历史作品 ---------- */}
            {step === 1 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-stone-800">历史作品</span>
                  <Badge tone={filledWorks.length >= 3 ? 'green' : 'brand'}>
                    {filledWorks.length} / 至少 3 条
                  </Badge>
                  <span className="text-xs text-stone-400">优先填爆过的 · 只有标题必填,数据填个大概就行</span>
                </div>

                {/* 作品只有 1~2 条时的轻量出口 */}
                {filledWorks.length > 0 && filledWorks.length < 3 && onQuick && (
                  <button
                    type="button"
                    onClick={() => onQuick(form)}
                    className="flex w-full items-start gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-3.5 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <span>
                      <span className="text-[13px] font-medium text-stone-700">作品凑不够 3 条?先拿一份快速诊断</span>
                      <span className="mt-0.5 block text-xs text-stone-400">
                        只用现有作品给初步判断:有效方向 + 第一周建议 + 今天能做的一件小事,约 1 分钟
                      </span>
                    </span>
                  </button>
                )}

                {/* 粘贴导入(主路径) */}
                <div className="rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/70 to-white p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardPaste className="h-4 w-4 text-brand-500" />
                    <p className="text-[13px] font-semibold text-stone-800">推荐:整段粘贴,不用一条条填</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    去小红书 / 抖音「创作者中心」的作品列表,选中含表头的几行直接复制粘贴过来(Excel 表格也可以);
                    或者每行一条随手记,我来自动拆。
                  </p>
                  <Textarea
                    className="mt-2.5 min-h-[96px] bg-white"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doParse()
                    }}
                    placeholder={'例 1|创作者中心复制的表格(含表头整段粘贴):\n发布时间 | 笔记标题 | 浏览量 | 点赞量 | 收藏量\n2024-05-12 | 300块改造出租屋阳台 | 18万 | 1.2万 | 3400\n\n例 2|每行一条随手记:\n2024-05-12 300块改造阳台 赞1.2万 藏3400 播18万'}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="hidden text-[11px] text-stone-400 sm:block">
                      带表头自动对列 · 无表头按数量级识别 · Ctrl+Enter 快速解析
                    </p>
                    <div className="flex flex-1 justify-end gap-2 sm:flex-none">
                      <Button size="sm" variant="outline" onClick={() => void readClipboard()}>
                        <ClipboardPaste className="h-4 w-4" />
                        读取剪贴板
                      </Button>
                      <Button size="sm" onClick={doParse} disabled={!pasteText.trim()}>
                        <Sparkles className="h-4 w-4" />
                        解析
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-brand-100" />
                    <span className="text-[11px] text-stone-400">或者</span>
                    <div className="h-px flex-1 bg-brand-100" />
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleScreenshots(e.target.files)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    loading={extracting}
                    disabled={extracting}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {extracting ? '正在识别截图…' : '截图识别导入(支持多张,手机相册也行)'}
                  </Button>

                  {parsed && parsed.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs text-stone-500">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-brand-500"
                          checked={selected.size === parsed.length}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked ? new Set(parsed.map((_, i) => i)) : new Set(),
                            )
                          }
                        />
                        全选({selected.size}/{parsed.length})· 识别不准?添加后可直接修改
                      </label>
                      <div className="max-h-56 space-y-1.5 overflow-y-auto scroll-slim">
                        {parsed.map((p, i) => (
                          <label
                            key={i}
                            className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200/70 bg-white p-2.5 text-xs"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-500"
                              checked={selected.has(i)}
                              onChange={(e) => {
                                const next = new Set(selected)
                                if (e.target.checked) next.add(i)
                                else next.delete(i)
                                setSelected(next)
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-stone-700">
                                {p.title || '(未识别到标题)'}
                              </span>
                              <span className="mt-0.5 block text-stone-400">
                                {[p.date, p.likes && `赞${p.likes}`, p.collects && `藏${p.collects}`, p.plays && `播${p.plays}`]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <Button size="sm" onClick={confirmAdd} className="w-full">
                        添加选中的 {selected.size} 条
                      </Button>
                    </div>
                  )}
                  {parsed && parsed.length === 0 && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                      没有解析出有效条目。试试保留表头一起复制,或改用「每行一条 + 关键词(赞/藏/播)」的写法。
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  {form.works.map((w, idx) => (
                    <div key={w.id} className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-400">
                          作品 {String(idx + 1).padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeWork(w.id)}
                          className="rounded-full p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="删除这条作品"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={w.title}
                          onChange={(e) => setWork(w.id, { title: e.target.value })}
                          placeholder="作品标题(必填)"
                        />
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Input
                            value={w.date}
                            onChange={(e) => setWork(w.id, { date: e.target.value })}
                            placeholder="发布时间"
                          />
                          <Input
                            value={w.likes}
                            onChange={(e) => setWork(w.id, { likes: e.target.value })}
                            placeholder="点赞"
                            inputMode="text"
                          />
                          <Input
                            value={w.collects}
                            onChange={(e) => setWork(w.id, { collects: e.target.value })}
                            placeholder="收藏"
                          />
                          <Input
                            value={w.plays}
                            onChange={(e) => setWork(w.id, { plays: e.target.value })}
                            placeholder="播放"
                          />
                        </div>
                        <Textarea
                          className="min-h-[52px]"
                          value={w.summary}
                          onChange={(e) => setWork(w.id, { summary: e.target.value })}
                          placeholder="内容简述:这条讲了什么(一两句话即可)"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={addWork}>
                    <Plus className="h-4 w-4" />
                    手动加一条
                  </Button>
                </div>
              </>
            )}

            {/* ---------- Step 2 目标确认 ---------- */}
            {step === 2 && (
              <>
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      重启目标
                      <MicButton getValue={() => form.goal} onChange={(v) => set({ goal: v })} />
                    </span>
                  }
                  required
                  hint="不追求立刻爆也没关系"
                >
                  <Textarea
                    value={form.goal}
                    onChange={(e) => set({ goal: e.target.value })}
                    placeholder="例:每周稳定更新,慢慢找回流量,不追求立刻爆"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => set({ wantsMonetize: !form.wantsMonetize })}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                    form.wantsMonetize
                      ? 'border-brand-300 bg-brand-50/60'
                      : 'border-stone-200 bg-white hover:bg-stone-50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      form.wantsMonetize
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-stone-300 bg-white',
                    )}
                  >
                    {form.wantsMonetize && <Check className="h-3 w-3" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-stone-800">
                      💰 我想知道后续怎么变现
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-stone-400">
                      选上它:方案会多一个「变现路径规划」模块,按重启节奏分阶段给合规建议——不承诺收益,只给路线
                    </span>
                  </span>
                </button>

                <div className="rounded-xl bg-stone-50 p-4 text-[13px] leading-relaxed text-stone-500">
                  <p className="mb-1.5 font-medium text-stone-700">生成前最后确认</p>
                  <p>
                    赛道人设:{form.positioningConfused && !form.niche.trim() ? '迷茫,AI 反推' : form.niche.trim() || '—'} ·
                    断更:{form.gapDuration || '—'} · 作品:{filledWorks.length} 条
                    {form.wantsMonetize ? ' · 含变现模块' : ''}
                  </p>
                  <p className="mt-1 text-xs">
                    账号信息与方案保存在你的浏览器本机;点「生成」时,为了让 AI 生成方案,必要表单内容会经站内代理转发给模型服务商。本工具不建账号、不保存你的历史方案。
                  </p>
                </div>

                {!hasKey && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      生成服务暂不可用。可在「设置」里检查托管服务状态,或配置自己的 API Key;也可以先看演示数据,体验完整流程。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={onOpenSettings}>
                        去设置 API Key
                      </Button>
                      <Button size="sm" variant="ghost" onClick={onDemo}>
                        先看演示效果 →
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {stepMsg && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {stepMsg}
          </motion.div>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/50 px-5 py-4 sm:px-7">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" />
          上一步
        </Button>
        {step < 2 ? (
          <Button onClick={() => go(step + 1)}>
            下一步
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => onGenerate(form)} loading={generating} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            {generating ? '生成中…' : '生成我的重启方案'}
          </Button>
        )}
      </div>
    </Card>
  )
}
