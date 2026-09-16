export interface WorkItem {
  id: string
  /** 发布时间,自由文本(如 2024-05-01 / 去年10月) */
  date: string
  title: string
  summary: string
  /** 数据保持原始文本,支持 "1.2万" "850" 等写法 */
  likes: string
  collects: string
  plays: string
}

export interface AccountForm {
  niche: string
  gapDuration: string
  gapReason: string
  goal: string
  works: WorkItem[]
  /** 定位迷茫模式:AI 从历史作品反推 2~3 个可选定位 */
  positioningConfused: boolean
  /** 是否需要变现路径规划(模块6) */
  wantsMonetize: boolean
}

export interface AIConfig {
  /** managed = 免配置托管生成(服务端代理);own = 用户自定义接口 */
  mode?: 'managed' | 'own'
  baseUrl: string
  apiKey: string
  model: string
}

export interface SavedPlan {
  id: string
  createdAt: number
  title: string
  demo: boolean
  form: AccountForm
  report: string
  /** 从 AI 输出中提取的结构化排期,用于打卡清单 */
  schedule?: CheckItem[]
}

/** 打卡清单条目 */
export interface CheckItem {
  id: string
  /** 1=第1周 2=第2周 3=第3~4周 0=自定义 */
  week: number
  when: string
  title: string
  /** 测试内容 / 巩固标签内容 */
  kind: string
  difficulty: string
}

/** 单条打卡的执行记录 */
export interface CheckRecord {
  done: boolean
  doneAt?: number
  stats?: { plays?: string; likes?: string; collects?: string }
}

export interface ChecklistData {
  items: CheckItem[]
  records: Record<string, CheckRecord>
  /** 返青开始日(YYYY-MM-DD),用于把排期落到具体日期 */
  startDate?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModuleMeta {
  n: number
  title: string
  blurb: string
}

export const MODULES: ModuleMeta[] = [
  {
    n: 1,
    title: '账号重启诊断报告',
    blurb: '看清账号现状:哪些标签还有效、流量为什么下滑、重启先做什么',
  },
  {
    n: 2,
    title: '专属重启选题池',
    blurb: '5 个低竞争长尾选题,贴合你账号原本被验证过的风格',
  },
  {
    n: 3,
    title: '内容成品物料',
    blurb: '小红书笔记 + 抖音口播脚本,拿来改改就能用',
  },
  {
    n: 4,
    title: '渐进式更新排期计划',
    blurb: '从测试期到稳步提升,重建更新习惯不硬撑',
  },
  {
    n: 5,
    title: '轻量化复盘指引',
    blurb: '只看几个关键信号,数据不好也知道怎么调',
  },
  {
    n: 6,
    title: '变现路径规划',
    blurb: '从重启期到数据成熟,分阶段的合规变现建议',
  },
]

export const DISCLAIMER =
  '本方案仅为内容创作策略参考,无法干预平台算法,不保证流量效果。'

export const GAP_OPTIONS = ['1个月以内', '1~3个月', '3~6个月', '6个月~1年', '1年以上']

export function emptyForm(): AccountForm {
  return {
    niche: '',
    gapDuration: '',
    gapReason: '',
    goal: '',
    works: [],
    positioningConfused: false,
    wantsMonetize: false,
  }
}

export function newWork(): WorkItem {
  return { id: Math.random().toString(36).slice(2, 10), date: '', title: '', summary: '', likes: '', collects: '', plays: '' }
}
