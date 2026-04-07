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
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({
  origin: corsOrigin.split(',').map(s => s.trim()),
  credentials: true
}))
app.use(helmet())
app.use(express.json({ limit: '32kb' }))
app.use(express.urlencoded({ extended: true, limit: '32kb' }))
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
    // 尝试连接外部 MongoDB
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
    logger.info('MongoDB connected successfully')
  } catch (err) {
    // 外部 MongoDB 连接失败 → 自动启动内存数据库（无需安装 MongoDB）
    logger.warn('External MongoDB unavailable, starting in-memory database...')
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      const mongod = await MongoMemoryServer.create()
      const memUri = mongod.getUri()
      await mongoose.connect(memUri)
      logger.info(`In-memory MongoDB started at ${memUri}`)
      logger.warn('WARNING: Data will be lost when server stops. Install MongoDB for persistence.')

      // 自动执行 seed（内存库每次重启都是空的）
      try {
        const { seedOnly } = await import('./seed.js')
        await seedOnly()
        logger.info('Auto-seeded in-memory database')
      } catch (seedErr) {
        logger.warn('Auto-seed skipped:', seedErr.message)
      }
    } catch (memErr) {
      logger.error('Failed to start in-memory MongoDB:', memErr)
      process.exit(1)
    }
  }

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`)
  })
}

start()

export default app
