import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import helmet from 'helmet'
import { pathToFileURL } from 'url'
import config from './config/index.js'
import authRoutes from './routes/auth.js'
import gameRoutes from './routes/game.js'
import vocabRoutes from './routes/vocabulary.js'
import learningRoutes from './routes/learning.js'
import chatRoutes from './routes/chat.js'
import socialRoutes from './routes/social.js'
import pronunciationRoutes from './routes/pronunciation.js'
import dailyChallengeRoutes from './routes/dailyChallenge.js'
import { errorHandler } from './middleware/errorHandler.js'
import {
  globalLimiter,
  authLimiter,
  chatLimiter,
  vocabularyLimiter,
  vocabularyImportLimiter,
  pronunciationLimiter
} from './middleware/rateLimiters.js'
import { auditLogger } from './middleware/auditLogger.js'
import logger from './utils/logger.js'

const app = express()

// 中间件
app.use(cors({
  origin: config.corsOrigin.split(',').map(s => s.trim()),
  credentials: true
}))
app.use(helmet())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use('/api', globalLimiter)

// 路由
app.use('/api/auth', authLimiter, auditLogger('auth'), authRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/vocab/import', vocabularyImportLimiter, auditLogger('vocab_import'))
app.use('/api/vocab', vocabularyLimiter, vocabRoutes)
app.use('/api/learning', learningRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/pronunciation', pronunciationLimiter, auditLogger('pronunciation'), pronunciationRoutes)
app.use('/api/daily-challenge', dailyChallengeRoutes)
app.use('/api/chat', chatLimiter, auditLogger('chat'), chatRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 错误处理
app.use(errorHandler)

// 连接数据库并启动服务
export async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
    logger.info('MongoDB connected successfully')
  } catch (err) {
    if (config.isProduction) {
      logger.error('Production MongoDB connection failed; in-memory fallback is disabled:', err)
      process.exit(1)
    }

    logger.warn('External MongoDB unavailable, starting in-memory database...')
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      const mongod = await MongoMemoryServer.create()
      const memUri = mongod.getUri()
      await mongoose.connect(memUri)
      logger.info(`In-memory MongoDB started at ${memUri}`)
      logger.warn('WARNING: Data will be lost when server stops. Install MongoDB for persistence.')

      if (process.env.AUTO_SEED_MEMORY_DB !== 'false') {
        try {
          const { seedOnly } = await import('./seed.js')
          await seedOnly()
          logger.info('Auto-seeded in-memory database')
        } catch (seedErr) {
          logger.warn('Auto-seed skipped:', seedErr.message)
        }
      }
    } catch (memErr) {
      logger.error('Failed to start in-memory MongoDB:', memErr)
      process.exit(1)
    }
  }
}

export async function startServer(port = config.port) {
  await connectDatabase()
  return app.listen(port, () => {
    logger.info(`Server running on port ${port}`)
  })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  startServer()
}

export default app
