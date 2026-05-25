import { test, expect } from '@playwright/test'

function createJwtPayload() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'lazy-fallback-user' })).toString('base64url')
  return `${header}.${payload}.e2e`
}

test('lazy-load fallback renders when a route chunk fails to load', async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify({ id: 'lazy-fallback-user', username: 'lazy_fallback_user' }))
  }, createJwtPayload())

  await page.route('**/GameView*.js', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'simulated chunk outage' })
  }))

  await page.route('**/GameView.vue', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'simulated dev chunk outage' })
  }))

  await page.goto('/game')

  await expect(page.getByRole('heading', { name: '⚠️ 页面加载失败' })).toBeVisible({ timeout: 12000 })
  await expect(page.getByRole('button', { name: /重新加载/ })).toBeVisible()
})
