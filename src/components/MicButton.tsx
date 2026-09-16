import { useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { isSpeechSupported, startRecognition, type SpeechHandle } from '../lib/speech'
import { cn } from '../lib/utils'
import { useToast } from './ui'

/** 表单旁的语音输入按钮:按住说话改为点击开始/结束,识别文字实时追加到输入框 */
export function MicButton({
  getValue,
  onChange,
}: {
  getValue: () => string
  onChange: (v: string) => void
}) {
  const toast = useToast()
  const [recording, setRecording] = useState(false)
  const handleRef = useRef<SpeechHandle | null>(null)

  if (!isSpeechSupported()) return null

  function toggle() {
    if (recording) {
      handleRef.current?.stop()
      return
    }
    const base = getValue()
    handleRef.current = startRecognition({
      onText: (finalText, interimText) => onChange(base + finalText + interimText),
      onEnd: (err) => {
        handleRef.current = null
        setRecording(false)
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast('error', '麦克风权限被拒绝,请在浏览器设置里允许后重试')
        } else if (err === 'network') {
          toast('info', '语音服务连接失败,可用手机键盘自带的「语音转文字」代替')
        } else if (err === 'no-speech') {
          toast('info', '没听到内容,再试一次吧')
        }
      },
    })
    if (handleRef.current) {
      setRecording(true)
      toast('info', '开始录音,再说一遍内容,点 ■ 结束')
    } else {
      toast('info', '当前浏览器不支持语音输入,可用手机键盘自带的语音转文字')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors',
        recording
          ? 'bg-red-50 text-red-500'
          : 'text-stone-400 hover:bg-brand-50 hover:text-brand-600',
      )}
      aria-label={recording ? '停止语音输入' : '开始语音输入'}
      title={recording ? '停止录音' : '语音输入'}
    >
      {recording ? <Square className="h-3 w-3 animate-pulse" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  )
}
