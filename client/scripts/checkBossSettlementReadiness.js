import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const fail = (message) => {
  console.error(`Boss settlement readiness failed: ${message}`)
  process.exit(1)
}
const requireIncludes = (source, needle, message) => {
  if (!source.includes(needle)) fail(message)
}
const requireOrder = (source, first, second, message) => {
  const firstIndex = source.indexOf(first)
  const secondIndex = source.indexOf(second)
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) fail(message)
}

const worldScene = read('src/game/scenes/WorldScene.js')
const resultScene = read('src/game/scenes/ResultScene.js')
const audioManager = read('src/game/systems/AudioManager.js')
const gameView = read('src/views/GameView.vue')
const router = read('src/router/index.js')

requireIncludes(worldScene, 'isGameOverTransitioning', 'WorldScene must guard repeated game-over transitions')
requireIncludes(worldScene, 'window.setTimeout', 'WorldScene game-over transition must not depend on Phaser time.delayedCall')
requireIncludes(worldScene, "this.game.scene.start('ResultScene', finalResult)", 'WorldScene must start ResultScene through the game scene manager with a fixed result')
requireIncludes(worldScene, 'grantBossDefeatReward()', 'Boss quiz result must persist boss defeat before applying wrong-answer life loss')
requireOrder(worldScene, 'this.grantBossDefeatReward()', 'const lifeResult = levelManager.loseLife()', 'Boss defeat reward/state must be applied before wrong-answer life loss can emit GAME_OVER')
requireIncludes(worldScene, 'finishBossQuizRecovery()', 'Boss quiz recovery must be centralized')

const resultCreatePreamble = resultScene.slice(resultScene.indexOf('  create() {'), resultScene.indexOf('    const {'))
if (/this\.input\.enabled\s*=\s*false/.test(resultCreatePreamble)) {
  fail('ResultScene must not globally disable input during create preamble; button-level delayed interactivity is the safe guard')
}
requireIncludes(resultScene, 'if (!isGameOver) {', 'ResultScene must guard LEVEL_COMPLETE emission for game-over results')
requireIncludes(resultScene, "openLevelSelect('retry', chapter, level)", 'Game-over result must offer retry for the current level')

requireIncludes(audioManager, 'canTweenSound(sound)', 'AudioManager must verify sound ownership before tweening')
requireIncludes(audioManager, 'sound.manager === this.scene.sound', 'AudioManager must not tween a sound owned by an old scene')
requireIncludes(audioManager, 'stopAndDestroySound(sound)', 'AudioManager must immediately stop/destroy unsafe cross-scene sounds')

requireIncludes(gameView, 'gameOver: status === \'game_over\'', 'GameView must pass gameOver flag to Phaser quiz result handler')
requireIncludes(gameView, 'audioManager.resumeBGM(0, \'boss_quiz\')', 'GameView game-over cleanup must clear boss quiz BGM pause reason')

requireIncludes(router, 'render() {', 'Router lazy-load fallback must use render function, not runtime template')
if (/template:\s*`/.test(router)) {
  fail('Router lazy-load fallback must not use template strings in runtime-only Vue builds')
}

console.log(JSON.stringify({
  status: 'PASS',
  checks: [
    'deterministic game-over transition',
    'boss defeat state before life-loss GAME_OVER',
    'game-over result semantics',
    'cross-scene audio safety',
    'runtime-safe lazy route fallback'
  ]
}, null, 2))
