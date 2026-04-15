import request from '@/utils/request'

export const getProgress = () => request.get('/game/progress')
export const saveProgress = (data) => request.post('/game/progress', data)
export const getLeaderboard = (type = 'total') => request.get(`/game/leaderboard?type=${type}`)
export const getAchievements = () => request.get('/game/achievements')
export const saveAchievement = (data) => request.post('/game/achievements', data)
export const claimDailyReward = () => request.post('/game/daily-reward')
export const updateCharacter = (data) => request.put('/game/character', data)
export const getLevelsStatus = () => request.get('/game/levels-status')
export const submitEndlessScore = (data) => request.post('/game/endless-score', data)
export const getEndlessBestScore = () => request.get('/game/endless-score')
