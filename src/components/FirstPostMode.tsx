import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ImageIcon,
  PartyPopper,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import type { AccountForm } from '../lib/types'
import { POST_TEMPLATES, RETIRE_LINES, downloadMilestoneImage, fmtDateCNms, saveFirstPost } from '../lib/journey'
import { cn } from '../lib/utils'
import { Badge, Button, Card, Input, useToast } from './ui'

/**
 * 首发模式:不调用 AI、不生成方案,只陪用户完成「发出第一篇」这一个动作。
 * 三步:旧作退休 → 选首发内容 → 发布打卡 + 返青第 1 天纪念图。
 */
export function FirstPostMode({
  form,
  onBack,
  onFullPlan,
}: {
  form: AccountForm
  onBack: () => void
  onFullPlan: () => void
}) {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [retiredTitle, setRetiredTitle] = useState('')
  const [retireLine, setRetireLine] = useState(() => RETIRE_LINES[Math.floor(Math.random() * RETIRE_LINES.length)] ?? RETIRE_LINES[0]!)
  const [tplId, setTplId] = useState(POST_TEMPLATES[0]!.id)
  const [published, setPublished] = useState(false)

  const tpl = useMemo(() => POST_TEMPLATES.find((t) => t.id === tplId) ?? POST_TEMPLATES[0]!, [tplId])
  const post = useMemo(() => tpl.body(form.niche.trim()), [tpl, form.niche])
  const niche = form.niche.trim()

  if (published) {
    const now = Date.now()
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-10 text-center text-white">
            <PartyPopper className="mx-auto h-10 w-10" />
            <h1 className="mt-3 text-3xl font-bold tracking-tight">返青 · 第 1 天</h1>
            <p className="mt-2 text-sm text-white/85">
              {fmtDateCNms(now)}
              {niche ? ` · ${niche}` : ''} · 第一篇已发出
            </p>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-center text-[15px] font-medium leading-relaxed text-stone-800">
              发完就休息,今天你已经赢了。
              <br />
              <span className="text-[13px] text-stone-500">不保证流量,只保证你不再是一个断更的人。</span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => {
                  downloadMilestoneImage({ dayN: 1, niche, dateMs: now })
                  toast('success', '纪念图已保存,截图或相册分享都行')
                }}
              >
                <Download className="h-4 w-4" />
                保存「第 1 天」纪念图
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${post.title}\n\n${post.content}`).then(
                    () => toast('success', '文案已复制,发到平台就能用'),
                    () => toast('error', '复制失败,请手动长按选择文本'),
                  )
                }}
              >
                <Copy className="h-4 w-4" />
                复制首发文案
              </Button>
            </div>
            <button
              type="button"
              onClick={onFullPlan}
              className="block w-full rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="text-[13px] font-medium text-stone-700">想接着走 4 周?生成你的完整重启方案 →</span>
              <span className="mt-0.5 block text-xs text-stone-400">选题池、双平台文案、渐进排期,免费,约 3 分钟</span>
            </button>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-stone-400">
          这一刻就是高光时刻——纪念图可以直接发笔记,告诉所有人你回来了。
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-stone-400 transition-colors hover:text-stone-600"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </button>

      <div className="mb-6">
        <Badge tone="brand">
          <Sparkles className="h-3.5 w-3.5" />
          首发模式
        </Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900">今天只做一件事:把第一篇发出去</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
          不写长文、不用露脸、不需要任何配置,全程约 5 分钟。断更的人缺的不是计划,是第一篇。
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
          {['给旧作退休', '选首发内容', '发布打卡'].map((label, i) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                  i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-500 text-white' : 'bg-stone-200 text-stone-500',
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
              {i < 2 && <span className="text-stone-300">→</span>}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-stone-900">第 1 步:给一篇旧作品办退休</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            翻翻你的作品列表,挑一条你最想「翻篇」的(可以是数据最差、或你最不愿面对的那条)。
            建议把它<strong>设为私密</strong>——不是删除,随时能恢复;账号轻装上阵,心里也松一口气。
          </p>
          <div className="mt-4 space-y-3">
            <Input
              value={retiredTitle}
              onChange={(e) => setRetiredTitle(e.target.value)}
              placeholder="那篇旧作品的标题(选填,只是仪式感)"
            />
            <div className="rounded-xl bg-stone-50 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-stone-600">「{retireLine}」</p>
              <button
                type="button"
                onClick={() => {
                  const others = RETIRE_LINES.filter((l) => l !== retireLine)
                  setRetireLine(others[Math.floor(Math.random() * others.length)] ?? retireLine)
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                换一句
              </button>
            </div>
            <Button className="w-full" onClick={() => setStep(1)}>
              它退休了,继续 →
            </Button>
            <button type="button" onClick={() => setStep(1)} className="block w-full text-center text-xs text-stone-400 hover:text-stone-600">
              跳过,直接选首发内容
            </button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-stone-900">第 2 步:挑一条低风险首发内容</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">三条路都不用露脸、不用长文,选顺眼的那个。</p>
          <div className="mt-4 space-y-2.5">
            {POST_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTplId(t.id)}
                className={cn(
                  'block w-full rounded-xl border px-4 py-3 text-left transition-colors',
                  t.id === tplId ? 'border-brand-400 bg-brand-50/50' : 'border-stone-200 bg-white hover:border-stone-300',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-stone-800">{t.name}</span>
                  {t.id === tplId && (
                    <Badge tone="green">
                      <Check className="h-3 w-3" />
                      已选
                    </Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-stone-400">{t.desc}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
            <p className="text-xs font-semibold text-stone-500">为你生成好的正文(可直接复制)</p>
            <p className="mt-2 text-[13px] font-semibold text-stone-800">标题:{post.title}</p>
            <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-stone-600">{post.content}</pre>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${post.title}\n\n${post.content}`).then(
                    () => toast('success', '已复制,去平台发布吧'),
                    () => toast('error', '复制失败,请手动长按选择文本'),
                  )
                }}
              >
                <Copy className="h-4 w-4" />
                复制文案
              </Button>
              <p className="flex items-center gap-1 text-[11px] text-stone-400">
                <ImageIcon className="h-3.5 w-3.5" />
                配图随意:一张桌面照 / 手帐 / 截图都行
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>
              ← 上一步
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              文案拿到了,去发布 →
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-stone-900">第 3 步:发布后,回来打一勾</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            去{niche ? '小红书或抖音' : '平台'}发布刚复制的内容(设置私密可见也可以,先发出去最重要)。
            数据不用看,今天只负责「发」这个动作。
          </p>
          {retiredTitle && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
              已为「{retiredTitle}」办了退休仪式 ✓
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← 上一步
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                saveFirstPost({ retiredTitle: retiredTitle.trim() || undefined, templateId: tplId, publishedAt: Date.now() })
                setPublished(true)
                toast('success', '返青第 1 天,达成 🌱')
              }}
            >
              <Send className="h-4 w-4" />
              我发出去了 ✓
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-stone-400">点完这一下,今天就不欠自己什么了。</p>
        </Card>
      )}
    </div>
  )
}
