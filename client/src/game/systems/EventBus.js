/**
 * 事件总线 - Phaser ↔ Vue 通信桥梁
 * 使用自定义事件实现游戏引擎与Vue组件的通信
 */

class EventBus {
  constructor() {
    this.listeners = new Map()
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return
    if (callback) {
      const cbs = this.listeners.get(event)
      this.listeners.set(event, cbs.filter(cb => cb !== callback))
    } else {
      this.listeners.delete(event)
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return
    this.listeners.get(event).forEach(cb => cb(data))
  }

  once(event, callback) {
    const wrapper = (data) => {
      callback(data)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  clear() {
    this.listeners.clear()
  }
}

// 全局单例
const eventBus = new EventBus()

// 事件常量
export const EVENTS = {
  // 游戏 → Vue
  SHOW_QUIZ: 'show_quiz',             // 显示答题弹窗
  SHOW_CHAT: 'show_chat',             // 显示NPC对话
  LEVEL_COMPLETE: 'level_complete',     // 关卡完成
  GAME_OVER: 'game_over',             // 游戏结束(生命耗尽)
  UPDATE_HUD: 'update_hud',           // 更新HUD信息
  SHOW_ACHIEVEMENT: 'show_achievement', // 显示成就弹窗

  // Vue → 游戏
  QUIZ_ANSWERED: 'quiz_answered',      // 答题结果
  RESUME_GAME: 'resume_game',         // 恢复游戏
  START_LEVEL: 'start_level',         // 开始关卡
  CHAT_CLOSED: 'chat_closed'          // 对话关闭
}

export default eventBus
