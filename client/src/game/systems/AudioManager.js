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
}

export default new AudioManager()
