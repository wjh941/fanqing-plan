import { useEffect, useState } from 'react'
import { ChevronDown, Eye, EyeOff, ExternalLink, KeyRound, PlugZap } from 'lucide-react'
import type { AIConfig } from '../lib/types'
import { isManaged, MANAGED_API, testConnection } from '../lib/ai'
import { Badge, Button, Chip, Dialog, Field, Input, useToast } from './ui'

export function SettingsDialog({
  open,
  onClose,
  config,
  onSave,
}: {
  open: boolean
  onClose: () => void
  config: AIConfig
  onSave: (cfg: AIConfig) => void
}) {
  const toast = useToast()
  const [mode, setMode] = useState<'managed' | 'own'>(config.mode === 'own' ? 'own' : 'managed')
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (open) {
      setMode(config.mode === 'own' ? 'own' : 'managed')
      setBaseUrl(config.baseUrl)
      setApiKey(config.apiKey)
      setModel(config.model)
      setTestResult(null)
    }
  }, [open, config])

  const effective = { mode, baseUrl, apiKey, model }

  async function handleTest() {
    if (!isManaged(effective) && !apiKey.trim()) {
      toast('info', '先填写 API Key 再测试')
      return
    }
    setTesting(true)
    setTestResult(null)
    const r = await testConnection(effective)
    setTestResult({ ok: r.ok, message: r.message })
    setTesting(false)
  }

  function handleSave() {
    if (mode === 'own') {
      if (!apiKey.trim()) {
        toast('info', '自定义接口模式需要填写 API Key;或切回「托管生成」')
        return
      }
      if (!apiKey.trim().startsWith('sk-')) {
        toast('info', '提示:多数平台的 Key 以 sk- 开头,请确认是否填对')
      }
    }
    onSave({
      mode,
      baseUrl: baseUrl.trim() || 'https://api.deepseek.com',
      apiKey: apiKey.trim(),
      model: model.trim() || 'deepseek-chat',
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI 接口设置"
      subtitle="默认使用托管生成服务,打开就能用,无需注册和配置;进阶用户可切换为自己的接口。"
    >
      <div className="space-y-4">
        {/* 模式切换 */}
        <div>
          <p className="mb-1.5 text-xs text-stone-400">生成方式</p>
          <div className="flex gap-2">
            <Chip active={mode === 'managed'} onClick={() => setMode('managed')}>
              托管生成(推荐)
            </Chip>
            <Chip active={mode === 'own'} onClick={() => setMode('own')}>
              自定义接口(高级)
            </Chip>
          </div>
          {mode === 'managed' && (
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              免 Key 直接用,由站内代理统一调度,每设备每日有免费次数。方案与打卡只存本机;点生成时会转发必要的生成内容给模型服务商。
            </p>
          )}
        </div>

        {mode === 'own' && (
          <>
            <Field label="API Key" required>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
                <Input
                  className="pl-9 pr-10"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
                  aria-label={showKey ? '隐藏' : '显示'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field label="接口地址" hint="默认 DeepSeek,可换任意 OpenAI 兼容接口(中转地址一般要带 /v1)">
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com"
              />
            </Field>

            <Field label="模型">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
                list="model-options"
              />
              <datalist id="model-options">
                <option value="deepseek-chat" />
                <option value="deepseek-reasoner" />
              </datalist>
            </Field>

            <div className="rounded-xl bg-stone-50 p-4 text-xs leading-relaxed text-stone-500">
              <p>
                还没有 Key?前往{' '}
                <a
                  href="https://platform.deepseek.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline"
                >
                  DeepSeek 开放平台
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                注册并创建,费用很低(生成一份方案通常不到 1 分钱)。
              </p>
              <p className="mt-1.5">自定义模式下,生成请求由你的浏览器直连所填接口,数据不经任何中间服务。</p>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleTest} loading={testing}>
            <PlugZap className="h-4 w-4" />
            测试连接
          </Button>
          {testResult && (
            <Badge tone={testResult.ok ? 'green' : 'amber'} className="max-w-[70%]">
              <span className="truncate">{testResult.message}</span>
            </Badge>
          )}
        </div>

        {/* 常见问题 */}
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-stone-700">常见问题</p>
          {[
            {
              q: '托管生成和自己填 Key 有什么区别?',
              a: '托管生成:打开就能用,零配置,每设备每日有限定次数;自定义接口:填入自己的 Key,无次数限制,请求由浏览器直连接口,费用自己控制。',
            },
            {
              q: '生成一份方案要多久?',
              a: '流式生成约 1~3 分钟,内容按模块实时出现;推理型模型会先思考一阵子,暂不出字属正常。',
            },
            {
              q: '我的账号数据安全吗?',
              a: '分两块说——①保存:方案、打卡、历史记录只保存在这台设备的浏览器里,本工具不建账号、不存历史;②生成:点生成时,必要的表单内容会经站内代理转发给模型服务商(托管模式),或由浏览器直连你填的接口(自定义模式)。',
            },
            {
              q: '提示生成失败怎么办?',
              a: '按错误提示处理:429 是今日体验次数用完(可切换自定义接口)、401 检查 Key、402 充值余额;网络波动可直接点「重试一次」,已生成部分不会丢。',
            },
            {
              q: '截图识别导入用什么模型?',
              a: '需要支持「看图」的视觉模型(托管服务已配置视觉模型,可直接用);若用自定义接口,纯文本模型(如 DeepSeek-chat)不支持识别图片。',
            },
          ].map((f) => (
            <details key={f.q} className="group rounded-xl border border-stone-200 px-3.5 py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-medium text-stone-700 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">{f.a}</p>
            </details>
          ))}
        </div>

        <p className="text-center text-[11px] text-stone-300">
          托管服务地址:{MANAGED_API || '当前站点自带(同源)'}
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
