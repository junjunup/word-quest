import rateLimit from 'express-rate-limit'

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message }
  })
}

export const globalLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: '请求过于频繁，请稍后再试'
})

export const authLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: '认证操作过于频繁，请稍后再试'
})

export const chatLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 12,
  message: '小智对话过于频繁，请稍后再试'
})

export const vocabularyLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 80,
  message: '词库请求过于频繁，请稍后再试'
})

export const vocabularyImportLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: '词库导入过于频繁，请稍后再试'
})

export const pronunciationLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: '发音评分过于频繁，请稍后再试'
})
