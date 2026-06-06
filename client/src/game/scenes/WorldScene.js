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
    this.boss = null
    this.monsterAIs = []
    this.playerDirection = 'down'
    this.isPaused = false
    this.gameOverTransitionTimer = null
    this.invincible = false
    this.continueGame = data?.continueGame || false
    this.chapter = data?.chapter || levelManager.currentChapter || 1
    this.timeScale = 1.0
    this.targetLocked = false
    this.lockedTarget = null
    this.inputBuffer = ''
    this.virtualDirection = { up: false, down: false, left: false, right: false }
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
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
    this.createHUD()
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
    this.escKey.on('down', this.boundOnEscDown)

    // 碰撞检测
    this.physics.add.overlap(this.player, this.monsters, this.onMonsterEncounter, null, this)
    this.physics.add.overlap(this.player, this.npcs, this.onNPCInteract, null, this)
    // 玩家与围墙碰撞（walls 在 createPastoralMap 中创建）
    if (this.walls) {
      this.physics.add.collider(this.player, this.walls)
    }

    // Boss碰撞
    if (this.boss) {
      this.physics.add.overlap(this.player, this.boss, this.onBossEncounter, null, this)
    this.physics.add.overlap(this.player, this.monsters, this._onMonsterHit, null, this)
      // Turret boss bullet collision
      if (this.boss.bullets) {
        this.physics.add.overlap(this.player, this.boss.bullets, this.onBulletHit, null, this)
      }
    }
    eventBus.on(EVENTS.CHAT_CLOSED, this.boundOnChatClosed)
    eventBus.on(EVENTS.GAME_OVER, this.boundOnGameOver)
    // Quiz events removed - using direct combat system
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
  createBoss() {
    // Get level config from levels.json
    const chapterData = levelsData.chapters.find(c => c.id === this.chapter)
    const levelData = chapterData?.levels.find(l => l.id === this.level)

    if (!levelData) return

    // 检测教程关
    this.isTutorial = levelData.isTutorial || false
    if (this.isTutorial) return  // 教程关无 Boss

    const bossType = levelData.bossType || getBossTypeForLevel(this.chapter, this.level)
    const bossConfig = levelData.bossConfig || { name: 'Boss', baseHp: 3, speed: 30 }

    // Adjust boss HP for difficulty
    let baseHp = bossConfig.baseHp || 3
    if (this.difficulty === 'hard') baseHp += 2
    if (this.difficulty === 'easy') baseHp = Math.max(2, baseHp - 1)

    // Boss spawn: pick random zone with minimum distance enforcement
    const playerSpawnX = 80, playerSpawnY = 300
    let bossX, bossY
    let spawnAttempts = 0
    const maxAttempts = 20

    do {
      const zone = BOSS_SPAWN.zones[Phaser.Math.Between(0, BOSS_SPAWN.zones.length - 1)]
      bossX = Phaser.Math.Between(zone.minX, zone.maxX)
      bossY = Phaser.Math.Between(zone.minY, zone.maxY)
      spawnAttempts++
    } while (
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

  createMonsters() {
    this.monsters = this.physics.add.group()
    this.monsterLabels = []

    const positions = this.generateSpacedPositions(
      this.monsterCount, 180, 600, 80, 550, 60,
      [{ x: 80, y: 300 }, { x: 700, y: 300 }]
    )

    const isValid = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasChicken = isValid('chicken_sheet')

    for (let i = 0; i < this.monsterCount; i++) {
      let monster
      if (hasChicken) {
        monster = this.monsters.create(positions[i].x, positions[i].y, 'chicken_sheet', 0)
        monster.setScale(3.5)
        // 缩小碰撞箱到小鸡身体中心区域（原始帧 16x16，取中间 10x10）
        monster.body.setSize(10, 10)
        monster.body.setOffset(3, 4)
        if (this.anims.exists('chicken_idle')) {
          monster.play('chicken_idle')
        }
      } else {
        monster = this.monsters.create(positions[i].x, positions[i].y, 'monster')
        monster.setScale(1.2)
        monster.body.setSize(20, 20)
        monster.body.setOffset(6, 6)
      }

      monster.setData('index', i)

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

  update() {
    if (!this.player) return
    if (this.monsterAIs && this.monsters) {
      const children = this.monsters.getChildren()
      for (let i = 0; i < this.monsterAIs.length; i++) this.monsterAIs[i].update(this.player, this.game.loop.delta, this.timeScale)
    }
    if (!this.isPaused && !this.targetLocked) {

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
    // replaced
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
