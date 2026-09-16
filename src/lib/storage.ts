import type { AccountForm, AIConfig, ChecklistData, SavedPlan } from './types'
import { emptyForm } from './types'

const KEY_CONFIG = 'rp.aiConfig.v1'
const KEY_DRAFT = 'rp.draft.v1'
const KEY_PLANS = 'rp.plans.v1'
const KEY_CHECKLIST = 'rp.checklist.v1'
const KEY_ONBOARDED = 'rp.onboarded.v1'

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}

/* ---------- API 配置 ---------- */

/** 默认接口可被 .env.local 覆盖(VITE_AI_BASE_URL / VITE_AI_API_KEY / VITE_AI_MODEL) */
export const DEFAULT_CONFIG: AIConfig = {
  baseUrl: (import.meta.env.VITE_AI_BASE_URL as string | undefined)?.trim() || 'https://api.deepseek.com',
  apiKey: (import.meta.env.VITE_AI_API_KEY as string | undefined)?.trim() || '',
  model: (import.meta.env.VITE_AI_MODEL as string | undefined)?.trim() || 'deepseek-chat',
}

export function loadConfig(): AIConfig {
  const saved = readJSON<Partial<AIConfig>>(KEY_CONFIG)
  // 空值回退到默认(含 env 注入的本地默认)
  return {
    baseUrl: saved?.baseUrl?.trim() || DEFAULT_CONFIG.baseUrl,
    apiKey: saved?.apiKey?.trim() || DEFAULT_CONFIG.apiKey,
    model: saved?.model?.trim() || DEFAULT_CONFIG.model,
  }
}

export function saveConfig(cfg: AIConfig): void {
  writeJSON(KEY_CONFIG, cfg)
}

/* ---------- 表单草稿(防中途退出丢失) ---------- */

export function loadDraft(): AccountForm {
  return readJSON<AccountForm>(KEY_DRAFT) ?? emptyForm()
}

export function saveDraft(form: AccountForm): void {
  writeJSON(KEY_DRAFT, form)
}

/* ---------- 历史方案 ---------- */

const MAX_PLANS = 30

export function listPlans(): SavedPlan[] {
  const list = readJSON<SavedPlan[]>(KEY_PLANS)
  return Array.isArray(list) ? list : []
}

export function savePlan(plan: SavedPlan): SavedPlan[] {
  const list = listPlans().filter((p) => p.id !== plan.id)
  list.unshift(plan)
  const capped = list.slice(0, MAX_PLANS)
  writeJSON(KEY_PLANS, capped)
  return capped
}

export function updatePlanReport(id: string, report: string): void {
  const list = listPlans().map((p) => (p.id === id ? { ...p, report } : p))
  writeJSON(KEY_PLANS, list)
}

export function deletePlan(id: string): SavedPlan[] {
  const list = listPlans().filter((p) => p.id !== id)
  writeJSON(KEY_PLANS, list)
  try {
    const map = readJSON<Record<string, unknown>>(KEY_CHECKLIST)
    if (map && id in map) {
      delete map[id]
      writeJSON(KEY_CHECKLIST, map)
    }
  } catch {
    /* ignore */
  }
  return list
}

/* ---------- 打卡清单(按方案 id 存取) ---------- */

export function loadChecklist(planId: string): ChecklistData {
  const map = readJSON<Record<string, ChecklistData>>(KEY_CHECKLIST) ?? {}
  return map[planId] ?? { items: [], records: {} }
}

export function saveChecklist(planId: string, data: ChecklistData): void {
  const map = readJSON<Record<string, ChecklistData>>(KEY_CHECKLIST) ?? {}
  map[planId] = data
  writeJSON(KEY_CHECKLIST, map)
}

/* ---------- 首次访问引导 ---------- */

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY_ONBOARDED) === '1'
  } catch {
    return true
  }
}

export function setOnboarded(): void {
  try {
    localStorage.setItem(KEY_ONBOARDED, '1')
  } catch {
    /* ignore */
  }
}
