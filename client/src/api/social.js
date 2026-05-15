import request from '@/utils/request'

export const searchUsers = (q) => request.get('/social/users/search', { params: { q } })
export const getFriends = () => request.get('/social/friends')
export const sendFriendRequest = (payload) => request.post('/social/friends/request', payload)
export const respondFriendRequest = (id, accept = true) => request.post(`/social/friends/${id}/respond`, { accept })
export const deleteFriendship = (id) => request.delete(`/social/friends/${id}`)
export const createChallenge = (payload) => request.post('/social/challenges', payload)
export const getChallenges = () => request.get('/social/challenges')
export const getChallenge = (id) => request.get(`/social/challenges/${id}`)
export const submitChallenge = (id, answers) => request.post(`/social/challenges/${id}/submit`, { answers })
