import type { AIConfig, ChatMessage } from './types'

export class AIError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AIError'
    this.status = status
  }
}

export function endpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  // 兼容 https://api.deepseek.com 与 https://xxx/v1 两种填法
  if (/\/v1$/.test(base)) return `${base}/chat/completions`
  return `${base}/chat/completions`
}

export function apiHeaders(cfg: AIConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey.trim()}`,
  }
}

function friendlyError(status: number, raw: string): string {
  const detail = raw.slice(0, 300)
  switch (status) {
    case 401:
      return 'API Key 无效或已过期,请在「设置」里检查。(401)'
    case 402:
      return '账户余额不足,请前往 API 平台充值后重试。(402)'
    case 422:
      return '请求参数有误,请检查模型名称是否填写正确。(422)'
    case 429:
      return '请求过于频繁或额度受限,请稍等片刻再试。(429)'
    default:
      return `请求失败(${status}):${detail || '请检查接口地址与网络'}`
  }
}

/**
 * 调用 OpenAI 兼容接口,流式返回。
 * onDelta 逐段回调增量文本;返回完整拼接文本;用户中断时返回已收到的部分(不抛错)。
 */
export async function streamChat(
  cfg: AIConfig,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response
  try {
    res = await fetch(endpoint(cfg.baseUrl), {
      method: 'POST',
      headers: apiHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model.trim() || 'deepseek-chat',
        messages,
        stream: true,
        temperature: 0.8,
      }),
      signal,
    })
  } catch {
    if (signal?.aborted) return ''
    throw new AIError(
      '网络请求失败:请检查网络连接,或确认接口地址是否正确、是否允许浏览器直连(CORS)。',
    )
  }

  if (!res.ok) {
    let raw = ''
    try {
      raw = await res.text()
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } }
        if (j?.error?.message) raw = j.error.message
      } catch {
        /* 保留原始文本 */
      }
    } catch {
      /* ignore */
    }
    throw new AIError(friendlyError(res.status, raw), res.status)
  }

  if (!res.body) throw new AIError('服务端没有返回数据流,请稍后重试。')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = json.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta
            onDelta(delta)
          }
        } catch {
          /* 跳过无法解析的行 */
        }
      }
    }
  } catch (e) {
    if (!signal?.aborted) {
      throw new AIError(
        '读取数据流时连接中断,请检查网络后重试(已生成的部分会保留)。',
      )
    }
  }

  return full
}

/** 设置面板里的「测试连接」:发一个最小请求验证 Key / 地址 / 模型 */
export async function testConnection(
  cfg: AIConfig,
): Promise<{ ok: boolean; message: string; ms: number }> {
  const start = performance.now()
  try {
    const res = await fetch(endpoint(cfg.baseUrl), {
      method: 'POST',
      headers: apiHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model.trim() || 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
    })
    const ms = Math.round(performance.now() - start)
    if (res.ok) return { ok: true, message: `连接成功(${ms}ms),可以开始生成了`, ms }
    let raw = ''
    try {
      raw = await res.text()
    } catch {
      /* ignore */
    }
    return { ok: false, message: friendlyError(res.status, raw), ms }
  } catch {
    return {
      ok: false,
      message: '网络请求失败:请检查网络,或该地址是否允许浏览器直连(CORS)',
      ms: Math.round(performance.now() - start),
    }
  }
}
