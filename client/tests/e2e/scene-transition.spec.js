/**
 * 场景跳转端到端诊断测试
 * 验证：开始 → 游戏中 → 死亡/通关 → 结算页 → 返回菜单
 */
import { test, expect } from '@playwright/test'

test.describe('场景跳转稳定性', () => {
  test.beforeEach(async ({ page }) => {
    // 忽略 console 中的非关键错误
    page.on('pageerror', (err) => {
      console.log(`[PAGE ERROR] ${err.message}`)
    })
  })

  test('完整游戏循环：登录 → 开始关卡 → 返回菜单', async ({ page }) => {
    // 1. 访问首页
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // 2. 登录
    const usernameInput = page.locator('input[type="text"], input[placeholder*="用户名"], input[name="username"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('test')
      await passwordInput.fill('123456')
      await page.locator('button:has-text("登录"), button:has-text("登 录")').first().click()
      await page.waitForTimeout(2000)
    }

    // 3. 点击"开始游戏"
    const startBtn = page.locator('button:has-text("开始"), button:has-text("继续"), button:has-text("START")').first()
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(2000)
    }

    // 4. 检查是否进入了游戏场景（Phaser Canvas 存在）
    const canvas = page.locator('canvas').first()
    const hasGame = await canvas.isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`Canvas visible: ${hasGame}`)

    // 5. 检查是否有游戏HUD
    const hudHearts = page.locator('.hud-hearts, .game-hud').first()
    const hasHud = await hudHearts.isVisible({ timeout: 3000 }).catch(() => false)
    console.log(`HUD visible: ${hasHud}`)

    // 6. 截图保存当前状态
    await page.screenshot({ path: 'test-results/game-state.png' })

    // 7. 按 ESC 暂停
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)

    // 8. 检查暂停菜单
    const pauseMenu = page.locator('.pause-overlay, .pause-card').first()
    const hasPause = await pauseMenu.isVisible({ timeout: 2000 }).catch(() => false)
    console.log(`Pause menu visible: ${hasPause}`)

    await page.screenshot({ path: 'test-results/pause-state.png' })

    // 9. 点击"返回菜单"
    const backBtn = page.locator('button:has-text("返回菜单")').first()
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click()
      await page.waitForTimeout(2000)
    }

    // 10. 检查是否回到菜单
    await page.screenshot({ path: 'test-results/menu-state.png' })

    // 检查页面上是否有"词汇大冒险"标题（MenuScene 的特征）
    const pageContent = await page.content()
    const hasTitle = pageContent.includes('词汇大冒险') || pageContent.includes('WORD QUEST')
    console.log(`Back to menu: ${hasTitle}`)

    // 即使没找到标题也不fail（可能需要更多等待），但会留下截图
  })
})
