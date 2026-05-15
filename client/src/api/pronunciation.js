import request from '@/utils/request'

export const scorePronunciation = (payload) => request.post('/pronunciation/score', payload)
export const getPronunciationHistory = (params = {}) => request.get('/pronunciation/history', { params })
