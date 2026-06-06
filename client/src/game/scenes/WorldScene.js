import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'
import { failedAssetKeys } from './BootScene'
import { CHARACTER_PRESETS } from '../data/characters'
import MonsterAI from '../entities/MonsterAI'
import audioManager from '../systems/AudioManager'
import { CHAPTER_THEMES } from '../config/gameConstants'

/**
 * 主世界地图场景 - 田园像素风
 * 玩家在田园地图中移动，遇到怪物触发答题战斗
 */
export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' })
    this.player = null
    this.cursors = null
    this.monsters = null
    this.monsterAIs = []
    this.npcs = null
    this.doors = null
    this.hudTexts = {}
    this.isPaused = false
    this.playerDirection = 'down'
    this.invincible = false
    this.virtualDirection = { up: false, down: false, left: false, right: false }
    this.timeScale = 1.0
    this.targetLocked = false
    this.lockedTarget = null
    this.inputBuffer = ''
  }

  init(data) {
    this.continueGame = data?.continueGame || false
    this.chapter = data?.chapter || levelManager.currentChapter || 1
    this.level = data?.level || levelManager.currentLevel || 1
    this.difficulty = data?.difficulty || 'normal'
    this.isTutorial = false
    this.virtualDirection = { up: false, down: false, left: false, right: false }
  }

  create() {
    const { width, height } = this.cameras.main
    this.isPaused = false
    this.invincible = false
    this.timeScale = 1.0
    this.targetLocked = false
    this.lockedTarget = null
    this.inputBuffer = ''

    this.input.enabled = true

    this.createPastoralMap()
    this.createPlayer()

    const wordCount = levelManager.getTotalWords()
    const baseCount = wordCount > 0 ? Math.min(wordCount, 10) : Math.min(6 + this.level, 10)
    this.monsterCount = levelManager.getMonsterCount(baseCount)
    this.createMonsters()

    this.createNPC()
    this.createHUD()

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
    })
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.eKey.on('down', () => { if (!this.isPaused && !this.targetLocked) this._tryLockTarget() })
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => {
      if (this.targetLocked) this._cancelLock()
      else if (!this.isPaused) eventBus.emit(EVENTS.TOGGLE_PAUSE)
    })

    this.physics.add.overlap(this.player, this.monsters, this._onMonsterHit, null, this)
    this.physics.add.overlap(this.player, this.npcs, this.onNPCInteract, null, this)
    if (this.walls) this.physics.add.collider(this.player, this.walls)

    this.events.once('shutdown', this.shutdown, this)

    audioManager.init(this)
    audioManager.playBGM('bgm_game')

    eventBus.emit(EVENTS.START_LEVEL, {
      chapter: this.chapter, level: this.level,
      continueGame: this.continueGame, difficulty: this.difficulty, isTutorial: false
    })
    eventBus.emit(EVENTS.UPDATE_HUD, {
      lives: levelManager.lives, maxLives: levelManager.difficultyConfig.lives,
      score: levelManager.score, combo: levelManager.combo,
      chapter: this.chapter, level: this.level, progress: levelManager.getProgress()
    })
  }

  /**
   * 创建Boss
   */
  /** 怪物碰到玩家 */
  _onMonsterHit(player, monster) {
    if (this.invincible || !monster.active) return
    const idx = monster.getData('index')
    if (idx == null) return
    const ai = this.monsterAIs[idx]
    if (!ai || ai.isDefeated) return
    ai.onHitPlayer(player, (dmg) => {
      const result = levelManager.loseLife()
      this._startInvincibility(1500)
      if (this.targetLocked) this._cancelLock()
      if (result === 'game_over') {
        audioManager.stopBGM(0)
        const rr = this.game.scene.getScene('ResultScene')
        if (rr && rr.scene.isSleeping()) rr.scene.wake()
        this.game.scene.start('ResultScene', levelManager.getLevelResult())
      }
    })
  }

  _startInvincibility(duration = 1500) {
    if (this.invincible) return
    this.invincible = true
    this.tweens.add({
      targets: this.player, alpha: { from: 0.3, to: 1 },
      duration: 150, yoyo: true, repeat: Math.floor(duration / 300),
      onComplete: () => { if (this.player?.active) { this.player.setAlpha(1); this.invincible = false } }
    })
  }

  _tryLockTarget() {
    if (this.targetLocked || !this.player) return
    let closest = null, closestDist = 150
    const children = this.monsters.getChildren()
    for (let i = 0; i < children.length; i++) {
      const m = children[i]; const ai = this.monsterAIs[i]
      if (!m.active || ai?.isDefeated) continue
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y)
      if (dist < closestDist) { closestDist = dist; closest = { monster: m, ai, idx: i } }
    }
    if (!closest) return
    this.targetLocked = true; this.lockedTarget = closest
    this.timeScale = 0.2; this.inputBuffer = ''; this.isPaused = true
    audioManager.pauseBGM(200)
    this.monsterLabels[closest.idx]?.setText('🎯')
  }

  _cancelLock() {
    if (!this.targetLocked) return
    if (this.lockedTarget && this.monsterLabels[this.lockedTarget.idx])
      this.monsterLabels[this.lockedTarget.idx].setText('❓')
    this.targetLocked = false; this.lockedTarget = null
    this.timeScale = 1.0; this.inputBuffer = ''; this.isPaused = false
    audioManager.resumeBGM(200)
  }

  _killMonster(idx) {
    const monster = this.monsters.getChildren()[idx]
    const ai = this.monsterAIs[idx]
    if (!monster || !ai || ai.isDefeated) return
    ai.defeat()
    this.tweens.add({ targets: monster, alpha: 0, scale: 0, y: monster.y - 30, duration: 400, ease: 'Back.easeIn', onComplete: () => monster.destroy() })
    if (this.monsterLabels[idx]) { this.monsterLabels[idx].destroy(); this.monsterLabels[idx] = null }
    this.spawnCoinEffect(monster.x, monster.y, 100)
    audioManager.play('correct')
    levelManager.score += 100
    eventBus.emit(EVENTS.UPDATE_HUD, { score: levelManager.score, lives: levelManager.lives })
  }


  update(time, delta) {
    if (!this.player) return

    // Update monster AI
    if (this.monsterAIs && this.monsters) {
      const children = this.monsters.getChildren()
      for (let i = 0; i < this.monsterAIs.length; i++) {
        this.monsterAIs[i].update(this.player, delta, this.timeScale)
      }
    }

    // Player movement (disabled during lock)
    if (!this.isPaused && !this.targetLocked) {
      const speed = 160 * this.timeScale
      let vx = 0, vy = 0, moving = false, direction = this.playerDirection
      const virtual = this.virtualDirection || {}
      if (this.cursors.left.isDown || this.wasd.left.isDown || virtual.left) { vx = -speed; direction = 'left'; moving = true }
      else if (this.cursors.right.isDown || this.wasd.right.isDown || virtual.right) { vx = speed; direction = 'right'; moving = true }
      if (this.cursors.up.isDown || this.wasd.up.isDown || virtual.up) { vy = -speed; direction = 'up'; moving = true }
      else if (this.cursors.down.isDown || this.wasd.down.isDown || virtual.down) { vy = speed; direction = 'down'; moving = true }
      if (vx !== 0 && vy !== 0) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2 }
      this.player.setVelocity(vx, vy)
      if (this.hasPlayerSheet) {
        if (moving) { const wa = 'player_walk_' + direction; if (this.anims.exists(wa)) this.player.play(wa) }
        else { const ia = 'player_idle_' + this.playerDirection; if (this.anims.exists(ia)) this.player.play(ia) }
      }
      if (moving) this.playerDirection = direction
    } else {
      this.player.setVelocity(0, 0)
    }

    if (this.playerNameText) this.playerNameText.setPosition(this.player.x, this.player.y - 30)

    // Update monster labels
    if (this.monsterLabels) {
      const children = this.monsters.getChildren()
      for (const monster of children) {
        if (!monster.active) continue
        const idx = monster.getData('index')
        const label = this.monsterLabels[idx]
        if (label?.active) label.setPosition(monster.x, monster.y - 28)
      }
    }
  }

  shutdown() {
    if (this.escKey) this.escKey.removeAllListeners()
    this.input.enabled = false
    this.tweens.killAll()
    if (this.monsterLabels) {
      this.monsterLabels.forEach(label => { if (label?.active) label.destroy() })
      this.monsterLabels = []
    }
    this.monsterAIs = []
    if (this.mapContainer) { this.mapContainer.destroy(true); this.mapContainer = null }
    if (this.decoContainer) { this.decoContainer.destroy(true); this.decoContainer = null }
    this.monsters = null; this.npcs = null; this.walls = null
    this.player = null; this.playerNameText = null; this.hudTexts = {}
    this.children.removeAll(true)
  }
}
