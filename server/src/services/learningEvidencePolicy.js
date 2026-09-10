export function classifyEvidence(record) {
  if (!record.attemptPhase || record.attemptPhase === 'unknown' || !record.assistance || record.assistance === 'unknown') return 'unknown'
  if (record.attemptPhase === 'correction') return 'correction'
  if (record.assistance !== 'none' || record.hintUsed || record.questionType === 'spell_hint') return 'assisted'
  return ['spell_full', 'translate', 'fill_blank'].includes(record.questionType) ? 'recall' : 'recognition'
}
export function passesDelayedReview(record, previous, now) {
  return classifyEvidence(record) === 'recall' && record.isCorrect && (!record.answerQuality || record.answerQuality === 'exact') && previous != null &&
    new Date(now) - new Date(previous) >= 86400000
}
export function dailyDateKey(now = new Date()) {
  return new Date(+now + 8 * 3600000).toISOString().slice(0, 10)
}
export function selectDailyWords(due, fresh) {
  const result = [], seen = new Set()
  const add = (rows, kind, cap) => {
    for (const row of rows) {
      const id = String(row._id)
      if (result.length >= cap) break
      if (!seen.has(id)) { seen.add(id); result.push({ ...row, kind }) }
    }
  }
  add(due, 'review', 5); add(fresh, 'new', 10); add(due, 'review', 10)
  return result
}
