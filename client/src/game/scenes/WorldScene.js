import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'
import { failedAssetKeys } from './BootScene'
import { CHARACTER_PRESETS } from '../data/characters'
import MonsterAI from '../entities/MonsterAI'
import { createBoss, getBossTypeForLevel } from '../entities/BossFactory'
import Chest from '../entities/Chest'
import ExtractionPoint from '../entities/ExtractionPoint'
import inventory from '../systems/Inventory'
import audioManager from '../systems/AudioManager'
import { CHAPTER_MONSTER_CONFIG, MONSTER_TYPES, BOSS_SPAWN } from '../config/gameConstants'
import { generatePastoralMap } from '../systems/WorldMap'
import { createCombatSystem } from '../systems/CombatSystem'

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
    this.monsterAIs = {}
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
    // Boss 相关状态
    this.boss = null
    this.bossGroup = null
    this._bossQuizActive = false
    this._onBossQuizResult = null
  }

  init(data) {
    this.continueGame = data?.continueGame || false
    this.chapter = data?.chapter || levelManager.currentChapter || 1
    this.level = data?.level || levelManager.currentLevel || 1
    this.difficulty = data?.difficulty || 'normal'
    this.isTutorial = false
    this.virtualDirection = { up: false, down: false, left: false, right: false }
    // 装备与祝福：优先 PreparationScene 传参，否则用 Inventory 持久化的上次选择
    this.weaponId = data?.weaponId || inventory.getEquippedWeapon()
    this.armorId = data?.armorId || inventory.getEquippedArmor()
    this.blessingId = data?.blessingId || null
    this._firstHitFree = this.blessingId === 'guard'
  }

  create() {
    const { width, height } = this.cameras.main
    this.isPaused = false
    this.invincible = false
    this.isDead = false
    this.timeScale = 1.0
    this.targetLocked = false
    this.lockedTarget = null
    this.inputBuffer = ''

    // 初始化战斗系统
    this._combat = createCombatSystem(this)

    this.input.enabled = true
    // 强制 Canvas 获取焦点，确保键盘事件能触发
    this.game.canvas.focus?.()
    // 防御：清除上次可能残留的拼写输入 DOM
    const staleInput = document.getElementById('wordquest-spell-input')
    if (staleInput) staleInput.remove()
    // Apply armor HP bonus (using selected armor from PreparationScene)
    const armors = inventory.getArmors()
    const activeArmor = armors.find(a => a.id === this.armorId) || { hpBonus: 1 }
    const armorHpBonus = (activeArmor.hpBonus || 1) - 1  // base armor gives +0 extra
    levelManager.lives += armorHpBonus
    levelManager.difficultyConfig = { ...levelManager.difficultyConfig, lives: levelManager.difficultyConfig.lives + armorHpBonus }
    // Apply blessing: +2 HP
    if (this.blessingId === 'health') {
      levelManager.lives += 2
      levelManager.difficultyConfig.lives += 2
    }
    // Ensure ResultScene is stopped when entering a new level (belt-and-suspenders)
    const rs = this.game.scene.getScene('ResultScene')
    if (rs && rs.scene.isActive()) rs.scene.stop()
    this.createPastoralMap()
    this.createPlayer()
    const wordCount = levelManager.getTotalWords()
    const baseCount = wordCount > 0 ? Math.min(wordCount, 10) : Math.min(6 + this.level, 10)
    this.monsterCount = levelManager.getMonsterCount(baseCount)
    this.createMonsters()
    this.createBoss()
    this.createNPC()
    this.createHUD()

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
    })
    // Chests: 2-3 on the map
    this.chests = []
    const chestPositions = [
      { x: 400, y: 400 }, { x: 800, y: 500 }, { x: 600, y: 700 }
    ]
    for (const pos of chestPositions) {
      this.chests.push(new Chest(this, pos.x, pos.y, Phaser.Math.Between(30, 80)))
    }
    // Extraction point: far from spawn
    this.extractionPoint = new ExtractionPoint(this, 1100, 800)

    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.eKey.on('down', () => {
      if (this.isPaused || this.isDead) return
      // Check chest interaction first
      for (const chest of this.chests) {
        if (chest.isPlayerNear(this.player)) {
          const baseGold = chest.open(inventory)
          let displayGold = baseGold
          // 财富祝福：宝箱金币 1.5x
          if (this.blessingId === 'wealth' && baseGold > 0) {
            const bonusGold = Math.floor(baseGold * 0.5)
            inventory.addGold(bonusGold)
            displayGold = baseGold + bonusGold
          }
          if (displayGold > 0) {
            this._showFloatingText(this.player.x, this.player.y - 20, '+' + displayGold + ' 🪙')
            if (this._goldText) this._goldText.setText('🪙 ' + inventory.getGold())
            eventBus.emit(EVENTS.UPDATE_HUD, { score: levelManager.score, lives: levelManager.lives })
          }
          return
        }
      }
      // Check extraction
      if (this.extractionPoint && this.extractionPoint.isPlayerNear(this.player)) {
        this._doExtraction()
        return
      }
      // Otherwise try locking a monster
      if (!this.targetLocked) this._tryLockTarget()
    })

    // Q key: use health potion
    this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    this.qKey.on('down', () => {
      const potion = inventory.getConsumables().find(c => c.id === 'health_potion' && c.qty > 0)
      if (potion && levelManager.lives < levelManager.difficultyConfig.lives) {
        levelManager.lives = Math.min(levelManager.lives + potion.value, levelManager.difficultyConfig.lives)
        inventory.data.consumables.find(c => c.id === 'health_potion').qty--
        inventory._save()
        eventBus.emit(EVENTS.UPDATE_HUD, { lives: levelManager.lives })
        this._showFloatingText(this.player.x, this.player.y - 20, '+' + potion.value + ' ❤️')
      }
    })
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => {
      if (this.targetLocked) this._cancelLock()
      else if (!this.isPaused) eventBus.emit(EVENTS.TOGGLE_PAUSE)
    })

    // 弹幕组（远程怪物发射的子弹）
    this.projectiles = this.physics.add.group({ runChildUpdate: false })
    this._activeProjectiles = []
    // AOE 区域列表
    this._activeAOEs = []

    this.physics.add.overlap(this.player, this.monsters, this._onMonsterHit, null, this)
    this.physics.add.overlap(this.player, this.projectiles, this._onProjectileHit, null, this)
    this.physics.add.overlap(this.player, this.npcs, this.onNPCInteract, null, this)
    if (this.walls) this.physics.add.collider(this.player, this.walls)
    if (this.bossGroup) {
      this.physics.add.overlap(this.player, this.bossGroup, this._onBossCollide, null, this)
      if (this.walls) this.physics.add.collider(this.bossGroup, this.walls)
    }

    // Boss quiz result listener
    this._onBossQuizResult = (result) => this._handleBossQuizResult(result)
    eventBus.on(EVENTS.BOSS_QUIZ_RESULT, this._onBossQuizResult)

    // Register combat key handler once (not lazily)
    this._keyHandler = (event) => {
      if (!this.targetLocked || this.isDead) return
      // 拼写模式：DOM input 处理所有输入，这里只处理 Escape
      if (this.lockedTarget?.qType === 'spell_hint') {
        if (event.key === 'Escape') this._cancelLock()
        return
      }
      if (event.key === 'Escape') { this._cancelLock(); return }
      const num = parseInt(event.key)
      if (num >= 1 && num <= 4 && this.lockedTarget) {
        if (num === this.lockedTarget.correctIdx) {
          levelManager.correctCount++
          audioManager.play('correct')
          const wasLast = Object.keys(this.monsterAIs).length === 1
          // Weapon effects
          let bonusGold = 0
          if (this.weaponId === 'sword') {
            levelManager.score += 20
          }
          if (this.weaponId === 'hammer' && Math.random() < 0.5) {
            bonusGold = 100
          }
          if (this.weaponId === 'staff' && Math.random() < 0.3) {
            this._combat.freezeRandomMonster(this.lockedTarget.idx)
          }
          this._combat.killMonster(this.lockedTarget.idx, bonusGold)
          if (!wasLast) this._cancelLock()
        } else {
          levelManager.wrongCount++
          audioManager.play('wrong')
          const idx = num - 1
          if (this._choiceOpts?.[idx]) {
            const { bg, x, y } = this._choiceOpts[idx]
            bg.clear(); bg.fillStyle(0x8b0000, 0.85)
            bg.fillRoundedRect(x - 100, y - 18, 200, 36, 6)
            bg.lineStyle(2, 0xff0000)
            bg.strokeRoundedRect(x - 100, y - 18, 200, 36, 6)
          }
          this._flashTimer = window.setTimeout(() => {
            this._flashTimer = null
            this._cancelLock()
          }, 300)
        }
      }
    }
    this.input.keyboard.on('keydown', this._keyHandler)

    this.events.once('shutdown', this.shutdown, this)

    audioManager.init(this)
    audioManager.stopBGM(0)
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

  /** 创建田园地图 — 委托 WorldMap 模块 */
  createPastoralMap() {
    generatePastoralMap(this, { chapter: this.chapter })
  }

  createPlayer() {
    this.hasPlayerSheet = this.textures.exists('player_sheet') && !failedAssetKeys.has('player_sheet')

    if (this.hasPlayerSheet) {
      this.player = this.physics.add.sprite(80, 300, 'player_sheet', 0)
      this.player.setScale(1.8)
      this.player.body.setSize(16, 16)
      this.player.body.setOffset(16, 24)
    } else {
      this.player = this.physics.add.sprite(80, 300, 'player')
      this.player.setScale(1.2)
    }

    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)

    // Apply character tint
    const charIndex = this.registry.get('characterSpriteIndex') || 0
    const preset = CHARACTER_PRESETS[charIndex]
    if (preset && preset.tint) {
      this.player.setTint(preset.tint)
    }
    const charName = preset ? preset.name : '勇者'

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    if (this.hasPlayerSheet && this.anims.exists('player_idle_down')) {
      this.player.play('player_idle_down')
    }

    this.playerNameText = this.add.text(0, 0, `🌿 ${charName}`, {
      fontSize: '10px',
      fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#5b8c3e',
      align: 'center',
      stroke: '#fff',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(11)
  }

  _onMonsterHit(player, monster) {
    if (this.isDead || this._bossQuizActive || this.invincible || !monster.active) return
    // 守护祝福：首次受击免伤
    if (this._firstHitFree) {
      this._firstHitFree = false
      this._showFloatingText(player.x, player.y - 20, '🛡️ 免伤')
      this._startInvincibility(1500)
      return
    }
    const idx = monster.getData("index")
    if (idx == null) return
    const ai = this.monsterAIs[idx]
    if (!ai || ai.isDefeated) return
    ai.onHitPlayer(player, (dmg) => {
      const result = levelManager.loseLife()
      this._startInvincibility(1500)
      if (this.targetLocked) this._cancelLock()
      if (result === "game_over" && !this.isDead) {
        this.isDead = true
        this.isPaused = true
        this.input.enabled = false
        if (this.player?.body) this.player.setVelocity(0, 0)
        this._destroyChoicePanel()
        audioManager.stopBGM(0)
        inventory.onDeath()
        this.scene.stop()
        this.gameOverTimer = window.setTimeout(() => {
          const rr = this.game.scene.getScene("ResultScene")
          const deathResult = levelManager.getLevelResult()
          if (rr && rr.scene.isSleeping()) rr.scene.wake(deathResult)
          this.game.scene.start("ResultScene", deathResult)
          this.gameOverTimer = null
        }, 0)
      }
    })
  }
  _startInvincibility(duration = 1500) {
    if (this.invincible) return
    this.invincible = true
    this.tweens.add({ targets: this.player, alpha: { from: 0.3, to: 1 }, duration: 150, yoyo: true, repeat: Math.floor(duration / 300), onComplete: () => { if (this.player?.active) { this.player.setAlpha(1); this.invincible = false } } })
  }
  _tryLockTarget() { this._combat.tryLockTarget() }
  _cancelLock() { this._combat.cancelLock() }
  _destroyChoicePanel() { this._combat.destroyChoicePanel() }

  /** 生成弹幕（远程怪物开火） */
  _spawnProjectile({ x, y, tx, ty, speed, damage }) {
    const angle = Phaser.Math.Angle.Between(x, y, tx, ty)
    const bullet = this.projectiles.create(x, y, 'boss_bullet')
    if (!bullet) return
    bullet.setScale(1.5).setDepth(15)
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    bullet.setData('damage', damage || 1)
    // 3秒后自动销毁
    this.time.delayedCall(3000, () => { if (bullet.active) bullet.destroy() })
  }

  /** 弹幕命中玩家 */
  _onProjectileHit(player, projectile) {
    if (this.isDead || this._bossQuizActive || this.invincible || !projectile.active) return
    // 守护祝福首次免伤
    if (this._firstHitFree) {
      this._firstHitFree = false
      this._showFloatingText(player.x, player.y - 20, '🛡️ 免伤')
      this._startInvincibility(1500)
      projectile.destroy()
      return
    }
    const dmg = projectile.getData('damage') || 1
    projectile.destroy()
    // 扣血
    for (let i = 0; i < dmg; i++) {
      const result = levelManager.loseLife()
      if (result === 'game_over' && !this.isDead) {
        this.isDead = true
        this.isPaused = true
        this.input.enabled = false
        if (this.player?.body) this.player.setVelocity(0, 0)
        this._destroyChoicePanel()
        audioManager.stopBGM(0)
        inventory.onDeath()
        this.scene.stop()
        this.gameOverTimer = window.setTimeout(() => {
          const rr = this.game.scene.getScene('ResultScene')
          const deathResult = levelManager.getLevelResult()
          if (rr && rr.scene.isSleeping()) rr.scene.wake(deathResult)
          this.game.scene.start('ResultScene', deathResult)
          this.gameOverTimer = null
        }, 0)
      }
    }
    this._startInvincibility(800)
    this._showFloatingText(player.x, player.y - 20, `-${dmg} 💔`)
  }

  /** 生成法术AOE（预警圈 → 延迟伤害） */
  _spawnAOE({ x, y, radius, damage, delay }) {
    // 预警圈
    const warnCircle = this.add.graphics().setDepth(50)
    warnCircle.lineStyle(2, 0xff4444, 0.7)
    warnCircle.strokeCircle(x, y, radius)
    warnCircle.fillStyle(0xff0000, 0.1)
    warnCircle.fillCircle(x, y, radius)

    // 脉冲效果
    this.tweens.add({
      targets: warnCircle, alpha: 0.3, duration: 200, yoyo: true, repeat: Math.floor(delay / 400),
      onComplete: () => {
        warnCircle.destroy()
        // 伤害判定
        if (this.isDead || !this.player?.active) return
        const playerDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y)
        if (playerDist <= radius) {
          // 守护祝福
          if (this._firstHitFree) {
            this._firstHitFree = false
            this._showFloatingText(this.player.x, this.player.y - 20, '🛡️ 免伤')
            this._startInvincibility(1500)
            return
          }
          for (let i = 0; i < damage; i++) {
            const result = levelManager.loseLife()
            if (result === 'game_over' && !this.isDead) {
              this.isDead = true; this.isPaused = true; this.input.enabled = false
              if (this.player?.body) this.player.setVelocity(0, 0)
              this._destroyChoicePanel()
              audioManager.stopBGM(0); inventory.onDeath()
              this.scene.stop()
              this.gameOverTimer = window.setTimeout(() => {
                const rr = this.game.scene.getScene('ResultScene')
                const dr = levelManager.getLevelResult()
                if (rr && rr.scene.isSleeping()) rr.scene.wake(dr)
                this.game.scene.start('ResultScene', dr)
              }, 0)
            }
          }
          this._startInvincibility(800)
          this._showFloatingText(this.player.x, this.player.y - 20, `-${damage} 💥`)
        }
        // 爆炸视觉
        const boom = this.add.graphics().setDepth(50)
        boom.fillStyle(0xff6600, 0.4)
        boom.fillCircle(x, y, radius * 0.8)
        this.tweens.add({ targets: boom, alpha: 0, scale: 1.5, duration: 400, onComplete: () => boom.destroy() })
      }
    })
  }

  /** Boss 碰撞 → 触发 Vue BossQuizModal */
  _onBossCollide(player, bossSprite) {
    if (this.isDead || this._bossQuizActive || this.invincible || this.targetLocked) return
    const bossData = bossSprite.getData('bossData')
    if (!bossData || bossData.defeated) return

    this._bossQuizActive = true
    this.isPaused = true
    this.input.enabled = false
    if (this.player?.body) this.player.setVelocity(0, 0)
    if (this.targetLocked) this._cancelLock()

    // 冻结所有怪物 AI + Boss
    Object.values(this.monsterAIs).forEach(ai => { if (!ai.isDefeated) ai.isPaused = true })
    bossSprite.body.setVelocity(0, 0)
    bossSprite.body.enable = false
    this.tweens.getTweensOf(bossSprite).forEach(t => t.pause())

    // 无敌 + 轻微击退（不扣血）
    this._startInvincibility(800)
    const angle = Phaser.Math.Angle.Between(bossSprite.x, bossSprite.y, player.x, player.y)
    player.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80)

    // Boss 开场特效
    this.cameras.main.shake(400, 0.02)
    this.cameras.main.flash(300, 255, 0, 0, true)
    const { width, height } = this.cameras.main
    const bossWarning = this.add.text(width / 2, height / 2 - 60, '⚠️  BOSS  ⚠️', {
      fontSize: '36px', fontFamily: '"Press Start 2P", monospace',
      color: '#ff0000', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(500).setScrollFactor(0)
    this.tweens.add({
      targets: bossWarning, alpha: 0, scale: 1.5, duration: 600, delay: 600,
      onComplete: () => bossWarning.destroy()
    })

    audioManager.pauseBGM(300)

    // 1秒延迟后弹出 BossQuizModal
    const bHp = bossData.hp; const bMaxHp = bossData.maxHp
    const bName = bossData.name; const bType = bossData.bossType
    const timeLimit = Math.max(15000, levelManager.difficultyConfig.timer - 5000)
    this.time.delayedCall(1000, () => {
      if (!this._bossQuizActive) return
      eventBus.emit(EVENTS.SHOW_BOSS_QUIZ, {
        bossName: bName, bossType: bType,
        questionsNeeded: bHp, bossCurrentHp: bHp, bossMaxHp: bMaxHp,
        timeLimit
      })
    })
  }

  /** 处理 BossQuizModal 的答题结果 */
  _handleBossQuizResult(result) {
    this._bossQuizActive = false
    if (!this.bossGroup) return

    const bossSprite = this.bossGroup.getFirstAlive()
    if (!bossSprite) return
    const bossData = bossSprite.getData('bossData')
    if (!bossData || bossData.defeated) return

    if (result.cancelled) {
      // 玩家关闭了答题 → 恢复所有状态
      Object.values(this.monsterAIs).forEach(ai => { if (!ai.isDefeated) ai.isPaused = false })
      if (bossSprite.active) {
        bossSprite.body.enable = true
        this.tweens.getTweensOf(bossSprite).forEach(t => t.resume())
      }
      audioManager.resumeBGM(300)
      this.isPaused = false
      this.input.enabled = true
      this.game.canvas.focus?.()
      return
    }

    // 先扣 Boss HP
    const correctHits = result.correctCount || 0
    bossData.hp -= correctHits
    const bossDefeated = bossData.hp <= 0
    if (bossDefeated) {
      bossData.defeated = true
      bossData.hp = 0
      this._killBoss(bossSprite, bossData)
    }

    // Boss 已击败 → 不扣血（参考普通战斗：答错不扣命，死亡只来自碰撞）
    if (!bossDefeated) {
      const wrongHits = result.wrongCount || 0
      for (let i = 0; i < wrongHits; i++) {
        const r = levelManager.loseLife()
        if (r === 'game_over' && !this.isDead) {
          this.isDead = true; this.isPaused = true; this.input.enabled = false
          if (this.player?.body) this.player.setVelocity(0, 0)
          this._destroyChoicePanel()
          audioManager.stopBGM(0); inventory.onDeath()
          this.scene.stop()
          const game = this.game
          this.gameOverTimer = window.setTimeout(() => {
            game.scene.start('ResultScene', levelManager.getLevelResult())
          }, 0)
          return
        }
      }
    }

    // 恢复所有怪物 AI
    Object.values(this.monsterAIs).forEach(ai => { if (!ai.isDefeated) ai.isPaused = false })
    // 恢复 Boss（如果未被击败）
    if (bossSprite.active) {
      bossSprite.body.enable = true
      this.tweens.getTweensOf(bossSprite).forEach(t => t.resume())
    }
    audioManager.resumeBGM(300)

    // 回复游戏
    this.isPaused = false
    this.input.enabled = true
    this.game.canvas.focus?.()
    eventBus.emit(EVENTS.UPDATE_HUD, { lives: levelManager.lives, score: levelManager.score })
  }

  /** Boss 击败：动画 + 大量金币 + 检查通关 */
  _killBoss(bossSprite, bossData) {
    const { x, y } = bossSprite
    // 大型粒子爆炸
    for (let i = 0; i < 12; i++) {
      const px = x + Phaser.Math.Between(-20, 20)
      const py = y + Phaser.Math.Between(-20, 20)
      const part = this.add.image(px, py, 'boss_particle').setDepth(20).setScale(2)
      this.tweens.add({
        targets: part, alpha: 0, scale: 0,
        x: px + Phaser.Math.Between(-50, 50),
        y: py - Phaser.Math.Between(20, 60),
        duration: 600, delay: i * 50,
        onComplete: () => part.destroy()
      })
    }
    // Boss 本体消失动画
    this.tweens.add({ targets: bossSprite, alpha: 0, scale: 0, angle: 360, duration: 800, ease: 'Power2', onComplete: () => {
      const label = bossSprite.getData('label')
      if (label?.active) label.destroy()
      const arrow = bossSprite.getData('arrow')
      if (arrow?.active) arrow.destroy()
      bossSprite.destroy()
    }})
    // 奖励金币
    const bonusGold = 500 + this.chapter * 100
    this.spawnCoinEffect(x, y, bonusGold)
    inventory.addGold(bonusGold)
    if (this._goldText) this._goldText.setText('🪙 ' + inventory.getGold())
    levelManager.score += bonusGold
    audioManager.play('level_complete')
    this._showFloatingText(x, y - 30, `👹 +${bonusGold} 🪙`)

    // Boss 击败后检查是否全部清除（若没有普通怪物则激活撤离）
    if (Object.keys(this.monsterAIs).length === 0 && this.extractionPoint) {
      this.extractionPoint.activate()
      this._showFloatingText(this.player.x, this.player.y - 20, 'Boss down! Go extract!')
    }
  }

  /** 法杖效果：委托 CombatSystem */
  _freezeRandomMonster(excludeIdx) { this._combat.freezeRandomMonster(excludeIdx) }

  createMonsters() {
    this.monsters = this.physics.add.group()
    this.monsterAIs = {}
    this.monsterLabels = []
    const mapW = 30 * 32, mapH = 20 * 32
    const isValid = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasChicken = isValid('chicken_sheet')

    // 章节怪物配置
    const chConfig = CHAPTER_MONSTER_CONFIG[this.chapter] || CHAPTER_MONSTER_CONFIG[1]
    const speedMult = chConfig.speedMult || 1.0

    // 为每只怪物分配类型
    const typeList = chConfig.types || ['melee']
    const monsterTypes = []
    for (let i = 0; i < this.monsterCount; i++) {
      monsterTypes.push(typeList[i % typeList.length])
    }

    // 生成位置（远离玩家/NPC出生点）
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

    // 创建每只怪物
    for (let i = 0; i < this.monsterCount; i++) {
      const mType = monsterTypes[i]
      const typeDef = MONSTER_TYPES[mType] || MONSTER_TYPES.melee
      const isElite = i === 0 && Math.random() < chConfig.eliteChance
      const pos = positions[i]

      // 选择纹理
      let textureKey = 'monster', useSheet = false
      if (hasChicken && mType === 'melee') {
        textureKey = 'chicken_sheet'; useSheet = true
      } else if (this.textures.exists(typeDef.texture)) {
        textureKey = typeDef.texture
      } else if (hasChicken) {
        textureKey = 'chicken_sheet'; useSheet = true
      }

      let monster
      if (useSheet) {
        monster = this.monsters.create(pos.x, pos.y, textureKey, 0)
        monster.setScale(isElite ? 4.5 : 3.5)
        monster.body.setSize(10, 10); monster.body.setOffset(3, 4)
        if (this.anims.exists('chicken_idle')) monster.play('chicken_idle')
        // 非近战鸡：添加颜色区分
        if (mType !== 'melee') monster.setTint(typeDef.color)
      } else {
        monster = this.monsters.create(pos.x, pos.y, textureKey)
        monster.setScale(isElite ? 1.8 : 1.4)
        monster.body.setSize(20, 20); monster.body.setOffset(6, 6)
      }
      // Ground shadow
      if (this.textures.exists('shadow')) {
        const shadow = this.add.image(pos.x, pos.y + 10, 'shadow').setDepth(3).setAlpha(0.6)
        monster.setData('shadow', shadow)
        // Shadow follows monster position (updated below in label tracking)
      }
      monster.setData('index', i)
      monster.setImmovable(false)
      monster.setDepth(5)

      // 巡逻点
      const patrolPoints = []
      for (let p = 0; p < 4; p++) {
        const angle = (p / 4) * Math.PI * 2 + Math.random()
        const r = Phaser.Math.Between(40, 100)
        patrolPoints.push({ x: pos.x + Math.cos(angle) * r, y: pos.y + Math.sin(angle) * r })
      }

      // 创建 AI
      const ai = new MonsterAI(monster, {
        monsterType: mType,
        patrolSpeed: (isElite ? 25 : 18) * speedMult,
        pursueSpeed: (isElite ? 55 : 40) * speedMult,
        perceptionRange: isElite ? 120 : 90,
        attackDamage: isElite ? 2 : 1,
        patrolPoints,
        preferredDistance: 100 + Math.random() * 60,
        projectileSpeed: 120 + this.chapter * 10,
        fireRate: 2200 - this.chapter * 100,
        castCooldown: 3200 - this.chapter * 100,
        castRadius: 60 + this.chapter * 4,
        castWarnTime: 1000
      })

      // 设置弹幕和法术回调
      ai.onFireProjectile = (data) => this._spawnProjectile(data)
      ai.onCastArea = (data) => this._spawnAOE(data)

      this.monsterAIs[i] = ai

      // 标签：类型图标 + 精英标记
      const labelIcon = isElite ? '👑' : typeDef.icon
      const label = this.add.text(pos.x, pos.y - 28, labelIcon, {
        fontSize: '16px', stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(6)
      // 精英怪物发光标签
      if (isElite) {
        this.tweens.add({ targets: label, alpha: 0.6, duration: 500, yoyo: true, repeat: -1 })
      }
      this.monsterLabels.push(label)
    }
  }

  /**
   * 创建Boss — 基于关卡配置从 BossFactory 生成
   * Boss 放入独立物理组，碰撞触发 Vue 层的 BossQuizModal
   */
  createBoss() {
    const bossType = getBossTypeForLevel(this.chapter, this.level)
    if (!bossType) return

    // Boss 生成在玩家前进方向的显眼位置（中上部区域）
    const bx = Phaser.Math.Between(500, 900)
    const by = Phaser.Math.Between(150, 350)

    this.bossGroup = this.physics.add.group()
    // 使用 cow_sheet 或生成纹理作为 Boss 贴图
    const texKey = this.textures.exists('cow_sheet') ? 'cow_sheet' : (this.textures.exists('monster_ranged') ? 'monster_ranged' : 'monster')
    const bossSprite = this.bossGroup.create(bx, by, texKey, 0)
    bossSprite.setScale(4.5).setDepth(8).setImmovable(true)
    bossSprite.body.setSize(24, 24)
    if (this.anims.exists('cow_idle')) bossSprite.play('cow_idle')

    // 存储 Boss 配置数据（不实例化 Boss 类，避免复杂生命周期管理）
    const hpPerDifficulty = { easy: 2, normal: 3, hard: 5 }
    const bossData = {
      bossType,
      name: bossType === 'roaming' ? '漫游巨兽' : bossType === 'turret' ? '炮塔守卫' : '冲锋恶魔',
      hp: hpPerDifficulty[this.difficulty] || 3,
      maxHp: hpPerDifficulty[this.difficulty] || 3,
      defeated: false
    }
    bossSprite.setData('bossData', bossData)
    // 根据类型着色
    const tints = { roaming: 0xff6666, turret: 0xaa66ff, charging: 0xff9933 }
    bossSprite.setTint(tints[bossType] || 0xff6666)
    // 脉冲发光
    this.tweens.add({ targets: bossSprite, alpha: { from: 0.7, to: 1 }, duration: 1000, yoyo: true, repeat: -1 })
    // Boss 名称标签
    const bossLabel = this.add.text(bx, by - 50, `👹 ${bossData.name}`, {
      fontSize: '12px', fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#ff4444', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(10)
    bossSprite.setData('label', bossLabel)

    // 世界空间引导箭头（指向 Boss）
    const arrow = this.add.text(bx, by - 80, '▼', {
      fontSize: '24px', color: '#ff0000', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(11)
    this.tweens.add({ targets: arrow, y: by - 90, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    bossSprite.setData('arrow', arrow)
  }

  createNPC() {
    this.npcs = this.physics.add.group()

    const isValidNpc = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasCow = isValidNpc('cow_sheet')
    let npc

    if (hasCow) {
      npc = this.npcs.create(700, 300, 'cow_sheet', 0)
      npc.setScale(2)
      // 缩小碰撞箱到奶牛身体中心（原始帧 32x32，取中间 20x18）
      npc.body.setSize(20, 18)
      npc.body.setOffset(6, 10)
      if (this.anims.exists('cow_idle')) {
        npc.play('cow_idle')
      }
    } else {
      npc = this.npcs.create(700, 300, 'npc')
      npc.setScale(1.5)
    }

    npc.setImmovable(true)
    npc.setDepth(5)
    npc.setData('type', 'wisdom')

    this.add.text(700, 260, '🌟 小智', {
      fontSize: '11px',
      fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#5b8c3e',
      stroke: '#fff',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(6)

    this.tweens.add({
      targets: npc,
      y: npc.y - 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  createHUD() {
    // Top bar: gold + consumables
    const topBar = this.add.graphics().setScrollFactor(0).setDepth(110)
    topBar.fillStyle(0x000000, 0.5)
    topBar.fillRect(0, 0, 960, 28)
    this._goldText = this.add.text(10, 5, '🪙 ' + inventory.getGold(), {
      fontSize: '14px', fontFamily: '"Press Start 2P", monospace', color: '#ffd700'
    }).setScrollFactor(0).setDepth(111)

    // Consumable slots
    const consumables = inventory.getConsumables()
    const slotX = 200
    consumables.forEach((c, i) => {
      const x = slotX + i * 110
      this.add.text(x, 5, c.icon + ' ' + c.name + ' x' + c.qty, {
        fontSize: '11px', fontFamily: 'Microsoft YaHei', color: c.qty > 0 ? '#f5edd6' : '#666'
      }).setScrollFactor(0).setDepth(111)
    })

    // Bottom bar
    this.add.text(480, 620, 'WASD:Move | E:Interact/Lock/Extract | 1-4:Answer | Q:Potion | Esc:Pause', {
      fontSize: '9px', fontFamily: 'Microsoft YaHei', color: '#3a6b1e',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100)
  }
  _showFloatingText(x, y, text) { this._combat.showFloatingText(x, y, text) }

  _doExtraction() {
    if (!this.extractionPoint || this.extractionPoint.used || this.isDead) return
    const allClear = Object.keys(this.monsterAIs).length === 0
    this.extractionPoint.triggerExtraction()
    this.isPaused = true
    this.input.enabled = false
    audioManager.stopBGM(0)
    const goldEarned = allClear ? levelManager.score : Math.floor(levelManager.score / 2)
    inventory.onExtract(goldEarned)
    const result = { ...levelManager.getLevelResult(), extracted: !allClear, fullClear: allClear, goldEarned, allClear }
    // 500ms 撤离动画后跳转。必须用 window.setTimeout：延迟回调 + 脱离 Phaser 事件循环
    this.scene.stop()
    const game = this.game
    window.setTimeout(() => {
      game.scene.start('ResultScene', result)
    }, 500)
  }

  spawnCoinEffect(x, y, score) { this._combat.spawnCoinEffect(x, y, score) }

  update(time, delta) {
    if (!this.player) return
    // Update extraction point particles
    if (this.extractionPoint) this.extractionPoint.update(time, delta)
    // 清理越界弹幕
    if (this.projectiles) {
      const bounds = this.physics.world.bounds
      this.projectiles.getChildren().forEach(p => {
        if (p.active && (p.x < bounds.x - 20 || p.x > bounds.right + 20 ||
            p.y < bounds.y - 20 || p.y > bounds.bottom + 20)) {
          p.destroy()
        }
      })
    }
    if (this.monsterAIs && this.monsters) {
      const children = this.monsters.getChildren()
      for (const m of children) {
        const idx = m.getData('index')
        const ai = this.monsterAIs[idx]
        if (ai && !ai.isDefeated) ai.update(this.player, this.game.loop.delta, this.timeScale)
      }
    }

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

    // 更新怪物标签和阴影位置
    if (this.monsterLabels) {
      const children = this.monsters.getChildren()
      for (const monster of children) {
        if (!monster.active || monster.getData('defeated')) continue
        const idx = monster.getData('index')
        const label = this.monsterLabels[idx]
        if (label && label.active) {
          label.setPosition(monster.x, monster.y - 28)
        }
        const shadow = monster.getData('shadow')
        if (shadow && shadow.active) {
          shadow.setPosition(monster.x, monster.y + 10)
        }
      }
    }

    // 更新 Boss 标签和箭头位置
    if (this.bossGroup) {
      this.bossGroup.getChildren().forEach(boss => {
        if (!boss.active) return
        const label = boss.getData('label')
        if (label?.active) label.setPosition(boss.x, boss.y - 50)
        const arrow = boss.getData('arrow')
        if (arrow?.active) arrow.setPosition(boss.x, boss.y - 80)
      })
    }

  }

  shutdown() {
    if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = null }
    if (this.gameOverTimer) { clearTimeout(this.gameOverTimer); this.gameOverTimer = null }
    if (this._keyHandler) { this.input.keyboard?.off('keydown', this._keyHandler); this._keyHandler = null }
    this._destroyChoicePanel()
    // 清理拼写输入 DOM（防御：即使 _destroyChoicePanel 已调用也确保清理）
    const spellEl = document.getElementById('wordquest-spell-input')
    if (spellEl) spellEl.remove()
    if (this.escKey) this.escKey.removeAllListeners()
    // Boss quiz listener cleanup
    if (this._onBossQuizResult) { eventBus.off(EVENTS.BOSS_QUIZ_RESULT, this._onBossQuizResult); this._onBossQuizResult = null }
    this._bossQuizActive = false
    this.input.enabled = false
    this.tweens.killAll()
    // 清理弹幕和AOE
    if (this.projectiles) { this.projectiles.clear(true, true); this.projectiles = null }
    this._activeProjectiles = []
    this._activeAOEs = []
    if (this.monsterLabels) { this.monsterLabels.forEach(l => { if (l?.active) l.destroy() }); this.monsterLabels = [] }
    // Clean up Boss
    if (this.bossGroup) {
      this.bossGroup.getChildren().forEach(b => {
        const label = b.getData('label'); if (label?.active) label.destroy()
        const arrow = b.getData('arrow'); if (arrow?.active) arrow.destroy()
      })
      this.bossGroup.clear(true, true); this.bossGroup = null
    }
    this.boss = null
    // Clean up monster shadows
    if (this.monsters) {
      this.monsters.getChildren().forEach(m => {
        const s = m.getData?.('shadow'); if (s?.active) s.destroy()
      })
    }
    this.monsterAIs = {}
    if (this.chests) { this.chests.forEach(c => c.destroy()); this.chests = null }
    if (this.extractionPoint) { this.extractionPoint.destroy(); this.extractionPoint = null }
    if (this.mapContainer) { this.mapContainer.destroy(true); this.mapContainer = null }
    if (this.decoContainer) { this.decoContainer.destroy(true); this.decoContainer = null }
    this.monsters = null; this.npcs = null; this.walls = null
    this.player = null; this.playerNameText = null; this.hudTexts = {}
    this.children.removeAll(true)
  }
}
