import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyEvidence, passesDelayedReview, dailyDateKey, selectDailyWords } from '../services/learningEvidencePolicy.js'

test('historical and assisted answers never become independent recall', () => {
  assert.equal(classifyEvidence({ questionType: 'spell_full', isCorrect: true }), 'unknown')
  assert.equal(classifyEvidence({ assistance: 'answer_shown', attemptPhase: 'correction', questionType: 'spell_full' }), 'correction')
  assert.equal(classifyEvidence({ assistance: 'partial', attemptPhase: 'first', questionType: 'spell_hint' }), 'assisted')
  assert.equal(classifyEvidence({ assistance: 'none', attemptPhase: 'first', questionType: 'choice_en2cn' }), 'recognition')
  assert.equal(classifyEvidence({ assistance: 'none', attemptPhase: 'first', questionType: 'spell_full' }), 'recall')
})
test('delayed evidence requires independent first answer and a full 24h gap', () => {
  const first = new Date('2026-09-08T16:00:00Z')
  const record = { assistance: 'none', attemptPhase: 'first', questionType: 'spell_full', isCorrect: true }
  assert.equal(passesDelayedReview(record, first, new Date(+first + 86400000)), true)
  assert.equal(passesDelayedReview(record, first, new Date(+first + 86399999)), false)
  assert.equal(passesDelayedReview({ ...record, assistance: 'partial' }, first, new Date(+first + 86400000)), false)
  assert.equal(passesDelayedReview(record, null, new Date()), false)
  assert.equal(passesDelayedReview({ ...record, answerQuality: 'near' }, first, new Date(+first + 86400000)), false)
})
test('daily date is Shanghai and queue is unique, bounded and review-first', () => {
  assert.equal(dailyDateKey(new Date('2026-09-09T15:59:59Z')), '2026-09-09')
  assert.equal(dailyDateKey(new Date('2026-09-09T16:00:00Z')), '2026-09-10')
  const due = Array.from({ length: 8 }, (_, i) => ({ _id: `r${i}` }))
  const fresh = Array.from({ length: 20 }, (_, i) => ({ _id: `n${i}` }))
  let q = selectDailyWords(due, fresh)
  assert.equal(q.length, 10); assert.equal(q.filter(x => x.kind === 'review').length, 5)
  q = selectDailyWords(due, fresh.slice(0, 2))
  assert.equal(q.length, 10); assert.equal(q.filter(x => x.kind === 'review').length, 8)
  assert.equal(selectDailyWords([], fresh.slice(0, 3)).length, 3)
  assert.equal(selectDailyWords([due[0], due[0]], []).length, 1)
})
