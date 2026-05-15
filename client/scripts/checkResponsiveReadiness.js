import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (path) => readFileSync(join(ROOT, path), 'utf-8')

function assertLevelsPagination() {
  const levels = JSON.parse(read('src/game/data/levels.json'))
  assert.equal(levels.chapters.length, 6, 'levels.json should contain 6 chapters')
  for (const chapter of levels.chapters) {
    assert.equal(chapter.levels.length, 30, `chapter ${chapter.id} should contain 30 levels`)
  }

  const levelSelect = read('src/components/LevelSelect.vue')
  assert.match(levelSelect, /LEVELS_PER_SEGMENT\s*=\s*10/, 'LevelSelect should segment 30 levels into smaller pages')
  assert.match(levelSelect, /visibleLevels/, 'LevelSelect should render visibleLevels instead of all 30 levels at once')
  assert.match(levelSelect, /level-segments/, 'LevelSelect should expose segment controls')
  assert.match(levelSelect, /@media \(max-width: 430px\)/, 'LevelSelect should include 390/430px responsive rules')
}

function assertMobileTouchTargets() {
  const files = [
    'src/components/LevelSelect.vue',
    'src/components/QuizModal.vue',
    'src/components/ReviewMode.vue',
    'src/views/DashboardView.vue'
  ]
  for (const file of files) {
    const content = read(file)
    assert.match(content, /min-height:\s*44px|min-height:\s*52px|height:\s*44px/, `${file} should define mobile touch target sizing`)
  }
}

function assertDashboardLearningLoop() {
  const dashboard = read('src/views/DashboardView.vue')
  const report = read('src/components/LearningReport.vue')
  const api = read('src/api/learning.js')

  assert.match(api, /getErrorTypeStats/, 'learning API should expose error type stats')
  assert.match(dashboard, /getErrorTypeStats/, 'Dashboard should load error type stats')
  assert.match(dashboard, /:error-type-data=/, 'Dashboard should pass errorTypeData to LearningReport')
  assert.match(dashboard, /:source-mode-data=/, 'Dashboard should pass sourceModeData to LearningReport')
  assert.match(report, /错因分布/, 'LearningReport should render error type distribution')
  assert.match(report, /学习入口分布/, 'LearningReport should render source mode distribution')
}

function assertNoHorizontalOverflowHotspots() {
  const dashboard = read('src/views/DashboardView.vue')
  const levelSelect = read('src/components/LevelSelect.vue')
  assert.match(dashboard, /@media \(max-width: 430px\)/, 'Dashboard should include 430px responsive rules')
  assert.match(dashboard, /grid-template-columns:\s*1fr/, 'Dashboard should collapse grid on narrow screens')
  assert.match(levelSelect, /max-width:\s*100vw/, 'LevelSelect mobile panel should not exceed viewport width')
  assert.doesNotMatch(levelSelect, /grid-template-columns:\s*repeat\(5, 1fr\)[\s\S]*@media \(max-width: 430px\)[\s\S]*grid-template-columns:\s*repeat\(5, 1fr\)/, 'LevelSelect should not keep 5 columns on 430px screens')
}

assertLevelsPagination()
assertMobileTouchTargets()
assertDashboardLearningLoop()
assertNoHorizontalOverflowHotspots()

console.log(JSON.stringify({
  status: 'PASS',
  checks: [
    '6x30 levels segmented in LevelSelect',
    'mobile touch targets present',
    'dashboard learning loop report data wired',
    '430px responsive overflow hotspots guarded'
  ]
}, null, 2))
