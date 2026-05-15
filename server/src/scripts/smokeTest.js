import assert from 'node:assert/strict'
import { validateVocabulary } from '../utils/vocabularyValidator.js'
import { scorePronunciation } from '../services/pronunciationScoringService.js'

const validSample = [
  { word: 'abandon', meaning: '放弃', example: 'Never abandon your goal.', difficulty: 2, chapter: 1, level: 1 },
  { word: 'benefit', meaning: '益处', example: 'Exercise benefits health.', difficulty: 2, chapter: 1, level: 2 }
]

const validReport = validateVocabulary(validSample)
assert.equal(validReport.isValid, true, 'valid vocabulary sample should pass')
assert.equal(validReport.total, 2, 'valid sample total should be 2')

const invalidSample = [
  { word: 'abandon', meaning: '', example: 'x', difficulty: 6, chapter: 9, level: 31 },
  { word: 'abandon', meaning: '放弃', example: 'x', difficulty: 1, chapter: 1, level: 1 }
]

const invalidReport = validateVocabulary(invalidSample)
assert.equal(invalidReport.isValid, false, 'invalid vocabulary sample should fail')
assert.ok(invalidReport.duplicates.length > 0, 'duplicates should be reported')
assert.ok(invalidReport.missingFields.length > 0, 'missing fields should be reported')
assert.ok(invalidReport.invalidRanges.length > 0, 'invalid ranges should be reported')

const scopedDuplicates = validateVocabulary([
  { wordbookId: 'cet4', word: 'abandon', meaning: '放弃', difficulty: 1, chapter: 1, level: 1 },
  { wordbookId: 'cet6', word: 'abandon', meaning: '放弃', difficulty: 1, chapter: 1, level: 1 }
])
assert.equal(scopedDuplicates.duplicates.length, 0, 'same word across different wordbooks should be allowed')

const pronunciation = scorePronunciation({ word: 'abandon', transcript: 'abandon', expectedPhonetic: '/əˈbændən/', confidence: 0.92 })
assert.ok(pronunciation.score >= 90, 'exact pronunciation transcript should receive high score')
assert.equal(pronunciation.grade, 'excellent', 'exact pronunciation transcript should be excellent')

console.log('smoke tests passed')
