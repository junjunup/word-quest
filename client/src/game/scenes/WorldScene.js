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
    this.isDead = false
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
  createPastoralMap() {
    const mapWidth = 30
    const mapHeight = 20
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
        audioManager.stopBGM(0)
        const rr = this.game.scene.getScene("ResultScene")
        if (rr && rr.scene.isSleeping()) rr.scene.wake()
        this.scene.stop()
        this.game.scene.start("ResultScene", levelManager.getLevelResult())
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
    this.timeScale = 0.2; this.inputBuffer = ""; this.isPaused = true
    audioManager.pauseBGM(200)
    this.monsterLabels[closest.idx]?.setText("🎯")
  }
  _cancelLock() {
    if (!this.targetLocked) return
    if (this.lockedTarget && this.monsterLabels[this.lockedTarget.idx]) this.monsterLabels[this.lockedTarget.idx].setText("❓")
    this.targetLocked = false; this.lockedTarget = null
    this.timeScale = 1.0; this.inputBuffer = ""; this.isPaused = false
    audioManager.resumeBGM(200)
  }
  _killMonster(idx) {
    const monster = this.monsters.getChildren()[idx]
    const ai = this.monsterAIs[idx]
    if (!monster || !ai || ai.isDefeated) return
    ai.defeat()
    this.tweens.add({ targets: monster, alpha: 0, scale: 0, y: monster.y - 30, duration: 400, ease: "Back.easeIn", onComplete: () => monster.destroy() })
    if (this.monsterLabels[idx]) { this.monsterLabels[idx].destroy(); this.monsterLabels[idx] = null }
    this.spawnCoinEffect(monster.x, monster.y, 100)
    audioManager.play("correct")
    levelManager.score += 100
    eventBus.emit(EVENTS.UPDATE_HUD, { score: levelManager.score, lives: levelManager.lives })
  }

  createMonsters() {
    this.monsters = this.physics.add.group()
    this.monsterAIs = []
    this.monsterLabels = []
    const mapW = 30 * 32, mapH = 20 * 32
    const isValid = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasChicken = isValid("chicken_sheet")
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
        monster = this.monsters.create(pos.x, pos.y, "chicken_sheet", 0)
        monster.setScale(isElite ? 4.5 : 3.5)
        monster.body.setSize(10, 10); monster.body.setOffset(3, 4)
        if (this.anims.exists("chicken_idle")) monster.play("chicken_idle")
      } else {
        monster = this.monsters.create(pos.x, pos.y, "monster")
        monster.setScale(isElite ? 1.5 : 1.2)
        monster.body.setSize(20, 20); monster.body.setOffset(6, 6)
      }
      monster.setData("index", i)
      monster.setImmovable(false)
      monster.setDepth(5)
      const patrolPoints = []
      for (let p = 0; p < 4; p++) {
        const angle = (p / 4) * Math.PI * 2 + Math.random()
        const r = Phaser.Math.Between(40, 100)
        patrolPoints.push({ x: pos.x + Math.cos(angle) * r, y: pos.y + Math.sin(angle) * r })
      }
      const ai = new MonsterAI(monster, { patrolSpeed: isElite ? 25 : 18, pursueSpeed: isElite ? 55 : 40, perceptionRange: isElite ? 120 : 90, attackDamage: isElite ? 2 : 1, patrolPoints })
      this.monsterAIs.push(ai)
      const label = this.add.text(pos.x, pos.y - 28, isElite ? "👾" : "❓", { fontSize: "16px", stroke: "#000", strokeThickness: 2 }).setOrigin(0.5).setDepth(6)
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
    this.add.text(480, 620, '🌿 方向键/WASD 移动  |  接触小鸡答题  |  找到小智获得帮助', {
      fontSize: '10px', fontFamily: 'Microsoft YaHei', color: '#3a6b1e',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100)
  }

  generateSpacedPositions(count, minX, maxX, minY, maxY, minDist, excludeZones = []) {
    const positions = []
    const maxAttempts = 100
    const excludeDist = 80

    for (let i = 0; i < count; i++) {
      let placed = false
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = Phaser.Math.Between(minX, maxX)
        const y = Phaser.Math.Between(minY, maxY)
        const tooCloseToOther = positions.some(p => Math.hypot(p.x - x, p.y - y) < minDist)
        const tooCloseToExcluded = excludeZones.some(p => Math.hypot(p.x - x, p.y - y) < excludeDist)
        if (!tooCloseToOther && !tooCloseToExcluded) {
          positions.push({ x, y })
          placed = true
          break
        }
      }
      if (!placed) {
        positions.push({
          x: Phaser.Math.Between(minX, maxX),
          y: Phaser.Math.Between(minY, maxY)
        })
      }
    }
    return positions
  }

  onMonsterEncounter(player, monster) {
    if (monster.getData('defeated') || this.isPaused || this.encounterCooldown) return

    this.isPaused = true
    this.encounterCooldown = true
    player.setVelocity(0, 0)
    audioManager.pauseBGM(300, 'quiz')

    // 暂停 Boss 行为（防止答题期间 Boss 子弹/冲锋命中玩家）
    if (this.boss && !this.boss.defeated && this.boss.pauseBehavior) {
      this.boss.pauseBehavior()
    }

    eventBus.emit(EVENTS.SHOW_QUIZ, {
      monsterIndex: monster.getData('index'),
      chapter: this.chapter,
      level: this.level
    })
  }

  onNPCInteract(player, npc) {
    if (this.isPaused || this.npcCooldown) return
    this.isPaused = true
    this.npcCooldown = true
    player.setVelocity(0, 0)
    audioManager.pauseBGM(300, 'chat')

    const dx = player.x - npc.x
    const dy = player.y - npc.y
    const dist = Math.hypot(dx, dy) || 1
    player.setVelocity((dx / dist) * 300, (dy / dist) * 300)
    this.time.delayedCall(200, () => {
      if (player.active) player.setVelocity(0, 0)
    })

    eventBus.emit(EVENTS.SHOW_CHAT, {
      npcType: npc.getData('type'),
      chapter: this.chapter,
      level: this.level
    })
  }

  onQuizAnswered(data) {
    if (!this.scene?.isActive()) return
    const { monsterIndex, isCorrect, score, gameOver = false } = data

    if (gameOver) {
      audioManager.play(isCorrect ? 'correct' : 'wrong')
      return
    }

    const monster = this.monsters.getChildren().find(m => m.getData('index') === monsterIndex)

    if (isCorrect) {
      if (monster) {
        monster.setData('defeated', true)
        this.tweens.add({
          targets: monster,
          alpha: 0,
          scale: 0,
          y: monster.y - 30,
          duration: 500,
          ease: 'Back.easeIn',
          onComplete: () => monster.destroy()
        })
        if (this.monsterLabels[monsterIndex]) {
          this.monsterLabels[monsterIndex].destroy()
          this.monsterLabels[monsterIndex] = null
        }
        this.spawnCoinEffect(monster.x, monster.y, score)
      }

      audioManager.play('correct')
      if (data.combo > 0 && data.combo % 5 === 0) audioManager.play('combo')

      // 先检查关卡是否完成，完成则不恢复游戏状态
      const levelDone = this.checkLevelComplete()
      if (!levelDone) {
        this.isPaused = false
        this.resetEncounterCooldown()
      }
    } else {
      audioManager.play('wrong')
      if (monster) {
        // If boss already defeated, mark monster as defeated anyway (answered wrong but progressing)
        if (this.boss && this.boss.defeated) {
          monster.setData('defeated', true)
          monster.setAlpha(0.3)
          if (this.monsterLabels[monsterIndex]) {
            this.monsterLabels[monsterIndex].setText('💀')
          }
          this.time.delayedCall(1000, () => {
            this.checkLevelComplete()
          })
        } else {
          // Normal wrong: monster goes semi-transparent then respawns
          monster.setAlpha(0.3)
          if (this.monsterLabels[monsterIndex]) {
            this.monsterLabels[monsterIndex].setText('💀')
          }
          this.time.delayedCall(2000, () => {
            if (monster && monster.active) {
              monster.setData('defeated', false)
              monster.setAlpha(1)
              if (this.monsterLabels[monsterIndex]) {
                this.monsterLabels[monsterIndex].setText('❓')
              }
            }
          })
        }
      }
      this.resetEncounterCooldown()
    }
  }

  onResumeGame() {
    if (!this.scene?.isActive()) return
    this.isPaused = false
    this.resetEncounterCooldown()
    this.resetNpcCooldown()
    audioManager.resumeBGM(300, 'quiz')
    audioManager.resumeBGM(300, 'default')
    // 恢复 Boss 行为
    if (this.boss && !this.boss.defeated && this.boss.resumeBehavior) {
      this.boss.resumeBehavior()
    }
  }

  onChatClosed() {
    if (!this.scene?.isActive()) return
    this.isPaused = false
    this.resetEncounterCooldown()
    this.resetNpcCooldown()
    audioManager.resumeBGM(300, 'chat')
    // 恢复 Boss 行为
    if (this.boss && !this.boss.defeated && this.boss.resumeBehavior) {
      this.boss.resumeBehavior()
    }
  }

  onGameOver(result) {
    if (!this.scene?.isActive() || this.isGameOverTransitioning) return
    this.isGameOverTransitioning = true
    const finalResult = result || levelManager.getLevelResult()
    this.isPaused = true
    this.encounterCooldown = true  // prevent any new encounters
    this.npcCooldown = true
    this.invincible = true  // prevent damage during transition
    this.input.enabled = false
    if (this.player?.body) this.player.setVelocity(0, 0)
    audioManager.stopBGM(0)
    // Pause boss
    if (this.boss && !this.boss.defeated && this.boss.pauseBehavior) {
      this.boss.pauseBehavior()
    }

    // 使用 game.scene.start 保持 WorldScene 运行（MenuScene 安全网会清理）
    // 这是已多次验证可行的最稳定方案，不引入 isActive/wake 等额外检查
    this.gameOverTransitionTimer = window.setTimeout(() => {
      // 先 wake ResultScene 确保数据刷新
      const rs = this.game.scene.getScene('ResultScene')
      if (rs && rs.scene.isSleeping()) { rs.scene.wake() }
      this.game.scene.start('ResultScene', finalResult)
      this.gameOverTransitionTimer = null
    }, 0)
  }

  resetEncounterCooldown() {
    this.time.delayedCall(500, () => {
      this.encounterCooldown = false
    })
  }

  resetNpcCooldown() {
    this.time.delayedCall(1500, () => {
      this.npcCooldown = false
    })
  }

  spawnCoinEffect(x, y, score) {
    audioManager.play('coin')
    for (let i = 0; i < 5; i++) {
      const coin = this.add.image(x, y, 'coin').setDepth(20).setScale(1.5)
      this.tweens.add({
        targets: coin,
        x: x + Phaser.Math.Between(-40, 40),
        y: y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        delay: i * 100,
        onComplete: () => coin.destroy()
      })
    }

    const displayScore = score || 100
    const scoreText = this.add.text(x, y - 20, `+${displayScore}`, {
      fontSize: '16px', fontFamily: '"Press Start 2P", Arial', color: '#ffc847', fontStyle: 'bold',
      stroke: '#5b3a1a', strokeThickness: 3
    }).setOrigin(0.5).setDepth(20)

    this.tweens.add({
      targets: scoreText,
      y: y - 60,
      alpha: 0,
      duration: 1000,
      onComplete: () => scoreText.destroy()
    })
  }

  update() {
    if (!this.player) return
    if (this.monsterAIs && this.monsters) {
      const children = this.monsters.getChildren()
      for (let i = 0; i < this.monsterAIs.length; i++) this.monsterAIs[i].update(this.player, this.game.loop.delta, this.timeScale)
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

  }

  shutdown() {
    if (this.escKey) this.escKey.removeAllListeners()
    this.input.enabled = false
    this.tweens.killAll()
    if (this.monsterLabels) { this.monsterLabels.forEach(l => { if (l?.active) l.destroy() }); this.monsterLabels = [] }
    this.monsterAIs = []
    if (this.mapContainer) { this.mapContainer.destroy(true); this.mapContainer = null }
    if (this.decoContainer) { this.decoContainer.destroy(true); this.decoContainer = null }
    this.monsters = null; this.npcs = null; this.walls = null
    this.player = null; this.playerNameText = null; this.hudTexts = {}
    this.children.removeAll(true)
  }
}
