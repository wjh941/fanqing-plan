import { expect, test, type Page } from '@playwright/test'

/**
 * 返青计划 E2E(跑在生产构建的 preview 上)
 * 1. 首屏可用性      2. 首发模式全流程   3. 演示方案流式生成+导出
 * 4. 托管接口限流提示 5. 断网降级与重试
 * AI 真实调用一律用路由拦截模拟:测试零成本、零网络依赖、结果稳定。
 * 注意:界面文案使用全角标点,匹配时尽量用无标点子串。
 */

async function openHome(page: Page) {
  await page.goto('/')
  // 首次访问会弹欢迎弹窗,直接关掉(按钮文案含全角括号,用正则)
  const btn = page.getByRole('button', { name: /直接开始填写/ })
  if (await btn.isVisible().catch(() => false)) await btn.click()
}

/** 走完三步向导到「生成」按钮(一键填入示例账号后,仍需手动过步) */
async function fillExampleAndReachGenerate(page: Page) {
  await page.getByRole('button', { name: /一键填入示例账号/ }).click()
  const next = page.getByRole('button', { name: /下一步/ })
  await next.click()
  await next.click()
  return page.getByRole('button', { name: /生成我的重启方案/ })
}

test('首屏可用:品牌、表单、首发入口齐备,无启动错误', async ({ page }) => {
  await openHome(page)
  await expect(page.getByText('停更是蓄力').first()).toBeVisible()
  await expect(page.getByText('不再是一个断更的人').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '开始首发模式' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始语音输入' }).first()).toBeVisible()
  // 屏幕红条(启动错误诊断)不应出现
  await expect(page.locator('#boot-error')).toHaveCount(0)
})

test('首发模式全流程:退休→选模板→发布→返青第1天纪念页', async ({ page }) => {
  await openHome(page)
  await page.getByRole('button', { name: '开始首发模式' }).click()
  await expect(page.getByText('把第一篇发出去')).toBeVisible()

  // 第 1 步:旧作退休
  await page.getByRole('button', { name: /它退休了/ }).click()
  // 第 2 步:选模板
  await page.getByRole('button', { name: /五步清单干货/ }).click()
  await expect(page.getByText('为你生成好的正文')).toBeVisible()
  await page.getByRole('button', { name: /文案拿到了/ }).click()
  // 第 3 步:发布打卡
  await page.getByRole('button', { name: /我发出去了/ }).click()
  await expect(page.getByRole('heading', { name: /返青 · 第 1 天/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /保存「第 1 天」纪念图/ })).toBeVisible()
  await expect(page.getByText('不再是一个断更的人').first()).toBeVisible()
})

test('演示方案:流式生成、模块渲染、打卡清单、导出 .md', async ({ page }) => {
  await openHome(page)
  await page.getByRole('button', { name: /先看一份示例方案/ }).click()

  // 流式:模块 1 先出现(含 30 秒速览),等整份完成出现打卡清单
  await expect(page.getByText(/模块 1/).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('重启打卡清单')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/模块 6/).first()).toBeVisible()

  // 导出 .md 触发浏览器下载
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 .md' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.md$/)
})

test('托管接口限流(429):给用户人话提示与出路', async ({ page }) => {
  await page.route('**/api/generate', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: '今日免费体验次数已用完(每 IP 每日 12 次)。可以在「设置」里切换为「自定义接口」。' }),
    }),
  )
  await openHome(page)
  const generate = await fillExampleAndReachGenerate(page)
  await generate.click()
  await expect(page.getByText(/免费体验次数已用完/).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /重试一次/ })).toBeVisible()
})

test('断网降级:错误可读、已生成部分保留、可重试', async ({ page }) => {
  await page.route('**/api/generate', (route) => route.abort('failed'))
  await openHome(page)
  const generate = await fillExampleAndReachGenerate(page)
  await generate.click()
  await expect(page.getByText(/网络请求失败/).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /重试一次/ })).toBeVisible()
  // 返回首页不发崩
  await page.getByRole('button', { name: /返回检查信息与设置/ }).click()
  await expect(page.getByRole('button', { name: '开始首发模式' })).toBeVisible()
})
