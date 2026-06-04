/**
 * 离线队列 — 网络失败时暂存 API 调用，恢复后自动重试
 *
 * 使用 localStorage 持久化，页面刷新不丢失。
 */

const STORAGE_KEY = 'wordquest:offline-queue'
const MAX_QUEUE_SIZE = 200
const RETRY_DELAY_MS = 5000
const MAX_RETRIES = 3

let flushTimer = null
let flushing = false

/**
 * 获取当前队列
 */
export function getQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 保存队列
 */
function saveQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)))
  } catch {
    // localStorage 满 → 丢弃最旧的
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-50)))
    } catch { /* 静默 */ }
  }
}

/**
 * 将失败的 API 调用加入离线队列
 *
 * @param {string} type — 操作类型 ('submitQuizRecord' | 'updateWordMastery')
 * @param {object} payload — API 请求体
 */
export function enqueue(type, payload) {
  const queue = getQueue()
  queue.push({
    type,
    payload,
    timestamp: Date.now(),
    retries: 0
  })
  saveQueue(queue)

  // 延迟重试（等网络恢复）
  scheduleFlush()
}

/**
 * 批量重试队列中的请求
 */
export async function flushQueue(submitQuizRecord, updateWordMastery) {
  if (flushing) return
  const queue = getQueue()
  if (queue.length === 0) return

  flushing = true

  const handlers = { submitQuizRecord, updateWordMastery }
  const failed = []

  for (const item of queue) {
    const handler = handlers[item.type]
    if (!handler) continue

    try {
      await handler(item.payload)
      // 成功 → 不加入 failed
    } catch (e) {
      // 仍失败 → 增加重试计数
      if (item.retries < MAX_RETRIES) {
        failed.push({ ...item, retries: item.retries + 1 })
      }
      // 超过最大重试次数 → 丢弃
    }
  }

  saveQueue(failed)
  flushing = false

  if (failed.length > 0) {
    scheduleFlush()
  }
}

/**
 * 获取队列大小
 */
export function getQueueSize() {
  return getQueue().length
}

/**
 * 清空队列
 */
export function clearQueue() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * 延迟重试
 */
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    // 由调用方触发 flush
  }, RETRY_DELAY_MS)
}

// 监听网络恢复事件
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // 网络恢复 → 触发重试（通过自定义事件通知调用方）
    window.dispatchEvent(new CustomEvent('wordquest:online'))
  })
}
