import request from '@/utils/request'
import { getSelectedWordbook } from '@/api/vocabulary'

export const submitQuizRecord = (data) => request.post('/learning/quiz-record', { wordbookId: getSelectedWordbook(), ...data })
export const getStats = (wordbookId) => request.get('/learning/stats', { params: wordbookId ? { wordbookId } : {} })
export const getErrorTypeStats = (wordbookId = getSelectedWordbook(), days = 30) => request.get('/learning/error-types', { params: { wordbookId, days } })
export const getDailyStats = (days = 30) => request.get(`/learning/daily-stats?days=${days}`)
export const getChapterStats = () => request.get('/learning/chapter-stats')
export const getTopMistakes = (limit = 10) => request.get(`/learning/top-mistakes?limit=${limit}`)
export const getTodayReview = (limit = 20, wordbookId = getSelectedWordbook()) => request.get('/learning/review/today', { params: { limit, wordbookId } })
export const getMasterySummary = (wordbookId = getSelectedWordbook()) => request.get('/learning/mastery/summary', { params: { wordbookId } })
export const getMasteryWords = (params = {}) => request.get('/learning/mastery/words', { params: { wordbookId: getSelectedWordbook(), ...params } })
export const createReviewSession = (data = {}) => request.post('/learning/review/sessions', { wordbookId: getSelectedWordbook(), ...data })
export const submitReviewSession = (sessionId, answers = []) => request.post(`/learning/review/sessions/${sessionId}/submit`, { answers })
export const getHeatmap = (year) => request.get(`/learning/heatmap?year=${year}`)
