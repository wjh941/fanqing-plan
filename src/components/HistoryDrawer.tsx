import { useState } from 'react'
import { CalendarDays, FileText, Trash2 } from 'lucide-react'
import type { SavedPlan } from '../lib/types'
import { fmtDateTime } from '../lib/utils'
import { Badge, Button, Dialog } from './ui'

export function HistoryDrawer({
  open,
  onClose,
  plans,
  onOpenPlan,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  plans: SavedPlan[]
  onOpenPlan: (plan: SavedPlan) => void
  onDelete: (id: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <Dialog open={open} onClose={onClose} side title="历史方案" subtitle="保存在这台设备的浏览器里,不会上传到任何服务器">
      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
            <FileText className="h-5 w-5 text-stone-400" />
          </div>
          <p className="text-sm text-stone-500">
            还没有保存的方案
            <br />
            <span className="text-xs text-stone-400">生成第一份方案后,会自动出现在这里</span>
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {plans.map((p) => (
            <div
              key={p.id}
              className="group rounded-xl border border-stone-200 bg-white p-3.5 transition-colors hover:border-brand-200"
            >
              <button type="button" className="block w-full text-left" onClick={() => onOpenPlan(p)}>
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium text-stone-800">{p.title}</span>
                  {p.demo && <Badge tone="amber">演示</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDateTime(p.createdAt)}
                  </span>
                  <span>{p.form.works.filter((w) => w.title.trim()).length} 条作品</span>
                  <span>{Math.max(1, Math.round(p.report.length / 1000))}k 字</span>
                </div>
              </button>
              <div className="mt-2.5 flex justify-end border-t border-stone-100 pt-2.5">
                {confirmId === p.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">确定删除?</span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        onDelete(p.id)
                        setConfirmId(null)
                      }}
                    >
                      删除
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      取消
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(p.id)}
                    className="inline-flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
