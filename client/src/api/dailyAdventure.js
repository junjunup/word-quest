import request from '@/utils/request'

/** 获取今日冒险单词队列 */
export const getDailyAdventureQueue = (limit = 20) =>
  request.get('/daily-adventure/queue', { params: { limit } })

/** 获取待复习单词数量（用于菜单 badge） */
export const getDailyAdventureCount = () =>
  request.get('/daily-adventure/count')
