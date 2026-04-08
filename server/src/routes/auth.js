import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import config from '../config/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// 简易登录频率限制（内存，适合单实例）
const loginAttempts = new Map()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15分钟

// 每5分钟清理过期的登录尝试记录
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(key)
    }
  }
}, 5 * 60 * 1000)

function checkRateLimit(ip) {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
    return true
  }
  record.count++
  return record.count <= MAX_ATTEMPTS
}

// 输入校验工具
function validateUsername(username) {
  if (!username || typeof username !== 'string') return '用户名不能为空'
  const trimmed = username.trim()
  if (trimmed.length < 3 || trimmed.length > 30) return '用户名长度需要3-30个字符'
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmed)) return '用户名只能包含字母、数字、下划线或中文'
  return null
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return '密码不能为空'
  if (password.length < 6 || password.length > 100) return '密码长度需要6-100个字符'
  return null
}

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body

    const usernameErr = validateUsername(username)
    if (usernameErr) return res.status(400).json({ success: false, message: usernameErr })

    const passwordErr = validatePassword(password)
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr })

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.trim().length > 20) {
      return res.status(400).json({ success: false, message: '昵称长度需要1-20个字符' })
    }

    const existingUser = await User.findOne({ username: username.trim() })
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' })
    }

    const user = new User({
      username: username.trim(),
      password,
      nickname: nickname.trim()
    })
    await user.save()

    const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          characterSpriteIndex: user.characterSpriteIndex || 0,
          level: user.level,
          totalExp: user.totalExp,
          totalScore: user.totalScore
        }
      }
    })
  } catch (err) {
    // 不暴露内部错误细节给客户端
    console.error('注册错误:', err.message)
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' })
  }
})

// 登录
router.post('/login', async (req, res) => {
  try {
    // 频率限制
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown'
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ success: false, message: '登录尝试过于频繁，请15分钟后再试' })
    }

    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名和密码' })
    }

    const user = await User.findOne({ username: username.trim() })
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' })
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date()
    await user.save()

    const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          characterSpriteIndex: user.characterSpriteIndex || 0,
          level: user.level,
          totalExp: user.totalExp,
          totalScore: user.totalScore
        }
      }
    })
  } catch (err) {
    console.error('登录错误:', err.message, err.stack)
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' })
  }
})

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password')
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' })
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: '获取用户信息失败' })
  }
})

export default router
