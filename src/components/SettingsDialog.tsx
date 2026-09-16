import { useEffect, useState } from 'react'
import { ChevronDown, Eye, EyeOff, ExternalLink, KeyRound, PlugZap } from 'lucide-react'
import type { AIConfig } from '../lib/types'
import { testConnection } from '../lib/ai'
import { Badge, Button, Dialog, Field, Input, useToast } from './ui'
import { cn } from '../lib/utils'

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
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (open) {
      setBaseUrl(config.baseUrl)
      setApiKey(config.apiKey)
      setModel(config.model)
      setTestResult(null)
    }
  }, [open, config])

  async function handleTest() {
    if (!apiKey.trim()) {
      toast('info', '先填写 API Key 再测试')
      return
    }
    setTesting(true)
    setTestResult(null)
    const r = await testConnection({ baseUrl, apiKey, model })
    setTestResult({ ok: r.ok, message: r.message })
    setTesting(false)
  }

  function handleSave() {
    if (apiKey.trim() && !apiKey.trim().startsWith('sk-')) {
      toast('info', '提示:DeepSeek 的 Key 通常以 sk- 开头,请确认是否填对')
    }
    onSave({ baseUrl: baseUrl.trim() || 'https://api.deepseek.com', apiKey: apiKey.trim(), model: model.trim() || 'deepseek-chat' })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI 接口设置"
      subtitle="填入你自己的 API Key,方案由大模型实时生成;Key 只保存在这台设备的浏览器里。"
    >
      <div className="space-y-4">
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

        <Field
          label="接口地址"
          hint="默认 DeepSeek,可换任意 OpenAI 兼容接口"
        >
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
          <p className={cn('mt-1.5', !apiKey.trim() && 'text-amber-600')}>
            不填 Key 也可以:回到表单点击「先看演示效果」,用内置示例体验完整流程。
          </p>
        </div>

        {/* 常见问题 */}
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-stone-700">常见问题</p>
          {[
            {
              q: '生成一份方案要多久、花多少钱?',
              a: '流式生成约 1~3 分钟,全部内容逐模块实时出现;费用一般在几分钱以内。',
            },
            {
              q: '我的账号数据安全吗?',
              a: '所有数据只保存在这台设备的浏览器里;生成请求由你的浏览器直连你在上面填写的 AI 接口,本工具不经过、也不存储任何数据。',
            },
            {
              q: '提示生成失败怎么办?',
              a: '按错误提示处理:401 检查 Key、402 充值余额、429 稍后再试;网络波动可直接点「重试一次」,已生成部分不会丢。',
            },
            {
              q: '截图识别导入用什么模型?',
              a: '需要支持「看图」的视觉模型(如 gpt-5.5、gpt-4o 等);纯文本模型(如 DeepSeek-chat)不支持识别图片,会提示切换模型。',
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
