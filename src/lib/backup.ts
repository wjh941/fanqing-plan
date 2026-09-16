const BACKUP_KEYS = ['rp.plans.v1', 'rp.checklist.v1', 'rp.draft.v1'] as const
const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'fanqing-plan'
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

/** 导出完整备份(方案 + 打卡 + 草稿;不含 API Key) */
export function buildBackup(): BackupFile {
  const data: Record<string, unknown> = {}
  for (const k of BACKUP_KEYS) {
    const raw = localStorage.getItem(k)
    if (raw !== null) {
      try {
        data[k] = JSON.parse(raw)
      } catch {
        /* skip broken entry */
      }
    }
  }
  return { app: 'fanqing-plan', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

export function exportBackup(): void {
  const json = JSON.stringify(buildBackup(), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `返青计划备份-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 导入备份:校验格式后写回 localStorage 并返回恢复的条目数 */
export function importBackup(file: File): Promise<{ plans: number; checklists: number }> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result)) as Partial<BackupFile>
        if (parsed.app !== 'fanqing-plan' || typeof parsed.data !== 'object' || parsed.data === null) {
          reject(new Error('这不是返青计划的备份文件'))
          return
        }
        let plans = 0
        let checklists = 0
        for (const [k, v] of Object.entries(parsed.data)) {
          if (!(BACKUP_KEYS as readonly string[]).includes(k)) continue
          try {
            localStorage.setItem(k, JSON.stringify(v))
            if (k === 'rp.plans.v1' && Array.isArray(v)) plans = v.length
            if (k === 'rp.checklist.v1' && v && typeof v === 'object') checklists = Object.keys(v).length
          } catch {
            /* skip broken entry */
          }
        }
        resolve({ plans, checklists })
      } catch {
        reject(new Error('备份文件解析失败'))
      }
    }
    fr.onerror = () => reject(new Error('读取文件失败'))
    fr.readAsText(file)
  })
}
