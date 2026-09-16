export interface SpeechHandle {
  stop: () => void
}

interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: RecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return 'SpeechRecognition' in w || 'webkitSpeechRecognition' in w
}

/**
 * 浏览器语音识别(Web Speech API,Chromium/Safari 支持)。
 * onText:final 为已确定的文字,interim 为正在说的临时文字(可实时上屏)。
 * onEnd:err 为浏览器错误码(network / not-allowed / no-speech 等),正常结束不带 err。
 */
export function startRecognition(opts: {
  lang?: string
  onText: (finalText: string, interimText: string) => void
  onEnd: (err?: string) => void
}): SpeechHandle | null {
  const w = window as unknown as Record<string, unknown>
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => RecognitionLike)
    | undefined
  if (!Ctor) return null

  const rec = new Ctor()
  rec.lang = opts.lang ?? 'zh-CN'
  rec.continuous = true
  rec.interimResults = true

  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (!r) continue
      if (r.isFinal) finalText += r[0].transcript
      else interim += r[0].transcript
    }
    opts.onText(finalText, interim)
  }
  rec.onerror = (e) => opts.onEnd(e.error ?? 'error')
  rec.onend = () => opts.onEnd()

  try {
    rec.start()
  } catch {
    return null
  }
  return {
    stop: () => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    },
  }
}
