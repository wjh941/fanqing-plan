import { Database, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { DISCLAIMER } from '../lib/types'
import { Button, Dialog } from './ui'

function InfoRow({
  icon,
  title,
  desc,
}: {
  icon: ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500 shadow-sm">
        {icon}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-stone-800">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{desc}</p>
      </div>
    </div>
  )
}

/** 首次访问引导 */
export function WelcomeDialog({
  open,
  onClose,
  onDemo,
  onSettings,
}: {
  open: boolean
  onClose: () => void
  onDemo: () => void
  onSettings: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="pt-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-3xl shadow-[0_8px_20px_-8px_rgb(226_58_48/0.6)]">
          🌱
        </div>
        <h2 className="mt-4 text-xl font-bold text-stone-900">返青计划</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-stone-500">
          冬天的麦苗会枯黄,但根还活着——开春,就返青了。
          基于你自己账号的历史作品数据,AI 生成重启诊断、低风险选题、双平台文案和渐进式排期。
        </p>
      </div>
      <div className="mt-5 space-y-2.5">
        <InfoRow
          icon={<Sparkles className="h-4 w-4" />}
          title="只看你自己的数据"
          desc="分析优先基于你的历史爆款,不追全网大热点,避免打乱账号标签"
        />
        <InfoRow
          icon={<Database className="h-4 w-4" />}
          title="数据只存在本机"
          desc="账号信息与方案保存在这台设备的浏览器里,不上传任何服务器"
        />
        <InfoRow
          icon={<ShieldCheck className="h-4 w-4" />}
          title="低压力定位"
          desc="不承诺播放、涨粉等效果,方案仅供创作参考,按自己的节奏来"
        />
      </div>
      <div className="mt-6 space-y-2 pb-1">
        <Button className="w-full" onClick={onDemo}>
          先看演示效果(无需 Key)
        </Button>
        <Button variant="outline" className="w-full" onClick={onSettings}>
          配置 API Key,生成专属方案
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          直接开始填写
        </Button>
      </div>
    </Dialog>
  )
}

/** 隐私与免责声明 */
export function PrivacyDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="隐私与免责声明">
      <div className="space-y-4 text-[13px] leading-relaxed text-stone-600">
        <section>
          <h3 className="font-semibold text-stone-800">数据存在哪里?</h3>
          <p className="mt-1">
            你填写的账号信息、生成的方案、打卡记录全部只保存在本设备的浏览器(localStorage)中。
            本工具没有账号系统、没有自己的服务器,不会上传你的任何数据;清除浏览器数据或在「历史方案」里删除即彻底消失。
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-stone-800">AI 请求发到哪里?</h3>
          <p className="mt-1">
            点击生成时,你的浏览器会把表单内容直接发送到你在「设置」里填写的 AI
            接口(默认 DeepSeek 官方接口)用于生成方案,不经过任何第三方中转。
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-stone-800">内容准确性</h3>
          <p className="mt-1">
            AI 生成的诊断、选题与文案基于你提供的信息推理得出,可能存在偏差;请结合自己对账号的了解判断后再执行。
          </p>
        </section>
        <section className="rounded-xl bg-stone-50 p-3.5">
          <p className="font-medium text-stone-700">{DISCLAIMER}</p>
        </section>
      </div>
      <div className="mt-5 pb-1">
        <Button className="w-full" onClick={onClose}>
          我知道了
        </Button>
      </div>
    </Dialog>
  )
}
