import request from '@/utils/request'

const WORDBOOK_KEY = 'wordquest:selectedWordbook'

export function getSelectedWordbook() {
  return localStorage.getItem(WORDBOOK_KEY) || 'cet4'
}

export function setSelectedWordbook(wordbookId) {
  localStorage.setItem(WORDBOOK_KEY, wordbookId || 'cet4')
}

function wordbookParams(wordbookId = getSelectedWordbook()) {
  return { params: { wordbookId } }
}

// 获取指定章节+关卡的词汇列表
export const getChapterLevelWords = (chapter, level, wordbookId = getSelectedWordbook()) =>
  request.get(`/vocab/chapter/${chapter}/level/${level}`, wordbookParams(wordbookId))

// 获取指定章节的所有词汇
export const getChapterWords = (chapter, wordbookId = getSelectedWordbook()) =>
  request.get(`/vocab/chapter/${chapter}`, wordbookParams(wordbookId))

// 获取单词的答题数据（含语义干扰项）
export const getQuizForWord = (wordId, questionType = 'choice_en2cn') =>
  request.get(`/vocab/quiz/${wordId}`, { params: { questionType } })

// 获取词库规模与章节/关卡分布统计
export const getVocabularyStats = (wordbookId = getSelectedWordbook()) =>
  request.get('/vocab/stats', wordbookParams(wordbookId))

// 获取可用词书列表
export const getWordbooks = () => request.get('/vocab/wordbooks')

// 获取词库数据来源清单（审计/追溯）
export const getVocabularySourceManifest = () => request.get('/vocab/source-manifest')

// 自定义词库导入：dryRun=true 只校验，不写库
export const importVocabulary = (words, dryRun = true, wordbook = {}) =>
  request.post('/vocab/import', {
    words,
    dryRun,
    wordbookId: wordbook.wordbookId || getSelectedWordbook(),
    wordbookName: wordbook.wordbookName || '自定义词书'
  })
