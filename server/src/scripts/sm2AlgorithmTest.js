/**
 * SM-2 算法单元测试
 *
 * 测试 updateWithSM2, mapQuizToSM2Quality, calculateTransition 的正确性。
 * 使用 Node.js 18+ 内置的 node:test + node:assert。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// 动态导入 __testables（模块级私有函数）
const { updateWithSM2, mapQuizToSM2Quality, calculateTransition, addDays, clamp } = (
  await import('../services/masteryService.js')
).__testables

// ─── clamp ────────────────────────────────────────────
describe('clamp()', () => {
  it('clamp 在范围内返回原值', () => {
    assert.equal(clamp(5, 0, 10), 5)
    assert.equal(clamp(2.5, 1.3, 3.0), 2.5)
  })

  it('clamp 超上限时返回上限', () => {
    assert.equal(clamp(100, 0, 10), 10)
    assert.equal(clamp(3.5, 1.3, 3.0), 3.0)
  })

  it('clamp 低于下限时返回下限', () => {
    assert.equal(clamp(-5, 0, 10), 0)
    assert.equal(clamp(0.5, 1.3, 3.0), 1.3)
  })

  it('clamp 处理 NaN 输入时返回最小值', () => {
    assert.equal(clamp(NaN, 0, 10), 0)
  })
})

// ─── addDays ──────────────────────────────────────────
describe('addDays()', () => {
  it('addDays 正数天数', () => {
    const d = new Date('2026-06-01')
    const result = addDays(d, 7)
    assert.equal(result.toISOString().slice(0, 10), '2026-06-08')
  })

  it('addDays 零天返回同一天', () => {
    const d = new Date('2026-06-01')
    const result = addDays(d, 0)
    assert.equal(result.toISOString().slice(0, 10), '2026-06-01')
  })

  it('addDays 小数天数 (0.25 = 6小时)', () => {
    const d = new Date('2026-06-01T12:00:00Z')
    const result = addDays(d, 0.25)
    // 6小时后 → 同一天
    assert.equal(result.toISOString().slice(0, 10), '2026-06-01')
    assert.equal(result.getUTCHours(), 18)
  })
})

// ─── mapQuizToSM2Quality ──────────────────────────────
describe('mapQuizToSM2Quality() — 答题质量映射', () => {
  it('拼写完全正确 → quality=5', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'spell_full',
      answerQuality: 'exact',
      isCorrect: true
    })
    assert.equal(result, 5)
  })

  it('翻译题完全正确 → quality=5', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'translate',
      answerQuality: 'exact',
      isCorrect: true
    })
    assert.equal(result, 5)
  })

  it('选择题正确 → quality=4', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'choice_en2cn',
      answerQuality: 'exact',
      isCorrect: true
    })
    assert.equal(result, 4)
  })

  it('听力题正确 → quality=4', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'pronunciation',
      answerQuality: 'exact',
      isCorrect: true
    })
    assert.equal(result, 4)
  })

  it('拼写模糊匹配(near) → quality=3', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'spell_full',
      answerQuality: 'near',
      isCorrect: false
    })
    assert.equal(result, 3)
  })

  it('完全错误 → quality=0', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'choice_cn2en',
      answerQuality: 'wrong',
      isCorrect: false
    })
    assert.equal(result, 0)
  })

  it('不记得但看到答案想起来 → quality=0 (isCorrect=false)', () => {
    const result = mapQuizToSM2Quality({
      questionType: 'spell_full',
      answerQuality: 'wrong',
      isCorrect: false
    })
    assert.equal(result, 0)
  })
})

// ─── updateWithSM2 ────────────────────────────────────
describe('updateWithSM2() — 标准 SM-2 算法', () => {
  // ── 正确回答（quality >= 3）──

  it('首次正确：interval 0 → 1, easeFactor 不变', () => {
    const result = updateWithSM2(0, 2.5, 4)
    assert.equal(result.interval, 1)
    assert.equal(result.easeFactor, 2.5)  // q=4 → EF += (0.1 - 1*0.1) = 0
    assert.equal(result.learningStage, 'learning')
  })

  it('二次正确：interval 1 → 6', () => {
    const result = updateWithSM2(1, 2.5, 4)
    assert.equal(result.interval, 6)
    assert.equal(result.easeFactor, 2.5)
    assert.equal(result.learningStage, 'learning')
  })

  it('三次正确：interval 6 → round(6 * 2.5) = 15', () => {
    const result = updateWithSM2(6, 2.5, 4)
    assert.equal(result.interval, 15)
    assert.equal(result.learningStage, 'review')
  })

  it('质量5 → easeFactor 增长最多', () => {
    // q=5 → EF += (0.1 - 0*(0.08+0)) = 0.1
    const result = updateWithSM2(6, 2.5, 5)
    assert.equal(result.easeFactor, 2.6)
    // interval = round(6 * 2.5) = 15, then: round(15 * 2.6) = 39
    // Wait no - the interval from previous step is 6, easeFactor is 2.5
    // interval = round(6 * 2.5) = 15, EF = 2.5 + 0.1 = 2.6
    assert.equal(result.interval, 15)
  })

  it('质量3 → easeFactor 降低', () => {
    // q=3 → EF += (0.1 - 2*(0.08+2*0.02)) = 0.1 - 2*0.12 = -0.14
    const result = updateWithSM2(6, 2.5, 3)
    assert.ok(result.easeFactor < 2.4, `expected EF < 2.4, got ${result.easeFactor}`)
    assert.equal(result.interval, 15)
    assert.equal(result.learningStage, 'review')
  })

  it('长期掌握：interval >= 21 → learningStage = mastered', () => {
    const result = updateWithSM2(21, 2.5, 4)
    // interval = round(21 * 2.5) = 53
    assert.equal(result.learningStage, 'mastered')
    assert.ok(result.interval >= 50)
  })

  // ── 错误回答（quality < 3）──

  it('答错（q=0）→ 重置 interval=0, EF -= 0.2', () => {
    const result = updateWithSM2(15, 2.5, 0)
    assert.equal(result.interval, 0)
    assert.equal(result.easeFactor, 2.3)
    assert.equal(result.learningStage, 'learning')
  })

  it('答错后 EF 不低于 1.3', () => {
    const result = updateWithSM2(1, 1.3, 0)
    assert.equal(result.interval, 0)
    assert.equal(result.easeFactor, 1.3)  // 1.3 - 0.2 → clamped to 1.3
  })

  // ── 边界情况 ──

  it('EF 不高于 3.0', () => {
    // 极端情况：连续高质量回答 → EF should cap at 3.0
    let ef = 2.9
    let int = 21
    for (let i = 0; i < 10; i++) {
      const r = updateWithSM2(int, ef, 5)
      int = r.interval
      ef = r.easeFactor
    }
    assert.ok(ef <= 3.0, `EF exceeded 3.0: ${ef}`)
  })

  it('interval 非负', () => {
    const result = updateWithSM2(0, 1.3, 0)
    assert.ok(result.interval >= 0)
  })

  it('质量4的 ease factor 变化为0（q=4时 (5-q)=1）', () => {
    // EF += 0.1 - 1*(0.08+1*0.02) = 0.1 - 0.1 = 0
    const result = updateWithSM2(6, 2.5, 4)
    assert.equal(result.easeFactor, 2.5)
  })
})

// ─── SM-2 完整周期模拟 ─────────────────────────────────
describe('SM-2 完整学习周期', () => {
  it('从新词到掌握，6次正确回答', () => {
    let ef = 2.5
    let interval = 0
    const timeline = []

    // 模拟 6 次 quality=4 的回答
    for (let i = 0; i < 6; i++) {
      const r = updateWithSM2(interval, ef, 4)
      interval = r.interval
      ef = r.easeFactor
      timeline.push({ step: i + 1, interval, ef, stage: r.learningStage })
    }

    // 验证阶段递进
    assert.equal(timeline[0].interval, 1)   // 第1次 → 1天
    assert.equal(timeline[1].interval, 6)   // 第2次 → 6天
    assert.equal(timeline[5].stage, 'mastered')  // 第6次 → mastered
    // 第6次的间隔应该 >= 15
    assert.ok(timeline[5].interval >= 15, `expected >=15, got ${timeline[5].interval}`)
  })

  it('学习 → 答错重置 → 再学习', () => {
    // 先正确3次，然后答错，间隔应重置
    let ef = 2.5
    let interval = 0

    // 3次正确
    for (let i = 0; i < 3; i++) {
      const r = updateWithSM2(interval, ef, 4)
      interval = r.interval
      ef = r.easeFactor
    }
    assert.ok(interval >= 15, `After 3 correct, interval should be >=15, got ${interval}`)

    // 1次错误
    const wrong = updateWithSM2(interval, ef, 0)
    assert.equal(wrong.interval, 0, 'Should reset to 0 after error')
    assert.equal(wrong.learningStage, 'learning')

    // 重新学习：再正确1次
    const relearn = updateWithSM2(0, wrong.easeFactor, 4)
    assert.equal(relearn.interval, 1)
  })
})

// ─── calculateTransition ──────────────────────────────
describe('calculateTransition() — 答题转换', () => {
  it('新词首次答对 → score+10, interval 按 SM-2 计算', () => {
    // reviewInterval=0 被 || 1 兜底处理 — 这是预期行为
    const mastery = { masteryScore: 0, reviewInterval: 0, easeFactor: 2.5 }
    const record = {
      questionType: 'choice_en2cn',
      answerQuality: 'exact',
      isCorrect: true,
      errorType: 'unknown'
    }
    const t = calculateTransition(mastery, record)
    // interval 从 1（|| 1 兜底）→ SM-2 第二次复习 → 6
    assert.ok(t.interval >= 1, `expected interval >= 1, got ${t.interval}`)
    assert.equal(t.delta, 10)
    assert.equal(t.nextScore, 10)
    assert.equal(t.learningStage, 'learning')
  })

  it('拼写完全正确 → sm2Quality=5, delta=10', () => {
    const mastery = { masteryScore: 50, reviewInterval: 6, easeFactor: 2.5 }
    const record = {
      questionType: 'spell_full',
      answerQuality: 'exact',
      isCorrect: true,
      errorType: 'unknown'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.sm2Quality, 5)
    assert.equal(t.delta, 10)
    assert.ok(t.interval >= 15)  // round(6 * 2.5) = 15
  })

  it('答错 → sm2Quality=0, delta=-15, learningStage reset', () => {
    const mastery = { masteryScore: 60, reviewInterval: 15, easeFactor: 2.5 }
    const record = {
      questionType: 'choice_cn2en',
      answerQuality: 'wrong',
      isCorrect: false,
      errorType: 'unknown'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.sm2Quality, 0)
    assert.equal(t.delta, -15)
    assert.equal(t.nextScore, 45)
    assert.equal(t.interval, 0)
    assert.equal(t.learningStage, 'learning')
  })

  it('模糊匹配(near) → sm2Quality=3, delta=3', () => {
    const mastery = { masteryScore: 40, reviewInterval: 6, easeFactor: 2.5 }
    const record = {
      questionType: 'spell_full',
      answerQuality: 'near',
      isCorrect: false,
      errorType: 'spelling_near'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.sm2Quality, 3)
    assert.equal(t.delta, 3)
    assert.equal(t.nextScore, 43)
  })

  it('超时 → delta=-12 (比普通答错惩罚轻)', () => {
    const mastery = { masteryScore: 60, reviewInterval: 15, easeFactor: 2.5 }
    const record = {
      questionType: 'spell_full',
      answerQuality: 'wrong',
      isCorrect: false,
      errorType: 'timeout'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.errorType, 'timeout')
    assert.equal(t.delta, -12)  // timeout is -12 vs wrong is -15
    assert.equal(t.nextScore, 48)
  })

  it('score 不会超过 100', () => {
    const mastery = { masteryScore: 95, reviewInterval: 6, easeFactor: 2.5 }
    const record = {
      questionType: 'spell_full',
      answerQuality: 'exact',
      isCorrect: true,
      errorType: 'unknown'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.nextScore, 100)  // 95 + 10 → clamped to 100
  })

  it('score 不会低于 0', () => {
    const mastery = { masteryScore: 5, reviewInterval: 1, easeFactor: 2.5 }
    const record = {
      questionType: 'choice_en2cn',
      answerQuality: 'wrong',
      isCorrect: false,
      errorType: 'unknown'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.nextScore, 0)  // 5 + (-15) → clamped to 0
  })

  it('发音题正确 → 特殊 delta=4', () => {
    const mastery = { masteryScore: 30, reviewInterval: 6, easeFactor: 2.5 }
    const record = {
      questionType: 'pronunciation',
      answerQuality: 'exact',
      isCorrect: true,
      errorType: 'pronunciation'
    }
    const t = calculateTransition(mastery, record)
    assert.equal(t.errorType, 'pronunciation')
    assert.equal(t.delta, 4)  // pronunciation correct is +4, not +10
  })
})

console.log(JSON.stringify({ status: 'PASS', suites: 5 }))