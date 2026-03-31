import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import config from './config/index.js'
import authRoutes from './routes/auth.js'
import gameRoutes from './routes/game.js'
import vocabRoutes from './routes/vocabulary.js'
import learningRoutes from './routes/learning.js'
import chatRoutes from './routes/chat.js'
import { errorHandler } from './middleware/errorHandler.js'
import logger from './utils/logger.js'

// 全局速率限制: 每IP每分钟100次
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
})

// 严格限制: 注册/聊天 每IP每分钟10次
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: '操作过于频繁，请稍后再试' }
})

const app = express()

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}))
app.use(helmet())
app.use(express.json())
app.use('/api', globalLimiter)

// 路由
app.use('/api/auth', strictLimiter, authRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/vocab', vocabRoutes)
app.use('/api/learning', learningRoutes)
app.use('/api/chat', strictLimiter, chatRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 错误处理
app.use(errorHandler)

// 连接数据库并启动服务
async function start() {
  try {
    await mongoose.connect(config.mongoUri)
    logger.info('MongoDB connected successfully')

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`)
    })
  } catch (err) {
    logger.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

export default app
