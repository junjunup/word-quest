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
    this.npcs = null
    this.doors = null
    this.monsterAIs = []
    this.hudTexts = {}
    this.isPaused = false
    this.playerDirection = 'down'
    this.invincible = false
    this.timeScale = 1.0
    this.targetLocked = false
    this.lockedTarget = null
    this.inputBuffer = ''
    this.virtualDirection = { up: false, down: false, left: false, right: false }
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
    this.encounterCooldown = false
    this.npcCooldown = false
    this.invincible = false
    this.isGameOverTransitioning = false
    this.gameOverTransitionTimer = null

    // 显式启用输入 —— shutdown() 会设 input.enabled = false，
    // Phaser 场景重启时不会自动重置该状态，导致键盘/鼠标完全失效
    this.input.enabled = true

    // 生成田园地图
    this.createPastoralMap()

    // 创建玩家（使用 Sprout Lands 角色）
    this.createPlayer()

    // 创建怪物（使用小鸡 sprite）
    const wordCount = levelManager.getTotalWords()
    const baseCount = wordCount > 0 ? Math.min(wordCount, 10) : Math.min(6 + this.level, 10)
    this.monsterCount = levelManager.getMonsterCount(baseCount)
    this.createMonsters()
    this.createNPC()
    this.createHUD()
    this.createHUD()

    // 输入控制
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    })

    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.eKey.on('down', () => { if (!this.isPaused && !this.targetLocked) this._tryLockTarget() })
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => {
      if (this.targetLocked) this._cancelLock()
      else if (!this.isPaused) eventBus.emit(EVENTS.TOGGLE_PAUSE)
    })

    // 碰撞检测
    this.physics.add.overlap(this.player, this.monsters, this._onMonsterHit, null, this)
    this.physics.add.overlap(this.player, this.npcs, this.onNPCInteract, null, this)
    // 玩家与围墙碰撞（walls 在 createPastoralMap 中创建）
    if (this.walls) {
      this.physics.add.collider(this.player, this.walls)
    }

    // Quiz events removed - using direct combat
    // 监听Vue事件
    // Quiz events removed - using direct combat system

    // 注册 Phaser 场景 shutdown 事件，确保离开时清理监听器
    this.events.once('shutdown', this.shutdown, this)

    // 初始化音效系统并播放关卡背景音乐
    audioManager.init(this)
    audioManager.playBGM('bgm_game')

    // 通知 Vue 层当前关卡信息
    eventBus.emit(EVENTS.START_LEVEL, {
      chapter: this.chapter,
      level: this.level,
      continueGame: this.continueGame,
      difficulty: this.difficulty,
      isTutorial: this.isTutorial
    })

    // 发送初始HUD数据
    eventBus.emit(EVENTS.UPDATE_HUD, {
      lives: levelManager.lives,
      maxLives: levelManager.difficultyConfig.lives,
      score: levelManager.score,
      combo: levelManager.combo,
      chapter: this.chapter,
      level: this.level,
      progress: levelManager.getProgress()
    })
  }

  /**
   * 创建Boss
   */

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
    this.tweens.add({ targets: this.player, alpha: { from: 0.3, to: 1 }, duration: 150, yoyo: true, repeat: Math.floor(duration / 300), onComplete: () => { if (this.player?.active) { this.player.setAlpha(1); this.invincible = false } } })
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
    if (this.lockedTarget && this.monsterLabels[this.lockedTarget.idx]) this.monsterLabels[this.lockedTarget.idx].setText('❓')
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

  createMonsters() {
    this.monsters = this.physics.add.group()
    this.monsterAIs = []
    this.monsterLabels = []
    const mapW = 30 * 32, mapH = 20 * 32
    const isValid = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasChicken = isValid('chicken_sheet')
    const positions = []
    for (let i = 0; i < this.monsterCount; i++) {
      let x, y, attempts = 0
      do {
        x = Phaser.Math.Between(120, mapW - 120)
        y = Phaser.Math.Between(100, mapH - 100)
        const tooClose = Phaser.Math.Distance.Between(x, y, 80, 300) < 120
          || Phaser.Math.Distance.Between(x, y, 700, 300) < 120
          || positions.some(p => Phaser.Math.Distance.Between(x, y, p.x, p.y) < 80)
        if (!tooClose || attempts++ > 50) { positions.push({ x, y }); break }
      } while (true)
    }
    for (let i = 0; i < this.monsterCount; i++) {
      const isElite = i === 0 && this.level > 3
      const pos = positions[i]
      let monster
      if (hasChicken) {
        monster = this.monsters.create(pos.x, pos.y, 'chicken_sheet', 0)
        monster.setScale(isElite ? 4.5 : 3.5)
        monster.body.setSize(10, 10); monster.body.setOffset(3, 4)
        if (this.anims.exists('chicken_idle')) monster.play('chicken_idle')
      } else {
        monster = this.monsters.create(pos.x, pos.y, 'monster')
        monster.setScale(isElite ? 1.5 : 1.2)
        monster.body.setSize(20, 20); monster.body.setOffset(6, 6)
      }
      monster.setData('index', i)
      monster.setImmovable(false)
      monster.setDepth(5)
      const patrolPoints = []
      for (let p = 0; p < 4; p++) {
        const angle = (p / 4) * Math.PI * 2 + Math.random()
        const r = Phaser.Math.Between(40, 100)
        patrolPoints.push({ x: pos.x + Math.cos(angle) * r, y: pos.y + Math.sin(angle) * r })
      }
      const ai = new MonsterAI(monster, { patrolSpeed: isElite ? 40 : 30, pursueSpeed: isElite ? 100 : 80, perceptionRange: isElite ? 200 : 150, attackDamage: isElite ? 2 : 1, patrolPoints })
      this.monsterAIs.push(ai)
      const label = this.add.text(pos.x, pos.y - 28, isElite ? '👾' : '❓', { fontSize: '16px', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(6)
      this.monsterLabels.push(label)
    }
  }

  update() {
    if (this.isPaused || !this.player) return

    const speed = 160
    let vx = 0
    let vy = 0
    let moving = false
    let direction = this.playerDirection

    const virtual = this.virtualDirection || {}

    if (this.cursors.left.isDown || this.wasd.left.isDown || virtual.left) { vx = -speed; direction = 'left'; moving = true }
    else if (this.cursors.right.isDown || this.wasd.right.isDown || virtual.right) { vx = speed; direction = 'right'; moving = true }

    if (this.cursors.up.isDown || this.wasd.up.isDown || virtual.up) { vy = -speed; direction = 'up'; moving = true }
    else if (this.cursors.down.isDown || this.wasd.down.isDown || virtual.down) { vy = speed; direction = 'down'; moving = true }

    if (vx !== 0 && vy !== 0) {
      const factor = Math.SQRT1_2
      vx *= factor
      vy *= factor
    }

    this.player.setVelocity(vx, vy)

    if (this.hasPlayerSheet) {
      if (moving) {
        const walkAnim = `player_walk_${direction}`
        if (this.anims.exists(walkAnim) && this.player.anims.currentAnim?.key !== walkAnim) {
          this.player.play(walkAnim)
        }
      } else {
        const idleAnim = `player_idle_${this.playerDirection}`
        if (this.anims.exists(idleAnim) && this.player.anims.currentAnim?.key !== idleAnim) {
          this.player.play(idleAnim)
        }
      }
    }

    if (moving) {
      this.playerDirection = direction
    }

    if (this.playerNameText) {
      this.playerNameText.setPosition(this.player.x, this.player.y - 30)
    }

    // 更新怪物标签位置（跟随浮动动画）
    if (this.monsterLabels) {
      const children = this.monsters.getChildren()
      for (const monster of children) {
        if (!monster.active || monster.getData('defeated')) continue
        const idx = monster.getData('index')
        const label = this.monsterLabels[idx]
        if (label && label.active) {
          label.setPosition(monster.x, monster.y - 28)
        }
      }
    }

    // Update boss
    if (this.boss && !this.boss.defeated) {
      this.boss.update()
    }
  }

  shutdown() {
    // 1. 事件总线清理 — 防止回调在已销毁场景中触发
    eventBus.off(EVENTS.QUIZ_ANSWERED, this.boundOnQuizAnswered)
    eventBus.off(EVENTS.RESUME_GAME, this.boundOnResumeGame)
    eventBus.off(EVENTS.CHAT_CLOSED, this.boundOnChatClosed)
    eventBus.off(EVENTS.GAME_OVER, this.boundOnGameOver)
    eventBus.off(EVENTS.BOSS_QUIZ_RESULT, this.boundOnBossQuizResult)

    // 2. 清理原生定时器（避免场景销毁后仍触发跳转）
    if (this.gameOverTransitionTimer) { clearTimeout(this.gameOverTransitionTimer); this.gameOverTransitionTimer = null }
    if (this._completeTimer) { clearTimeout(this._completeTimer); this._completeTimer = null }

    // 3. 清理 ESC 键监听
    if (this.escKey && this.boundOnEscDown) {
      this.escKey.off('down', this.boundOnEscDown)
    }

    // 4. 禁用输入 — 防止场景切换时幽灵点击穿透
    this.input.enabled = false

    // 5. Kill all tweens — 防止回调在 shutdown 后触发
    this.tweens.killAll()

    // 6. 清理怪物标签
    if (this.monsterLabels) {
      this.monsterLabels.forEach(label => { if (label?.active) label.destroy() })
      this.monsterLabels = []
    }

    // 7. 显式销毁容器 — 必须在设为 null 之前 destroy，确保内部子对象被递归清理
    if (this.mapContainer) { this.mapContainer.destroy(true); this.mapContainer = null }
    if (this.decoContainer) { this.decoContainer.destroy(true); this.decoContainer = null }

    // 8. 无条件清理 Boss（无论是否已被击败）
    if (this.boss) {
      this.boss.defeated = true  // 阻止后续 defeat 动画
      this.boss.cleanupVisuals()
      if (this.boss.active) this.boss.destroy()
      this.boss = null
    }

    // 9. 清理其余引用
    this.monsters = null
    this.npcs = null
    this.walls = null
    this.player = null
    this.playerNameText = null
    this.hudTexts = {}

    // 10. 销毁所有 Display Object — 最终保险，清除场景显示列表中的所有残余对象
    //    （在容器已显式销毁后执行，确保万无一失）
    this.children.removeAll(true)
  }
}
