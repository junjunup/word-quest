import request from '@/utils/request'

export const submitQuizRecord = (data) => request.post('/learning/quiz-record', data)
export const getStats = () => request.get('/learning/stats')
export const getDailyStats = (days = 30) => request.get(`/learning/daily-stats?days=${days}`)
export const getChapterStats = () => request.get('/learning/chapter-stats')
export const getTopMistakes = (limit = 10) => request.get(`/learning/top-mistakes?limit=${limit}`)
export const getHeatmap = (year) => request.get(`/learning/heatmap?year=${year}`)
