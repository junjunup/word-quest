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
  CHAT_CLOSED: 'chat_closed',         // 对话关闭

  // UI 面板事件
  SHOW_LEADERBOARD: 'show_leaderboard',       // 显示排行榜
  SHOW_LEVEL_SELECT: 'show_level_select',     // 显示关卡选择
  SHOW_CHARACTER_SELECT: 'show_character_select', // 显示角色选择
  SHOW_GAME_INTRO: 'show_game_intro',         // 显示游戏介绍
  START_GAME_LEVEL: 'start_game_level',       // Vue通知Phaser启动关卡
  SHOW_BOSS_QUIZ: 'show_boss_quiz',           // 显示Boss答题弹窗
  BOSS_QUIZ_RESULT: 'boss_quiz_result',        // Boss答题结果
  TOGGLE_PAUSE: 'toggle_pause'                 // 切换暂停菜单
}

export default eventBus
