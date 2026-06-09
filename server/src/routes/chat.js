import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import config from '../config/index.js'
import { getCachedReply, setCachedReply } from '../services/chatCacheService.js'
import { getFallbackReply } from '../services/chatFallbackService.js'

const router = express.Router()

// Cycle 4: 每用户每分钟最多 10 次 AI 对话
const chatRateLimit = new Map() // userId → { count, windowStart }
const CHAT_RATE_WINDOW = 60 * 1000  // 1 分钟
const CHAT_RATE_MAX = 10

function checkChatRateLimit(userId) {
  const now = Date.now()
  const entry = chatRateLimit.get(userId)
  if (!entry || now - entry.windowStart > CHAT_RATE_WINDOW) {
    chatRateLimit.set(userId, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= CHAT_RATE_MAX) return false
  entry.count++
  return true
}

// 输入校验
function validateChatInput(body) {
  if (!body || typeof body.message !== 'string') return '消息不能为空'
  if (body.message.trim().length === 0) return '消息不能为空'
  if (body.message.length > 1000) return '消息过长（最多1000字符）'
  return null
}

// 非流式对话（Cycle 4: +缓存 +限流 +降级）
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const err = validateChatInput(req.body)
    if (err) return res.status(400).json({ success: false, message: err })

    // 速率限制检查
    if (!checkChatRateLimit(req.userId)) {
      return res.status(429).json({
        success: false,
        message: '对话太频繁了，请稍等片刻再找小智聊天吧~',
        retryAfter: 60
      })
    }

    const context = req.body.context || {}
    const triggerType = context.triggerType || 'manual'
    const currentWord = context.currentWord || ''

    // 缓存检查（仅缓存特定类型的对话）
    const cached = getCachedReply(currentWord, triggerType, req.body.message)
    if (cached) {
      return res.json({ success: true, data: { reply: cached, source: 'cache' } })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(`${config.llmServiceUrl}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: req.body.message,
          context,
          userId: req.userId
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)

      const data = await response.json()
      // 缓存成功回复
      if (data?.reply || data?.data?.reply) {
        const reply = data.reply || data.data.reply
        setCachedReply(currentWord, triggerType, req.body.message, reply)
      }
      res.json({ success: true, data })
    } catch (fetchErr) {
      clearTimeout(timeout)
      if (fetchErr.name === 'AbortError') {
        // 超时降级
        const fallback = getFallbackReply(context)
        return res.status(504).json({
          success: true,
          data: { reply: fallback, source: 'fallback', fallbackReason: 'timeout' }
        })
      }
      throw fetchErr
    }
  } catch (err) {
    // 连接失败降级
    const fallback = getFallbackReply(req.body.context || {})
    res.status(200).json({
      success: true,
      data: { reply: fallback, source: 'fallback', fallbackReason: 'connection' }
    })
  }
})

// 流式对话 (SSE) (Cycle 4: +限流 +降级)
router.post('/stream', authMiddleware, async (req, res) => {
  const err = validateChatInput(req.body)
  if (err) {
    res.status(400).json({ success: false, message: err })
    return
  }

  // 速率限制
  if (!checkChatRateLimit(req.userId)) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`data: ${JSON.stringify({ error: '对话太频繁了，请稍等片刻~', retryAfter: 60 })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // nginx 环境下禁用缓冲

  // 监听客户端断开连接
  let clientDisconnected = false
  req.on('close', () => { clientDisconnected = true })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60秒总超时

    const response = await fetch(`${config.llmServiceUrl}/api/llm/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: req.body.message,
        context: req.body.context || {},
        userId: req.userId
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ error: 'LLM服务错误' })}\n\n`)
      res.end()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let totalBytes = 0
    const MAX_RESPONSE_SIZE = 50 * 1024 // 50KB 上限

    try {
      while (!clientDisconnected) {
        const { done, value } = await reader.read()
        if (done) break

        totalBytes += value.length
        if (totalBytes > MAX_RESPONSE_SIZE) {
          res.write(`data: ${JSON.stringify({ error: '响应超过大小限制' })}\n\n`)
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        res.write(chunk)
      }
    } finally {
      reader.releaseLock()
    }

    if (!clientDisconnected) {
      res.write('data: [DONE]\n\n')
    }
    res.end()
  } catch (err) {
    if (!clientDisconnected) {
      const fallback = getFallbackReply(req.body.context || {})
      if (err.name === 'AbortError') {
        res.write(`data: ${JSON.stringify({ reply: fallback, source: 'fallback', fallbackReason: 'timeout' })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({ reply: fallback, source: 'fallback', fallbackReason: 'connection' })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

export default router
