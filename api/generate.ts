/**
 * 返青计划 · 生成代理(Vercel Edge Function)
 *
 * 用户浏览器 → 本函数 → AI 中转接口。
 * API Key 只存在于服务端环境变量(RELAY_*),永远不会进入前端产物。
 *
 * 内置防护:
 * - 每 IP 每日限流(内存计数,尽力而为;多实例间不共享)
 * - 请求体校验(role / content 白名单与长度上限)
 * - max_tokens 服务端封顶,封顶单次成本
 */
export const config = { runtime: 'edge' }

const BASE = (process.env.RELAY_BASE_URL || '').trim()
const KEY = (process.env.RELAY_API_KEY || '').trim()
const MODEL = (process.env.RELAY_MODEL || 'deepseek-chat').trim()

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** 每 IP 每日限流(内存版;边缘实例重启/多实例会各自计数,属于尽力而为) */
const DAILY_LIMIT = 12
const hits = new Map<string, { day: string; n: number }>()
function overLimit(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10)
  const rec = hits.get(ip)
  if (!rec || rec.day !== day) {
    if (hits.size > 5000) hits.clear()
    hits.set(ip, { day, n: 1 })
    return false
  }
  rec.n += 1
  return rec.n > DAILY_LIMIT
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

interface Msg {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

function validMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) return null
  const out: Msg[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    const role = (m as { role?: unknown }).role
    const content = (m as { content?: unknown }).content
    if (role !== 'system' && role !== 'user' && role !== 'assistant') return null
    if (typeof content === 'string') {
      if (content.length > 20000) return null
      out.push({ role, content })
    } else if (Array.isArray(content)) {
      // 视觉消息:文本 + image_url 数组,限制总体积
      if (content.length > 4) return null
      if (JSON.stringify(content).length > 600_000) return null
      out.push({ role, content: content as Array<Record<string, unknown>> })
    } else {
      return null
    }
  }
  return out
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { ping?: boolean; stream?: boolean; max_tokens?: number; messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400)
  }

  if (body.ping) {
    return json({ ok: true, configured: Boolean(BASE && KEY) })
  }

  if (!BASE || !KEY) {
    return json({ error: '服务端未配置生成服务,请联系维护者,或在「设置」里使用自己的 API Key。' }, 500)
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  if (overLimit(ip)) {
    return json(
      { error: '今日免费体验次数已用完(每 IP 每日 12 次)。可以在「设置」里切换为「自定义接口」,填入自己的 Key 后无次数限制。' },
      429,
    )
  }

  const messages = validMessages(body.messages)
  if (!messages) return json({ error: 'messages 参数无效' }, 400)

  const stream = body.stream !== false
  const maxTokens =
    typeof body.max_tokens === 'number' && body.max_tokens > 0 ? Math.min(Math.round(body.max_tokens), 4000) : 4000

  let upstream: Response
  try {
    upstream = await fetch(BASE.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages, stream, temperature: 0.8, max_tokens: maxTokens }),
    })
  } catch {
    return json({ error: '生成服务网络异常,请稍后重试' }, 502)
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '')
    return json({ error: `生成服务异常(${upstream.status}):${text.slice(0, 200) || '请稍后重试'}` }, 502)
  }

  const headers = new Headers(CORS)
  headers.set('Content-Type', upstream.headers.get('content-type') || (stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8'))
  headers.set('Cache-Control', 'no-cache')
  return new Response(upstream.body, { status: 200, headers })
}
