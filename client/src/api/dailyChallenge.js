import request from '@/utils/request'
import { getSelectedWordbook } from '@/api/vocabulary'

export const getTodayDailyChallenge = (wordbookId = getSelectedWordbook()) =>
  request.get('/daily-challenge/today', { params: { wordbookId } })

export const submitDailyChallenge = (id, payload) =>
  request.post(`/daily-challenge/${id}/submit`, payload)

export const getDailyChallengeLeaderboard = (params = {}) =>
  request.get('/daily-challenge/leaderboard', { params: { wordbookId: getSelectedWordbook(), ...params } })

export const openBlindBox = (id) =>
  request.post(`/daily-challenge/${id}/blind-box`)

export const getInventory = () =>
  request.get('/auth/inventory')

export const buyItem = (itemId) =>
  request.post('/auth/buy-item', { itemId })
