import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { ToastProvider } from './components/ui'
import './index.css'

const w = window as unknown as { __showBootError?: (msg: string) => void }

// 老设备白屏诊断:未捕获渲染错误时,把错误与完整组件栈(真实组件名)显示到屏幕
ReactDOM.createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, errorInfo) => {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = String(errorInfo?.componentStack || '')
      .trim()
      .split('\n')
      .slice(0, 12)
      .join('\n')
    w.__showBootError?.(`${msg}\n组件栈(由近及远):\n${stack}`)
  },
}).render(
  <React.StrictMode>
    {/* 尊重系统"减弱动态效果"设置:动效对晕动症用户自动降级 */}
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionConfig>
  </React.StrictMode>,
)
