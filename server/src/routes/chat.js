import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import config from '../config/index.js'

const router = express.Router()

// 输入校验
function validateChatInput(body) {
  if (!body || typeof body.message !== 'string') return '消息不能为空'
  if (body.message.trim().length === 0) return '消息不能为空'
  if (body.message.length > 1000) return '消息过长（最多1000字符）'
  return null
}

// 非流式对话
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const err = validateChatInput(req.body)
    if (err) return res.status(400).json({ success: false, message: err })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时

    try {
      const response = await fetch(`${config.llmServiceUrl}/api/llm/chat`, {
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

      const data = await response.json()
      res.json({ success: true, data })
    } catch (fetchErr) {
      clearTimeout(timeout)
      if (fetchErr.name === 'AbortError') {
        res.status(504).json({ success: false, message: 'LLM服务响应超时' })
      } else {
        throw fetchErr
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'LLM服务连接失败' })
  }
})

// 流式对话 (SSE)
router.post('/stream', authMiddleware, async (req, res) => {
  const err = validateChatInput(req.body)
  if (err) {
    res.status(400).json({ success: false, message: err })
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
      if (err.name === 'AbortError') {
        res.write(`data: ${JSON.stringify({ error: 'LLM服务响应超时' })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({ error: '连接异常' })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

export default router
