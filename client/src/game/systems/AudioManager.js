/**
 * 音效与背景音乐管理器。
 * 使用 Phaser 内置音频系统播放短音效，并通过 tween 实现 BGM 淡入淡出。
 * 所有音频操作均静默降级，避免资源缺失或浏览器解码失败影响主流程。
 */
class AudioManager {
  constructor() {
    this.scene = null
    this.sounds = {}
    this.bgm = null
    this.currentBgmKey = ''
    this.bgmTween = null
    this.pausedReasons = new Set()
    this.muted = localStorage.getItem('wordquest:muted') === 'true'
    this.volume = this.clampVolume(parseFloat(localStorage.getItem('wordquest:volume') || '0.5'))
    this.bgmVolume = this.clampVolume(parseFloat(localStorage.getItem('wordquest:bgmVolume') || '0.3'))
    this.sfxKeys = ['correct', 'wrong', 'boss_appear', 'boss_defeat', 'combo', 'coin', 'level_complete', 'click']
  }

  /**
   * 初始化当前 Phaser 场景并重建短音效实例。
   * BGM 可能跨场景淡出/切换，不能在 scene 变化时粗暴销毁。
   * @param {Phaser.Scene} scene 当前活动场景。
   */
  init(scene) {
    if (!scene || !scene.sound) return

    if (this.scene !== scene) {
      this.destroySfx()
      this.scene = scene
    } else if (Object.keys(this.sounds).length > 0) {
      return
    }

    for (const key of this.sfxKeys) {
      try {
        if (scene.cache?.audio?.exists(key)) {
          this.sounds[key] = scene.sound.add(key, { volume: this.getEffectiveSfxVolume() })
        }
      } catch (e) {
        // Graceful fallback - 单个音效缺失或创建失败不影响游戏。
      }
    }
  }

  /**
   * 播放短音效。
   * @param {string} key 音效 key。
   */
  play(key) {
    const sound = this.sounds[key]
    if (this.muted || !sound) return
    try {
      sound.setVolume?.(this.getEffectiveSfxVolume())
      sound.play()
    } catch (e) {
      // Graceful fallback - 音效缺失不影响游戏。
    }
  }

  /**
   * 播放或切换背景音乐。
   * @param {string} key BGM key。
   * @param {number} fadeInMs 淡入时长。
   */
  playBGM(key, fadeInMs = 500) {
    if (!key || !this.scene || !this.scene.sound) return

    this.pausedReasons.clear()

    try {
      if (this.currentBgmKey === key && this.bgm) {
        if (this.bgm.isPaused) this.bgm.resume()
        if (!this.bgm.isPlaying) this.bgm.play({ loop: true })
        this.fadeSoundTo(this.bgm, this.getEffectiveBgmVolume(), fadeInMs)
        return
      }

      const previousBgm = this.bgm
      if (previousBgm) {
        this.fadeOutAndDestroy(previousBgm, fadeInMs)
      }

      if (!this.scene.cache?.audio?.exists(key)) {
        this.bgm = null
        this.currentBgmKey = ''
        return
      }

      const nextBgm = this.scene.sound.add(key, { loop: true, volume: 0 })
      this.bgm = nextBgm
      this.currentBgmKey = key
      nextBgm.play({ loop: true, volume: 0 })
      this.fadeSoundTo(nextBgm, this.getEffectiveBgmVolume(), fadeInMs)
    } catch (e) {
      this.bgm = null
      this.currentBgmKey = ''
    }
  }

  /**
   * 停止并销毁当前背景音乐。
   * @param {number} fadeOutMs 淡出时长。
   */
  stopBGM(fadeOutMs = 500) {
    this.pausedReasons.clear()
    const current = this.bgm
    this.bgm = null
    this.currentBgmKey = ''
    if (!current) return
    this.fadeOutAndDestroy(current, fadeOutMs)
  }

  /**
   * 暂停背景音乐。支持 reason 避免 Vue 弹窗与 Phaser 场景重复恢复。
   * @param {number} fadeOutMs 淡出时长。
   * @param {string} reason 暂停原因。
   */
  pauseBGM(fadeOutMs = 300, reason = 'default') {
    if (reason) this.pausedReasons.add(reason)
    if (!this.bgm) return

    try {
      const current = this.bgm
      this.fadeSoundTo(current, 0, fadeOutMs, () => {
        if (this.bgm === current && this.pausedReasons.size > 0 && current.isPlaying && !current.isPaused) {
          current.pause()
        }
      })
    } catch (e) {
      // BGM 暂停失败不影响主流程。
    }
  }

  /**
   * 恢复背景音乐。只有所有暂停原因均解除后才真正恢复。
   * @param {number} fadeInMs 淡入时长。
   * @param {string} reason 暂停原因。
   */
  resumeBGM(fadeInMs = 300, reason = 'default') {
    if (reason) this.pausedReasons.delete(reason)
    if (!this.bgm || this.pausedReasons.size > 0) return

    try {
      if (this.bgm.isPaused) this.bgm.resume()
      if (!this.bgm.isPlaying) this.bgm.play({ loop: true, volume: 0 })
      this.fadeSoundTo(this.bgm, this.getEffectiveBgmVolume(), fadeInMs)
    } catch (e) {
      // BGM 恢复失败不影响主流程。
    }
  }

  /**
   * 切换静音状态，同时作用于 SFX 与 BGM。
   * @returns {boolean} 当前是否静音。
   */
  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem('wordquest:muted', String(this.muted))
    this.applyVolumes()
    return this.muted
  }

  /**
   * 设置短音效音量并持久化。
   * @param {number} value 0-1 音量。
   */
  setVolume(value) {
    this.volume = this.clampVolume(value)
    localStorage.setItem('wordquest:volume', String(this.volume))
    Object.values(this.sounds).forEach(sound => {
      try { sound.setVolume?.(this.getEffectiveSfxVolume()) } catch { /* ignore */ }
    })
  }

  /**
   * 设置背景音乐音量并持久化。
   * @param {number} value 0-1 音量。
   */
  setBgmVolume(value) {
    this.bgmVolume = this.clampVolume(value)
    localStorage.setItem('wordquest:bgmVolume', String(this.bgmVolume))
    if (this.bgm && this.pausedReasons.size === 0) {
      this.fadeSoundTo(this.bgm, this.getEffectiveBgmVolume(), 120)
    }
  }

  /**
   * 销毁所有音效实例。保留方法名兼容旧调用。
   */
  destroy() {
    this.destroySfx()
    this.stopBGM(0)
    this.scene = null
  }

  destroySfx() {
    Object.values(this.sounds).forEach(sound => {
      try { if (sound?.destroy) sound.destroy() } catch { /* ignore */ }
    })
    this.sounds = {}
  }

  applyVolumes() {
    Object.values(this.sounds).forEach(sound => {
      try { sound.setVolume?.(this.getEffectiveSfxVolume()) } catch { /* ignore */ }
    })
    if (this.bgm) {
      const targetVolume = this.pausedReasons.size > 0 ? 0 : this.getEffectiveBgmVolume()
      this.fadeSoundTo(this.bgm, targetVolume, 120)
    }
  }

  fadeSoundTo(sound, volume, duration, onComplete) {
    if (!sound) return
    const targetVolume = this.clampVolume(volume)
    const safeDuration = Math.max(0, Number(duration) || 0)

    try {
      if (this.bgmTween?.stop && sound === this.bgm) {
        this.bgmTween.stop()
        this.bgmTween = null
      }

      if (!this.canTweenSound(sound) || safeDuration === 0) {
        sound.setVolume?.(targetVolume)
        if (onComplete) onComplete()
        return
      }

      const tween = this.scene.tweens.add({
        targets: sound,
        volume: targetVolume,
        duration: safeDuration,
        ease: 'Linear',
        onComplete: () => {
          if (sound === this.bgm) this.bgmTween = null
          if (onComplete) onComplete()
        }
      })

      if (sound === this.bgm) this.bgmTween = tween
    } catch (e) {
      try { sound.setVolume?.(targetVolume) } catch { /* ignore */ }
      if (onComplete) onComplete()
    }
  }

  fadeOutAndDestroy(sound, duration) {
    if (!sound) return
    if (!this.canTweenSound(sound) || duration <= 0) {
      this.stopAndDestroySound(sound)
      return
    }
    this.fadeSoundTo(sound, 0, duration, () => {
      this.stopAndDestroySound(sound)
    })
  }

  canTweenSound(sound) {
    return Boolean(sound && this.scene?.tweens && (!sound.manager || sound.manager === this.scene.sound))
  }

  stopAndDestroySound(sound) {
    try {
      if (sound?.isPlaying || sound?.isPaused) sound.stop()
      if (sound?.destroy) sound.destroy()
    } catch (e) {
      // 旧 BGM 销毁失败不影响新 BGM 播放。
    }
  }

  getEffectiveSfxVolume() {
    return this.muted ? 0 : this.volume
  }

  getEffectiveBgmVolume() {
    return this.muted ? 0 : this.bgmVolume
  }

  clampVolume(value) {
    const numericValue = Number.isFinite(value) ? value : 0
    return Math.min(1, Math.max(0, numericValue))
  }
}

export default new AudioManager()
