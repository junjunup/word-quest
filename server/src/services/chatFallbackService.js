/**
 * Cycle 4: LLM 离线降级服务
 * 当 LLM 服务不可用时，返回预置回答模板
 */

const FALLBACKS = {
  wrong_answer: (ctx) => {
    const word = ctx.currentWord || '这个词'
    return `"${word}"确实容易记混！试试这个方法：把它拆成小片段来记，比如按发音分段。同时注意看例句了解它的用法。加油，下次一定能答对！💪`
  },

  ask_help: (ctx) => {
    const word = ctx.currentWord || '这个单词'
    return `关于"${word}"：建议你先看它的例句理解用法，再结合词根来记忆拼写。如果需要更详细的解释，可以等网络恢复后再问我哦！📖`
  },

  encourage: (ctx) => {
    const wrong = ctx.wrongStreak || 0
    if (wrong >= 5) {
      return '连续答错确实让人沮丧...不过你知道吗？大脑在犯错时学习效果反而更好！休息一下，调整状态，你一定能突破的！🌟'
    }
    return '学习英语是个积累的过程，每次犯错都是进步的机会。调整一下呼吸，我们继续前进！✨'
  },

  celebrate: (ctx) => {
    const streak = ctx.correctStreak || 0
    return `太棒了！连续答对${streak}题，你的词汇力量正在飞速增长！保持这个势头，继续征服词汇大陆吧！🎉`
  },

  level_summary: (ctx) => {
    const chapter = ctx.chapterName || '当前章节'
    return `恭喜完成${chapter}的挑战！你的词汇掌握度在稳步提升。记得经常回来复习，让知识更牢固哦。下一关等你来挑战！🏆`
  },

  default: () =>
    '小智正在词汇图书馆整理知识卡片，请稍后再来聊天吧！你可以继续答题闯关，不会影响学习进度哦~ 📚'
}

/**
 * 根据对话上下文返回预置降级回复
 * @param {object} context — { triggerType, currentWord, wrongStreak, correctStreak, chapterName, playerLevel }
 * @returns {string}
 */
export function getFallbackReply(context = {}) {
  const triggerType = context.triggerType || 'default'
  const handler = FALLBACKS[triggerType] || FALLBACKS.default
  return handler(context)
}
