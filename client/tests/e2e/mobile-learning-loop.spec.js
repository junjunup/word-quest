import { test, expect } from '@playwright/test'

function createJwtPayload() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'e2e-user' })).toString('base64url')
  return `${header}.${payload}.e2e`
}

const user = {
  id: 'e2e-user',
  username: 'e2e_user',
  nickname: 'E2E勇者',
  level: 3,
  totalScore: 1200,
  totalExp: 600,
  loginStreak: 5,
  characterSpriteIndex: 0
}

function levelChapters() {
  return Array.from({ length: 6 }, (_, chapterIndex) => ({
    id: chapterIndex + 1,
    name: `第${chapterIndex + 1}章`,
    theme: 'E2E课程主题',
    description: '用于浏览器端验收的课程地图',
    color: '#4a90d9',
    unlocked: chapterIndex === 0,
    levels: Array.from({ length: 30 }, (_, levelIndex) => ({
      id: levelIndex + 1,
      name: `第${levelIndex + 1}关`,
      wordsCount: 24,
      category: `ch${chapterIndex + 1}_l${levelIndex + 1}`,
      bossType: ['roaming', 'turret', 'charging'][levelIndex % 3],
      unlocked: chapterIndex === 0 && levelIndex < 12,
      completed: levelIndex < 2,
      stars: levelIndex < 2 ? 3 : 0,
      highScore: levelIndex < 2 ? 1200 : 0
    }))
  }))
}

async function mockApi(page) {
  await page.route('**/api/auth/login', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { token: createJwtPayload(), user } })
  }))

  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: user })
  }))

  await page.route('**/api/game/progress', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { currentChapter: 1, currentLevel: 1, currentWordbookId: 'cet4', levels: {}, achievements: [] } })
  }))

  await page.route('**/api/game/levels-status**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { chapters: levelChapters() } })
  }))

  await page.route('**/api/vocab/wordbooks', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ wordbookId: 'cet4', name: 'CET-4 真题核心词库（4500）', total: 4544 }] })
  }))

  await page.route('**/api/vocab/chapter/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ _id: 'word-1', word: 'apple', meaning: '苹果', difficulty: 1, chapter: 1, level: 1 }] })
  }))

  await page.route('**/api/learning/stats**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        totalQuizzes: 18,
        correctRate: '83.3',
        wordsLearned: 12,
        wordsMastered: 7,
        totalVocabCount: 4544,
        masterySummary: { averageMastery: 72, mastered: 7, weak: 3, due: 4, attempts: 18 }
      }
    })
  }))

  await page.route('**/api/learning/error-types**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        errorTypes: [{ errorType: 'spelling_near', count: 2 }, { errorType: 'meaning_confusion', count: 3 }],
        sourceModes: [{ sourceMode: 'mainline', count: 10 }, { sourceMode: 'review', count: 5 }]
      }
    })
  }))

  await page.route('**/api/learning/review/today**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ wordId: 'word-1', word: 'apple', meaning: '苹果', masteryScore: 42, reasons: ['low_mastery'] }] })
  }))

  await page.route('**/api/learning/daily-stats**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ _id: '2026-05-15', total: 10, correct: 8 }] }) }))
  await page.route('**/api/learning/chapter-stats**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ chapter: 1, correctRate: '80.0', total: 10 }] }) }))
  await page.route('**/api/learning/top-mistakes**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ word: 'apple', wrongCount: 2, errorRate: 20 }] }) }))
  await page.route('**/api/learning/heatmap**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [['2026-05-15', 10]] }) }))
  await page.route('**/api/game/leaderboard**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
  await page.route('**/api/daily-challenge/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { completed: false, questions: [] } }) }))
  await page.route('**/api/vocab/stats**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { total: 4544, isValid: true } }) }))
  await page.route('**/api/vocab/source-manifest**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-05-15' } }) }))
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('mobile learning loop exposes login, 6x30 level selector, dashboard report, and no horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('请输入用户名').fill('e2e_user')
  await page.getByPlaceholder('请输入密码').fill('123456')
  await page.getByRole('button', { name: /开始冒险/ }).click()
  await expect(page).toHaveURL(/\/game/)

  await page.goto('/game?e2eLevelSelect=1')
  await expect(page.getByRole('heading', { name: /关卡选择/ })).toBeVisible()
  await expect(page.locator('.segment-btn').filter({ hasText: '1-10关' })).toBeVisible()
  await page.locator('.segment-btn').filter({ hasText: '11-20关' }).click()
  await expect(page.getByText('第11关')).toBeVisible()
  await page.locator('.segment-btn').filter({ hasText: '21-30关' }).click()
  await expect(page.getByText('第21关')).toBeVisible()

  await page.goto('/dashboard')
  await expect(page.getByText('学习数据仪表盘')).toBeVisible()
  await expect(page.getByText('错因分布')).toBeVisible()
  await expect(page.getByText('拼写接近')).toBeVisible()
  await expect(page.getByText('学习入口分布')).toBeVisible()
  await expect(page.getByText('主线关卡')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(2)
})
