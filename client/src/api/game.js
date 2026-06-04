import request from '@/utils/request'
import { getSelectedWordbook } from '@/api/vocabulary'

export const getProgress = () => request.get('/game/progress')
export const saveProgress = (data) => request.post('/game/progress', { wordbookId: getSelectedWordbook(), ...data })
export const getLeaderboard = (type = 'total') => request.get(`/game/leaderboard?type=${type}`)
export const getAchievements = () => request.get('/game/achievements')
export const saveAchievement = (data) => request.post('/game/achievements', data)
export const claimDailyReward = () => request.post('/game/daily-reward')
export const updateCharacter = (data) => request.put('/game/character', data)
export const getLevelsStatus = (wordbookId = getSelectedWordbook()) => request.get('/game/levels-status', { params: { wordbookId } })
export const submitEndlessScore = (data) => request.post('/game/endless-score', data)
export const getEndlessBestScore = () => request.get('/game/endless-score')

// ── 逐词记忆模型 API ──
// 获取自适应推荐单词列表
export const getAdaptiveWords = (chapterId, levelId, count = 10, wordbookId = getSelectedWordbook()) =>
  request.get('/game/adaptive/words', { params: { chapterId, levelId, count, wordbookId } })

// 更新单词掌握度（每次答题后调用）
export const updateWordMastery = (data) => request.post('/game/word-mastery/update', data)

// 获取复习日历
export const getReviewCalendar = (month, wordbookId = getSelectedWordbook()) =>
  request.get('/game/review/calendar', { params: { month, wordbookId } })
