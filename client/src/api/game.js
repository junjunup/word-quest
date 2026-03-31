import request from '@/utils/request'

export const getProgress = () => request.get('/game/progress')
export const saveProgress = (data) => request.post('/game/progress', data)
export const getLeaderboard = (type = 'total') => request.get(`/game/leaderboard?type=${type}`)
export const getAchievements = () => request.get('/game/achievements')
export const claimDailyReward = () => request.post('/game/daily-reward')
