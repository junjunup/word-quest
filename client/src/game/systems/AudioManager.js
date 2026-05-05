/**
 * 音效管理器
 * 使用 Phaser 内置音频系统播放音效
 */
import eventBus, { EVENTS } from './EventBus'

class AudioManager {
  constructor() {
    this.scene = null
    this.sounds = {}
    this.muted = localStorage.getItem('wordquest:muted') === 'true'
    this.volume = parseFloat(localStorage.getItem('wordquest:volume') || '0.5')
  }

  init(scene) {
    // 如果 scene 没变且 sounds 已初始化，跳过重复创建
    if (this.scene === scene && Object.keys(this.sounds).length > 0) return

    // scene 变了（重新进入关卡），先清理旧 sound 对象
    this.destroy()

    this.scene = scene
    const keys = ['correct', 'wrong', 'boss_appear', 'boss_defeat', 'combo', 'coin', 'level_complete', 'click']
    for (const key of keys) {
      if (scene.cache.audio.exists(key)) {
        this.sounds[key] = scene.sound.add(key, { volume: this.volume })
      }
    }
  }

  play(key) {
    if (this.muted || !this.sounds[key]) return
    try {
      this.sounds[key].play()
    } catch (e) {
      // Graceful fallback - 音效缺失不影响游戏
    }
  }

  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem('wordquest:muted', String(this.muted))
    return this.muted
  }

  setVolume(v) {
    this.volume = v
    localStorage.setItem('wordquest:volume', String(v))
    Object.values(this.sounds).forEach(s => { s.volume = v })
  }

  destroy() {
    // 销毁已创建的 sound 对象，防止内存泄漏
    Object.values(this.sounds).forEach(s => {
      try { if (s.destroy) s.destroy() } catch { /* ignore */ }
    })
    this.sounds = {}
    this.scene = null
  }
}

export default new AudioManager()
