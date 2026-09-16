import { apiHeaders, AIError, endpoint } from './ai'
import type { AIConfig } from './types'
import type { ParsedWork } from './parser'

const VISION_PROMPT = `你是数据提取助手。图中可能是自媒体创作者后台的作品/笔记列表截图(表格或列表),也可能包含账号级的粉丝数、总浏览等统计——后者请忽略,只提取"一条一条的作品记录"。
只输出 JSON 数组,不要任何解释、不要 markdown 代码块,格式:
[{"date":"发布时间,原样保留","title":"作品标题","summary":"内容简述,没有就空字符串","likes":"点赞数,原文写法","collects":"收藏数,原文写法","plays":"播放或浏览数,原文写法"}]
要求:字段全部为字符串;图中没有的字段用空字符串;数字保留原文写法(如 1.2万、8600);图中没有作品列表就输出 []。`

function toParsedWork(u: unknown): ParsedWork | null {
  if (typeof u !== 'object' || u === null) return null
  const o = u as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const title = str(o.title)
  const likes = str(o.likes)
  const collects = str(o.collects)
  const plays = str(o.plays)
  if (!title && !likes && !collects && !plays) return null
  return {
    date: str(o.date),
    title: title || '未识别标题',
    summary: str(o.summary),
    likes,
    collects,
    plays,
  }
}

/** 把一张截图发给支持视觉的模型,提取作品列表 */
export async function extractWorksFromImage(
  cfg: AIConfig,
  imageDataUrl: string,
): Promise<ParsedWork[]> {
  let res: Response
  try {
    res = await fetch(endpoint(cfg.baseUrl), {
      method: 'POST',
      headers: apiHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model.trim() || 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    })
  } catch {
    throw new AIError('网络请求失败:请检查网络连接后重试。')
  }

  if (!res.ok) {
    let raw = ''
    try {
      raw = await res.text()
    } catch {
      /* ignore */
    }
    if (res.status === 400 || res.status === 404 || res.status === 422) {
      throw new AIError(
        '当前模型可能不支持识别图片。请在「设置」里切换为支持视觉的模型(如 gpt-5.5、gpt-4o 等),或改用粘贴/手动填写。',
      )
    }
    throw new AIError(`截图识别失败(${res.status}):${raw.slice(0, 200) || '请稍后重试'}`, res.status)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  const arrMatch = /\[[\s\S]*\]/.exec(content)
  if (!arrMatch) {
    throw new AIError(
      '模型没有从截图中识别出作品列表。若当前模型不支持看图,请在「设置」切换为支持视觉的模型;也可以改用粘贴导入。',
    )
  }
  try {
    const arr = JSON.parse(arrMatch[0]) as unknown
    if (!Array.isArray(arr)) throw new Error('not array')
    const items = arr.map(toParsedWork).filter((x): x is ParsedWork => x !== null)
    return items
  } catch {
    throw new AIError('识别结果解析失败,请重试一次,或改用粘贴导入。')
  }
}
