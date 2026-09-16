/* 生产包运行时冒烟测试:在 jsdom 里挂载 dist 产物,捕获 React 渲染错误 */
import { JSDOM } from 'jsdom'
import { readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://example.com/',
  pretendToBeVisual: true,
})
const g = dom.window
// 全量镜像 window 上的 DOM 构造器与 API
for (const k of Object.getOwnPropertyNames(g)) {
  if (k === 'window' || k === 'globalThis' || k === 'global') continue
  if (typeof globalThis[k] === 'undefined') {
    try {
      globalThis[k] = g[k]
    } catch {
      /* skip readonly */
    }
  }
}
globalThis.window = g
globalThis.document = g.document
Object.defineProperty(globalThis, 'navigator', { value: g.navigator, configurable: true })
globalThis.location = g.location
globalThis.history = g.history
globalThis.HTMLElement = g.HTMLElement
globalThis.Element = g.Element
globalThis.Node = g.Node
globalThis.CustomEvent = g.CustomEvent
globalThis.Event = g.Event
globalThis.localStorage = g.localStorage
globalThis.sessionStorage = g.sessionStorage
globalThis.getComputedStyle = g.getComputedStyle.bind(g)
globalThis.requestAnimationFrame = g.requestAnimationFrame?.bind(g) ?? ((cb) => setTimeout(() => cb(Date.now()), 16))
globalThis.cancelAnimationFrame = g.cancelAnimationFrame?.bind(g) ?? clearTimeout
globalThis.matchMedia =
  g.matchMedia?.bind(g) ??
  (() => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } }))
globalThis.ResizeObserver = g.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = g.IntersectionObserver ?? class { observe() {} unobserve() {} disconnect() {} }
globalThis.MutationObserver = g.MutationObserver ?? class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
globalThis.HTMLIFrameElement = g.HTMLIFrameElement
globalThis.client = { width: 1280, height: 800 }

const consoleError = console.error
let lastErrors = []
console.error = (...args) => {
  lastErrors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '))
  consoleError(...args)
}

const asset = readdirSync('dist/assets').find((f) => /^index-[\w-]+\.js$/.test(f))
if (!asset) {
  console.log('NO BUNDLE FOUND')
  process.exit(1)
}
console.log('testing bundle:', asset)
try {
  await import(pathToFileURL('dist/assets/' + asset).href)
} catch (e) {
  console.log('IMPORT THROW:', e.message)
}
await new Promise((r) => setTimeout(r, 2000))
const root = g.document.getElementById('root')
console.log('root children:', root.children.length)
console.log('root text head:', (root.textContent || '').slice(0, 60).replace(/\s+/g, ' '))
const e130 = lastErrors.find((s) => s.includes('#130') || s.includes('Element type is invalid'))
if (e130) {
  console.log('---- REPRODUCED #130 ----')
  console.log(e130.slice(0, 800))
} else if (lastErrors.length) {
  console.log('---- other console.error (first 3) ----')
  lastErrors.slice(0, 3).forEach((s) => console.log(s.slice(0, 300)))
} else {
  console.log('no console.error captured')
}
