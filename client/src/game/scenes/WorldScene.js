import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'
import { failedAssetKeys } from './BootScene'
import { CHARACTER_PRESETS } from '../data/characters'
import MonsterAI from '../entities/MonsterAI'
import Chest from '../entities/Chest'
import ExtractionPoint from '../entities/ExtractionPoint'
import inventory from '../systems/Inventory'
import audioManager from '../systems/AudioManager'
import { CHAPTER_THEMES, CHAPTER_MONSTER_CONFIG, MONSTER_TYPES } from '../config/gameConstants'

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
  }

  init(data) {
    this.continueGame = data?.continueGame || false
    this.chapter = data?.chapter || levelManager.currentChapter || 1
    this.level = data?.level || levelManager.currentLevel || 1
    this.difficulty = data?.difficulty || 'normal'
    this.isTutorial = false
    this.virtualDirection = { up: false, down: false, left: false, right: false }
    // 装备与祝福（来自 PreparationScene）
    this.weaponId = data?.weaponId || 'sword'
    this.armorId = data?.armorId || 'cloth'
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

    this.input.enabled = true
    // 强制 Canvas 获取焦点，确保键盘事件能触发（修复首次按键无效）
    this.game.canvas.focus?.()
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

    // Register combat key handler once (not lazily)
    this._keyHandler = (event) => {
      console.log('[Combat] key:', event.key, 'locked:', this.targetLocked, 'lt:', !!this.lockedTarget)
      if (!this.targetLocked || this.isDead) return
      if (event.key === 'Escape') { this._cancelLock(); return }
      const num = parseInt(event.key)
      console.log('[Combat] num:', num, 'correctIdx:', this.lockedTarget?.correctIdx)
      if (num >= 1 && num <= 4 && this.lockedTarget) {
        if (num === this.lockedTarget.correctIdx) {
          console.log('[Combat] CORRECT, monsters left:', Object.keys(this.monsterAIs).length)
          levelManager.correctCount++
          audioManager.play('correct')
          const wasLast = Object.keys(this.monsterAIs).length === 1
          // Weapon effects
          let bonusGold = 0
          if (this.weaponId === 'sword') {
            levelManager.score += 20  // 剑：额外 +20 score
          }
          if (this.weaponId === 'hammer' && Math.random() < 0.5) {
            bonusGold = 100  // 锤：50% 双倍金币
          }
          if (this.weaponId === 'staff' && Math.random() < 0.3) {
            // 法杖：30% 冰冻随机另一只怪物 2s
            this._freezeRandomMonster(this.lockedTarget.idx)
          }
          this._killMonster(this.lockedTarget.idx, bonusGold)
          if (!wasLast) this._cancelLock()
        } else {
          console.log('[Combat] WRONG')
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

  /**
   * 创建Boss
   */
  createPastoralMap() {
    const mapWidth = 40
    const mapHeight = 30
    const tileSize = 32
    const theme = CHAPTER_THEMES[this.chapter] || CHAPTER_THEMES[1]

    this.mapContainer = this.add.container(0, 0)
    this.decoContainer = this.add.container(0, 0).setDepth(2)

    this.cameras.main.setBackgroundColor(theme.bgColor)

    const isValid = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasGrassTileset = isValid('grass_tileset')
    const hasFenceSheet = isValid('fence_sheet')
    const hasGrassDecor = isValid('grass_decor')

    if (hasGrassTileset && !this.textures.exists('grass_v0')) {
      const grassSource = this.textures.get('grass_tileset').getSourceImage()
      for (let v = 0; v < 4; v++) {
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const ctx = canvas.getContext('2d')
        const sx = 48 + (v % 2) * 16
        const sy = 32 + Math.floor(v / 2) * 16
        ctx.drawImage(grassSource, sx, sy, 16, 16, 0, 0, 16, 16)
        this.textures.addCanvas(`grass_v${v}`, canvas)
      }
    }

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const px = x * tileSize + 16
        const py = y * tileSize + 16
        const isWall = (y === 0 || y === mapHeight - 1 || x === 0 || x === mapWidth - 1)

        if (isWall) {
          if (hasFenceSheet) {
            let fenceFrame = 0
            if (y === 0 && x === 0) fenceFrame = 0
            else if (y === 0 && x === mapWidth - 1) fenceFrame = 2
            else if (y === mapHeight - 1 && x === 0) fenceFrame = 8
            else if (y === mapHeight - 1 && x === mapWidth - 1) fenceFrame = 10
            else if (y === 0 || y === mapHeight - 1) fenceFrame = 1
            else fenceFrame = 4

            const fence = this.add.image(px, py, 'fence_sheet', fenceFrame).setScale(2)
            this.mapContainer.add(fence)
          } else {
            const wall = this.add.image(px, py, 'wall_tile').setScale(2)
            this.mapContainer.add(wall)
          }
        } else {
          if (hasGrassTileset && this.textures.exists('grass_v0')) {
            const v = Phaser.Math.Between(0, 3)
            const tile = this.add.image(px, py, `grass_v${v}`).setScale(2)
            this.mapContainer.add(tile)
          } else {
            const grassColors = theme.grassColors
            const color = grassColors[Phaser.Math.Between(0, grassColors.length - 1)]
            const tile = this.add.rectangle(px, py, tileSize, tileSize, color)
            this.mapContainer.add(tile)
          }
        }
      }
    }

    this.addDecorations(mapWidth, mapHeight, tileSize, hasGrassDecor)

    this.walls = this.physics.add.staticGroup()
    for (let x = 0; x < mapWidth; x++) {
      const wallTop = this.walls.create(x * tileSize + 16, 16, null)
      wallTop.setSize(tileSize, tileSize).setVisible(false).refreshBody()
      const wallBot = this.walls.create(x * tileSize + 16, (mapHeight - 1) * tileSize + 16, null)
      wallBot.setSize(tileSize, tileSize).setVisible(false).refreshBody()
    }
    for (let y = 1; y < mapHeight - 1; y++) {
      const wallLeft = this.walls.create(16, y * tileSize + 16, null)
      wallLeft.setSize(tileSize, tileSize).setVisible(false).refreshBody()
      const wallRight = this.walls.create((mapWidth - 1) * tileSize + 16, y * tileSize + 16, null)
      wallRight.setSize(tileSize, tileSize).setVisible(false).refreshBody()
    }

    this.physics.world.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize)
    this.cameras.main.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize)
  }

  addDecorations(mapWidth, mapHeight, tileSize, hasGrassDecor) {
    const theme = CHAPTER_THEMES[this.chapter] || CHAPTER_THEMES[1]
    const padding = 3  // 离墙壁的最小距离（格数）
    const playerSpawn = { x: 80, y: 300 }
    const npcSpawn = { x: 700, y: 300 }
    const exclusionDist = 120  // 与玩家/NPC出生点的排斥距离

    // ─── 树定义：绿树帧[0,1,2,9,10,11]，粉树帧[3,4,5,12,13,14] ───
    // 每棵树由 3列×2行 的 16x16 帧拼成，实际尺寸 48x32（scale 2 后 96x64）
    const TREE_FRAMES = {
      green: { topRow: [0, 1, 2], bottomRow: [9, 10, 11] },
      pink:  { topRow: [3, 4, 5], bottomRow: [12, 13, 14] }
    }

    // ─── 1. 放置完整的多帧树 ───
    if (hasGrassDecor && theme.treeTypes && theme.treeCount > 0) {
      const treePositions = []
      const treeExclusionDist = 120  // 树与树之间的最小距离

      for (let t = 0; t < theme.treeCount; t++) {
        const treeType = theme.treeTypes[t % theme.treeTypes.length]
        const frames = TREE_FRAMES[treeType]
        if (!frames) continue

        // 找一个合适的位置
        let placed = false
        for (let attempt = 0; attempt < 50; attempt++) {
          const gx = Phaser.Math.Between(padding, mapWidth - padding - 3)
          const gy = Phaser.Math.Between(padding, mapHeight - padding - 2)
          const px = gx * tileSize + 16
          const py = gy * tileSize + 16

          // 检查排斥：玩家、NPC、其他树
          if (Math.hypot(px - playerSpawn.x, py - playerSpawn.y) < exclusionDist) continue
          if (Math.hypot(px - npcSpawn.x, py - npcSpawn.y) < exclusionDist) continue
          if (treePositions.some(p => Math.hypot(p.x - px, p.y - py) < treeExclusionDist)) continue

          // 放置 3×2 帧组成的完整树
          const scale = 2
          const frameW = 16
          for (let row = 0; row < 2; row++) {
            const rowFrames = row === 0 ? frames.topRow : frames.bottomRow
            for (let col = 0; col < 3; col++) {
              const fx = px + (col - 1) * frameW * scale
              const fy = py + (row - 0.5) * frameW * scale
              const treePart = this.add.image(fx, fy, 'grass_decor', rowFrames[col]).setScale(scale)
              treePart.setDepth(3)
              this.decoContainer.add(treePart)
            }
          }

          treePositions.push({ x: px, y: py })
          placed = true
          break
        }
      }
    }

    // ─── 2. 放置单帧小装饰（花、蘑菇、石头等） ───
    const decoCount = theme.decoCount || 20
    for (let i = 0; i < decoCount; i++) {
      const gx = Phaser.Math.Between(padding, mapWidth - padding - 1)
      const gy = Phaser.Math.Between(padding, mapHeight - padding - 1)
      const px = gx * tileSize + 16
      const py = gy * tileSize + 16

      if (Math.hypot(px - playerSpawn.x, py - playerSpawn.y) < 80) continue
      if (Math.hypot(px - npcSpawn.x, py - npcSpawn.y) < 80) continue

      if (hasGrassDecor && theme.decoFrames && theme.decoFrames.length > 0) {
        const frame = theme.decoFrames[Phaser.Math.Between(0, theme.decoFrames.length - 1)]
        const deco = this.add.image(px, py, 'grass_decor', frame).setScale(2)
        deco.setAlpha(0.9)
        this.decoContainer.add(deco)
      } else {
        const decoType = Phaser.Math.Between(0, 3)
        let deco
        switch (decoType) {
          case 0: deco = this.add.circle(px, py, 4, 0xff9999); break
          case 1: deco = this.add.circle(px, py, 5, 0xd4a373); break
          case 2: deco = this.add.circle(px, py, 6, 0x999999); break
          case 3: deco = this.add.rectangle(px, py, 10, 8, 0x3a6b1e); break
        }
        if (deco) {
          deco.setAlpha(0.7)
          this.decoContainer.add(deco)
        }
      }
    }
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
    if (this.isDead || this.invincible || !monster.active) return
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
  _tryLockTarget() {
    if (this.targetLocked || !this.player) return
    const lockRange = this.weaponId === 'bow' ? 500 : 250
    let closest = null, closestDist = lockRange
    const children = this.monsters.getChildren()
    for (let i = 0; i < children.length; i++) {
      const m = children[i]; const idx = m.getData('index')
      const ai = this.monsterAIs[idx]
      if (!m.active || !ai || ai.isDefeated) continue
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y)
      if (dist < closestDist) { closestDist = dist; closest = { monster: m, ai, idx } }
    }
    if (!closest) return

    // Get word + generate choices (staff mode: pick correct meaning)
    const word = levelManager.getCurrentWord()
    if (!word) return
    levelManager.nextWord()

    // Generate 4 options (1 correct + up to 3 distractors)
    const correct = word.meaning
    const others = levelManager.words.map(w => w.meaning).filter(m => m && m !== correct)
    // Deduplicate and shuffle
    const unique = [...new Set(others)]
    const shuffled = unique.sort(() => Math.random() - 0.5).slice(0, 3)
    // Fallback distractors if not enough unique meanings
    const fallbacks = ['苹果','香蕉','橙子','葡萄','书本','电脑','学校','朋友']
    while (shuffled.length < 3) {
      const fb = fallbacks.find(f => f !== correct && !shuffled.includes(f))
      if (fb) shuffled.push(fb); else break
    }
    const options = [correct, ...shuffled].sort(() => Math.random() - 0.5)
    const correctIdx = options.indexOf(correct) + 1

    this.targetLocked = true
    this.lockedTarget = { ...closest, word, options, correctIdx }
    this.timeScale = 0.2
    this.isPaused = true
    audioManager.pauseBGM(200)

    // Show English word above monster
    this.monsterLabels[closest.idx]?.setText(word.word)

    // Create choice panel
    this._createChoicePanel(word.word, options)
  }

  _cancelLock() {
    if (!this.targetLocked) return
    const lt = this.lockedTarget
    if (lt && this.monsterLabels[lt.idx]) {
      const ai = this.monsterAIs[lt.idx]
      this.monsterLabels[lt.idx].setText(ai?.isDefeated ? '💀' : '❓')
    }
    this._destroyChoicePanel()
    this.targetLocked = false
    this.lockedTarget = null
    this.timeScale = 1.0
    // Don't unpause or resume BGM if level is being cleared
    if (Object.keys(this.monsterAIs).length > 0) {
      this.isPaused = false
      audioManager.resumeBGM(200)
    }
  }

  _createChoicePanel(word, options) {
    const { width, height } = this.cameras.main
    // Word display at top
    this._choiceWordText = this.add.text(width / 2, height - 115, word, {
      fontSize: '26px', fontFamily: '"Press Start 2P", monospace', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(300).setScrollFactor(0)

    // 4 option buttons
    this._choiceOpts = []
    const btnW = 200, btnH = 36, gap = 10, totalW = btnW * 4 + gap * 3
    const startX = width / 2 - totalW / 2 + btnW / 2
    for (let i = 0; i < 4; i++) {
      const x = startX + i * (btnW + gap), y = height - 55
      const bg = this.add.graphics().setDepth(300).setScrollFactor(0)
      bg.fillStyle(0x2d5016, 0.85)
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6)
      bg.lineStyle(2, 0x8b6914)
      bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6)
      const label = this.add.text(x, y, `[${i + 1}] ${options[i]}`, {
        fontSize: '13px', fontFamily: 'Microsoft YaHei', color: '#f5edd6'
      }).setOrigin(0.5).setDepth(301).setScrollFactor(0)
      this._choiceOpts.push({ bg, label, x, y })  // store x,y for flash
    }

    // Hint
    this._choiceHint = this.add.text(width / 2, height - 130, '选择正确中文释义 · 1-4 数字键 · Esc取消', {
      fontSize: '11px', fontFamily: 'Microsoft YaHei', color: '#c4b99a'
    }).setOrigin(0.5).setDepth(300).setScrollFactor(0)

  }

  _destroyChoicePanel() {
    if (this._choiceWordText) { this._choiceWordText.destroy(); this._choiceWordText = null }
    if (this._choiceOpts) { this._choiceOpts.forEach(o => { o.bg.destroy(); o.label.destroy() }); this._choiceOpts = null }
    if (this._choiceHint) { this._choiceHint.destroy(); this._choiceHint = null }
  }

  _killMonster(idx, bonusGold = 0) {
    const ai = this.monsterAIs[idx]
    if (!ai || ai.isDefeated) return
    const monster = ai.monster
    if (!monster || !monster.active) return
    ai.defeat()
    delete this.monsterAIs[idx]
    // Death particle burst
    for (let i = 0; i < 6; i++) {
      const px = monster.x + Phaser.Math.Between(-10, 10)
      const py = monster.y + Phaser.Math.Between(-10, 10)
      const part = this.add.image(px, py, 'boss_particle').setDepth(20).setScale(1.5)
      this.tweens.add({
        targets: part, alpha: 0, scale: 0,
        x: px + Phaser.Math.Between(-20, 20),
        y: py - Phaser.Math.Between(10, 30),
        duration: 400, delay: i * 40,
        onComplete: () => part.destroy()
      })
    }
    this.tweens.add({ targets: monster, alpha: 0, scale: 0, y: monster.y - 30, duration: 400, ease: "Back.easeIn", onComplete: () => {
      // Clean up shadow
      const shadow = monster.getData('shadow')
      if (shadow) shadow.destroy()
      monster.destroy()
    }})
    if (this.monsterLabels[idx]) { this.monsterLabels[idx].destroy(); this.monsterLabels[idx] = null }
    // Gold: base 100 + weapon bonuses, apply wealth blessing multiplier
    const wealthMult = this.blessingId === 'wealth' ? 1.5 : 1.0
    const totalGold = Math.floor((100 + bonusGold) * wealthMult)
    this.spawnCoinEffect(monster.x, monster.y, totalGold)
    audioManager.play("correct")
    levelManager.score += 100
    eventBus.emit(EVENTS.UPDATE_HUD, { score: levelManager.score, lives: levelManager.lives })

    // Check if all monsters defeated → activate extraction point
    if (Object.keys(this.monsterAIs).length === 0) {
      console.log('[LevelClear] All monsters defeated! Extraction point activated.')
      this._destroyChoicePanel()
      this.targetLocked = false
      this.lockedTarget = null
      this.timeScale = 1.0
      this.isPaused = false
      audioManager.resumeBGM(200)
      audioManager.play('level_complete')
      // Activate extraction point
      if (this.extractionPoint) {
        this.extractionPoint.activate()
        this._showFloatingText(this.player.x, this.player.y - 20, 'All clear! Go extract!')
      }
    }
  }

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
    if (this.isDead || this.invincible || !projectile.active) return
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

  /** 法杖效果：随机冻结一只活着的怪物（排除当前击杀的） */
  _freezeRandomMonster(excludeIdx) {
    const keys = Object.keys(this.monsterAIs).filter(k => String(k) !== String(excludeIdx))
    if (keys.length === 0) return
    const targetIdx = keys[Phaser.Math.Between(0, keys.length - 1)]
    const ai = this.monsterAIs[targetIdx]
    if (ai && !ai.isDefeated) {
      ai.freeze(2000)
      // 在标签上显示冰冻效果
      if (this.monsterLabels[targetIdx]) {
        const orig = this.monsterLabels[targetIdx].text
        this.monsterLabels[targetIdx].setText('❄️')
        this.time.delayedCall(2000, () => {
          if (this.monsterLabels[targetIdx] && this.monsterLabels[targetIdx].active) {
            this.monsterLabels[targetIdx].setText('❓')
          }
        })
      }
    }
  }

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
  _showFloatingText(x, y, text) {
    const t = this.add.text(x, y, text, { fontSize: '16px', fontFamily: '"Press Start 2P", monospace', color: '#ffd700', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(100)
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1200, onComplete: () => t.destroy() })
  }

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
    const game = this.game
    window.setTimeout(() => {
      game.scene.start('ResultScene', result)
    }, 500)
  }

  spawnCoinEffect(x, y, score) {
    audioManager.play("coin")
    for (let i = 0; i < 5; i++) {
      const coin = this.add.image(x, y, "coin").setDepth(20).setScale(1.5)
      this.tweens.add({
        targets: coin, x: x + Phaser.Math.Between(-40, 40), y: y - Phaser.Math.Between(30, 80),
        alpha: 0, duration: 800, ease: "Power2", delay: i * 100, onComplete: () => coin.destroy()
      })
    }
    const displayScore = score || 100
    const scoreText = this.add.text(x, y - 20, "+" + displayScore, {
      fontSize: "16px", fontFamily: "'Press Start 2P', Arial", color: "#ffc847", fontStyle: "bold",
      stroke: "#5b3a1a", strokeThickness: 3
    }).setOrigin(0.5).setDepth(20)
    this.tweens.add({
      targets: scoreText, y: y - 60, alpha: 0, duration: 1000,
      onComplete: () => scoreText.destroy()
    })
  }

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

  }

  shutdown() {
    if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = null }
    if (this.gameOverTimer) { clearTimeout(this.gameOverTimer); this.gameOverTimer = null }
    if (this._keyHandler) { this.input.keyboard?.off('keydown', this._keyHandler); this._keyHandler = null }
    this._destroyChoicePanel()
    if (this.escKey) this.escKey.removeAllListeners()
    this.input.enabled = false
    this.tweens.killAll()
    // 清理弹幕和AOE
    if (this.projectiles) { this.projectiles.clear(true, true); this.projectiles = null }
    this._activeProjectiles = []
    this._activeAOEs = []
    if (this.monsterLabels) { this.monsterLabels.forEach(l => { if (l?.active) l.destroy() }); this.monsterLabels = [] }
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
