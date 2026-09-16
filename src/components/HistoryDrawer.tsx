import { useRef, useState } from 'react'
import { CalendarDays, FileDown, FileText, Trash2, Upload } from 'lucide-react'
import type { SavedPlan } from '../lib/types'
import { exportBackup, importBackup } from '../lib/backup'
import { fmtDateTime } from '../lib/utils'
import { Badge, Button, Dialog, useToast } from './ui'

export function HistoryDrawer({
  open,
  onClose,
  plans,
  onOpenPlan,
  onDelete,
  onRestored,
}: {
  open: boolean
  onClose: () => void
  plans: SavedPlan[]
  onOpenPlan: (plan: SavedPlan) => void
  onDelete: (id: string) => void
  /** 导入备份成功后由父级刷新状态 */
  onRestored: () => void
}) {
  const toast = useToast()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleImport(files: FileList | null) {
    if (!files || files.length === 0) return
    setImporting(true)
    try {
      const r = await importBackup(files[0])
      onRestored()
      if (r.plans > 0) {
        toast('success', `备份已恢复:${r.plans} 份方案、${r.checklists} 组打卡记录`)
        onClose()
      } else {
        toast('info', '备份文件有效,但没有找到已保存的方案')
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      side
      title="历史方案"
      subtitle="方案与打卡保存在这台设备的浏览器里;点生成时会经站内代理转发必要内容"
    >
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

      {/* 备份与恢复 */}
      <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
        <p className="text-[13px] font-medium text-stone-700">备份与恢复</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-400">
          换手机、清浏览器缓存前,建议先导出备份;恢复后会覆盖当前本机数据。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportBackup}>
            <FileDown className="h-4 w-4" />
            导出完整备份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleImport(e.target.files)}
          />
          <Button
            size="sm"
            variant="ghost"
            loading={importing}
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            导入备份
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
