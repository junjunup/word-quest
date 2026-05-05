import request from '@/utils/request'

// 获取指定章节+关卡的词汇列表
export const getChapterLevelWords = (chapter, level) =>
  request.get(`/vocab/chapter/${chapter}/level/${level}`)

// 获取指定章节的所有词汇
export const getChapterWords = (chapter) =>
  request.get(`/vocab/chapter/${chapter}`)

// 获取单词的答题数据（含语义干扰项）
export const getQuizForWord = (wordId, questionType = 'choice_en2cn') =>
  request.get(`/vocab/quiz/${wordId}`, { params: { questionType } })
