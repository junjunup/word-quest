/**
 * Cycle1 T1 regression test: death spiral grace-life timing fix.
 * Run: node --test (needs ESM). Verifies pre-fix bug: hard(2 lives) never triggered grace.
 */
import assert from 'node:assert'
import test from 'node:test'
import lm from '../../src/game/systems/LevelManager.js'

test('T1: hard(2 lives) consecutive wrong still triggers one grace rescue', () => {
  lm.initLevel(1, 1, [{word:'a'},{word:'b'},{word:'c'}], 'hard')
  assert.strictEqual(lm.lives, 2)
  assert.strictEqual(lm.handleAnswer(true, 2000, 100), 'continue')
  assert.strictEqual(lm.handleAnswer(false, 5000, 0), 'continue')
  assert.strictEqual(lm.handleAnswer(false, 5000, 0), 'grace_rescued')
  assert.strictEqual(lm.lives, 1)
  assert.strictEqual(lm.graceLifeUsed, true)
  assert.strictEqual(lm.handleAnswer(false, 5000, 0), 'game_over')
})

test('T1: no rescue if never answered correctly (anti free-revive)', () => {
  lm.initLevel(1, 1, [{word:'a'}], 'hard')
  lm.handleAnswer(false, 5000, 0)
  assert.strictEqual(lm.handleAnswer(false, 5000, 0), 'game_over')
})

test('T1: normal difficulty still protected (no regression)', () => {
  lm.initLevel(1, 1, [{word:'a'},{word:'b'}], 'normal')
  lm.handleAnswer(true, 2000, 100)
  lm.handleAnswer(false, 5000, 0)
  lm.handleAnswer(false, 5000, 0)
  assert.strictEqual(lm.handleAnswer(false, 5000, 0), 'grace_rescued')
})
