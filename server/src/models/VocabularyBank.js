import mongoose from 'mongoose'

const vocabularyBankSchema = new mongoose.Schema({
  wordbookId: { type: String, default: 'cet4', index: true, trim: true },
  wordbookName: { type: String, default: 'CET-4 核心词库', trim: true },
  word: { type: String, required: true, index: true },
  phonetic: { type: String, default: '' },
  meaning: { type: String, required: true },           // 中文释义
  partOfSpeech: { type: String, default: 'n.' },       // 词性
  example: { type: String, default: '' },               // 例句
  exampleTranslation: { type: String, default: '' },    // 例句翻译
  difficulty: { type: Number, default: 1, min: 1, max: 5 },
  chapter: { type: Number, required: true, min: 1, max: 6 },
  level: { type: Number, default: 0 },                  // 所属关卡（0表示本章通用）
  synonyms: [String],
  antonyms: [String],
  rootAnalysis: { type: String, default: '' },           // 词根词缀分析
  memoryTip: { type: String, default: '' },              // 记忆技巧
  category: { type: String, default: '' },               // 词汇分类标签
  source: {                                              // 企业级数据溯源
    provider: { type: String, default: '' },
    sourceFile: { type: String, default: '' },
    sourceBookId: { type: String, default: '' },
    sourceWordId: { type: String, default: '' },
    sourceRank: { type: Number, default: 0 }
  }
})

vocabularyBankSchema.index({ chapter: 1, difficulty: 1 })
vocabularyBankSchema.index({ chapter: 1, level: 1 })
vocabularyBankSchema.index({ wordbookId: 1, chapter: 1, level: 1 })
vocabularyBankSchema.index({ wordbookId: 1, word: 1 }, { unique: true })

export default mongoose.model('VocabularyBank', vocabularyBankSchema)
