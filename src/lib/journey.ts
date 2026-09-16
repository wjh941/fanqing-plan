/* 陪跑数据层:首发记录、累计完成、连续天数、返青第 N 天 */

export interface FirstPostData {
  retiredTitle?: string
  templateId: string
  publishedAt: number
}

const KEY_FIRST_POST = 'rp.firstPost.v1'
const DAY = 86400000

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* 存储满等异常,静默 */
  }
}

export function loadFirstPost(): FirstPostData | null {
  const d = readJSON<FirstPostData>(KEY_FIRST_POST)
  return d && typeof d.publishedAt === 'number' ? d : null
}

export function saveFirstPost(d: FirstPostData): void {
  writeJSON(KEY_FIRST_POST, d)
}

function day0(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 返青第 N 天(首发当天 = 第 1 天) */
export function dayNumber(publishedAt: number): number {
  return Math.max(1, Math.floor((day0(Date.now()) - day0(publishedAt)) / DAY) + 1)
}

export function fmtDateCNms(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export interface JourneyStats {
  /** 所有方案打卡累计完成数(含首发) */
  totalDone: number
  /** 连续打卡天数(今天或昨天为终点向前数) */
  streak: number
  /** 首发 data(无则 null) */
  firstPost: FirstPostData | null
  /** 返青第 N 天(无首发则 null) */
  dayN: number | null
}

export function journeyStats(): JourneyStats {
  // 汇总所有方案的打卡完成日
  const days = new Set<number>()
  let totalDone = 0
  try {
    const map = readJSON<Record<string, { records?: Record<string, { done?: boolean; doneAt?: number }> }>>('rp.checklist.v1') ?? {}
    for (const cl of Object.values(map)) {
      for (const rec of Object.values(cl.records ?? {})) {
        if (rec?.done) {
          totalDone += 1
          if (rec.doneAt) days.add(day0(rec.doneAt))
        }
      }
    }
  } catch {
    /* ignore */
  }
  const firstPost = loadFirstPost()
  if (firstPost) {
    totalDone += 1
    days.add(day0(firstPost.publishedAt))
  }
  // 连续天数:从今天(或昨天)向前数
  let streak = 0
  let cursor = day0(Date.now())
  if (!days.has(cursor)) cursor -= DAY
  while (days.has(cursor)) {
    streak += 1
    cursor -= DAY
  }
  return { totalDone, streak, firstPost, dayN: firstPost ? dayNumber(firstPost.publishedAt) : null }
}

/* ---------- 首发模式:退休文案与首发模板(纯本地,不调用 AI) ---------- */

export const RETIRE_LINES: string[] = [
  '这篇可以退休了——它陪你走过第一段,剩下的路交给新内容。',
  '谢谢你曾经的努力,现在光荣退役。',
  '它已经完成了使命,接下来看你写新故事。',
  '旧内容不是失败,是垫脚石——退休快乐。',
]

export interface PostTemplate {
  id: string
  name: string
  desc: string
  /** 生成正文;niche 为用户赛道(可能为空) */
  body: (niche: string) => { title: string; content: string }
}

export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: 'return',
    name: '回归碎碎念',
    desc: '一张桌面/手帐/工作台照片 + 100 字左右的真实近况,不露脸、不用长文',
    body: (niche) => ({
      title: '消失了一段时间,回来啦',
      content: `消失了一段时间,没有摆烂,只是去处理了一些事情。
这段时间想了很多,最后发现最喜欢的还是${niche ? `聊${niche}` : '分享日常'}。
不立 flag,不保证日更,就是想说:我回来了,慢慢更新。
如果你也在停更后重新开始,评论区握个手,我们一起慢慢来。`,
    }),
  },
  {
    id: 'list',
    name: '五步清单干货',
    desc: '把最擅长的一件事写成 5 步清单,收藏型内容,压力小、实用性高',
    body: (niche) => ({
      title: `新手也能会的 5 步法${niche ? `(${niche})` : ''}`,
      content: `把我在${niche || '这个领域'}最常用的一件事,拆成 5 步,新手照做就行:
1️⃣ 明确目标:这一步要达到什么结果
2️⃣ 准备:需要的东西一次列全
3️⃣ 动手:先完成 60 分版本
4️⃣ 检查:只挑 1 个地方改进
5️⃣ 复盘:记一句"下次注意什么"
第 3 步最容易卡住,记住先完成再完美。
想看哪一步的详细展开,评论区告诉我。`,
    }),
  },
  {
    id: 'refresh',
    name: '旧作翻新',
    desc: '挑一条数据最好的旧作品:换封面、改 20 字开头,重新发布',
    body: (_niche) => ({
      title: '(用你旧爆款的标题,改个开头)',
      content: `步骤:
1. 打开你的历史作品,找数据最好的那条(点赞/收藏最高)
2. 封面换个排版或配图,标题改 5~10 个字
3. 正文开头重写 20 字:加一句"重发+最近的新体会"
4. 其余内容保持不变,直接发布
建议:这条的核心是测试账号当前状态,数据好不好都值得记录,它就是你重启期的基准线。`,
    }),
  },
]

/* ---------- 纪念图:返青第 N 天 / 重启完成(Canvas 生成 PNG) ---------- */

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** 生成并下载纪念图(1080×1440,适配手机分享) */
export function downloadMilestoneImage(opts: { dayN: number; niche: string; dateMs: number; done?: number; streak?: number }): void {
  const W = 1080
  const H = 1440
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  if (!g) return

  // 背景:暖米色渐变
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#faf9f7')
  bg.addColorStop(1, '#f3ede6')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  // 品牌圆点 + 标题
  g.fillStyle = '#e25830'
  g.beginPath()
  g.arc(120, 200, 16, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#8a8377'
  g.font = '500 34px "Microsoft YaHei", sans-serif'
  g.fillText('返青计划', 156, 212)

  // 大字
  const head = opts.dayN > 30 ? '重启完成' : `返青 · 第 ${opts.dayN} 天`
  g.fillStyle = '#1c1917'
  g.font = 'bold 120px "Microsoft YaHei", sans-serif'
  g.fillText(head, 120, 430)

  // 日期与赛道
  g.fillStyle = '#78716c'
  g.font = '400 40px "Microsoft YaHei", sans-serif'
  g.fillText(fmtDateCNms(opts.dateMs) + ' · ' + (opts.niche || '重新出发的账号'), 122, 510)

  // 卡片
  g.fillStyle = '#ffffff'
  roundRect(g, 100, 580, W - 200, 420, 36)
  g.fill()
  g.strokeStyle = '#eae5de'
  g.lineWidth = 2
  roundRect(g, 100, 580, W - 200, 420, 36)
  g.stroke()

  g.fillStyle = '#44403c'
  g.font = '400 38px "Microsoft YaHei", sans-serif'
  const quote = '不保证流量,\n只保证你不再是一个断更的人。'
  let ty = 680
  for (const lineText of quote.split('\n')) {
    g.fillText(lineText, 160, ty)
    ty += 64
  }
  if (opts.done !== undefined) {
    g.fillStyle = '#a8a29e'
    g.font = '400 32px "Microsoft YaHei", sans-serif'
    g.fillText(`累计完成 ${opts.done} 个重启动作${opts.streak ? ` · 连续 ${opts.streak} 天` : ''}`, 160, ty + 40)
  }

  // 底部标语
  g.fillStyle = '#c24128'
  g.font = '500 36px "Microsoft YaHei", sans-serif'
  g.fillText('停更是蓄力,不是终点', 122, 1130)
  g.fillStyle = '#a8a29e'
  g.font = '400 30px "Microsoft YaHei", sans-serif'
  g.fillText('发完就休息,今天你已经赢了', 122, 1190)

  const a = document.createElement('a')
  a.href = cv.toDataURL('image/png')
  a.download = opts.dayN > 30 ? '重启完成.png' : `返青第${opts.dayN}天.png`
  a.click()
}
