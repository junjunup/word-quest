import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'
import { failedAssetKeys } from './BootScene'
import { CHARACTER_PRESETS } from '../data/characters'
import { createBoss, getBossTypeForLevel } from '../entities/BossFactory'
import levelsData from '../data/levels.json'
import audioManager from '../systems/AudioManager'
import { CHAPTER_THEMES, BOSS_SPAWN } from '../config/gameConstants'

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
    this.hudTexts = {}
    this.isPaused = false
    this.encounterCooldown = false
    this.playerDirection = 'down'
    this.invincible = false
  }

  init(data) {
    this.continueGame = data?.continueGame || false
    this.chapter = data?.chapter || levelManager.currentChapter || 1
    this.level = data?.level || levelManager.currentLevel || 1
    this.difficulty = data?.difficulty || 'normal'
    this.isTutorial = false
  }

  create() {
    const { width, height } = this.cameras.main
    this.isPaused = false
    this.encounterCooldown = false
    this.npcCooldown = false
    this.invincible = false

    // 生成田园地图
    this.createPastoralMap()

    // 创建玩家（使用 Sprout Lands 角色）
    this.createPlayer()

    // 创建怪物（使用小鸡 sprite）
    const wordCount = levelManager.getTotalWords()
    const baseCount = wordCount > 0 ? Math.min(wordCount, 10) : Math.min(6 + this.level, 10)
    this.monsterCount = levelManager.getMonsterCount(baseCount)
    this.createMonsters()

    // 创建NPC（使用奶牛 sprite）
    this.createNPC()

    // 创建Boss
    this.createBoss()

    // 创建HUD
    this.createHUD()

    // 输入控制
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    })

    // ESC key for pause menu
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => {
      if (!this.isPaused) {
        eventBus.emit(EVENTS.TOGGLE_PAUSE)
      }
    })

    // 碰撞检测
    this.physics.add.overlap(this.player, this.monsters, this.onMonsterEncounter, null, this)
    this.physics.add.overlap(this.player, this.npcs, this.onNPCInteract, null, this)

    // Boss碰撞
    if (this.boss) {
      this.physics.add.overlap(this.player, this.boss, this.onBossEncounter, null, this)

      // Turret boss bullet collision
      if (this.boss.bullets) {
        this.physics.add.overlap(this.player, this.boss.bullets, this.onBulletHit, null, this)
      }
    }

    // 监听Vue事件
    this.boundOnQuizAnswered = this.onQuizAnswered.bind(this)
    this.boundOnResumeGame = this.onResumeGame.bind(this)
    this.boundOnChatClosed = this.onChatClosed.bind(this)
    this.boundOnGameOver = this.onGameOver.bind(this)
    this.boundOnBossQuizResult = this.onBossQuizResult.bind(this)

    eventBus.on(EVENTS.QUIZ_ANSWERED, this.boundOnQuizAnswered)
    eventBus.on(EVENTS.RESUME_GAME, this.boundOnResumeGame)
    eventBus.on(EVENTS.CHAT_CLOSED, this.boundOnChatClosed)
    eventBus.on(EVENTS.GAME_OVER, this.boundOnGameOver)
    eventBus.on(EVENTS.BOSS_QUIZ_RESULT, this.boundOnBossQuizResult)

    // 注册 Phaser 场景 shutdown 事件，确保离开时清理监听器
    this.events.once('shutdown', this.shutdown, this)

    // 初始化音效系统
    audioManager.init(this)

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
      Math.hypot(bossX - playerSpawnX, bossY - playerSpawnY) < BOSS_SPAWN.minPlayerDistance
      && spawnAttempts < maxAttempts
    )

    this.boss = createBoss(this, bossX, bossY, {
      bossType,
      name: bossConfig.name,
      baseHp,
      speed: bossConfig.speed || 30,
      difficulty: this.difficulty
    })

    audioManager.play('boss_appear')
  }

  /**
   * Boss encounter - trigger boss quiz (1 question per contact)
   */
  onBossEncounter(player, boss) {
    if (!boss || boss.defeated || this.isPaused || this.encounterCooldown) return

    // For charging boss during charge state, deal damage instead
    if (boss.isCharging) {
      this.handleBossDamage()
      return
    }

    this.isPaused = true
    this.encounterCooldown = true
    player.setVelocity(0, 0)

    // Pause boss behavior
    if (boss.pauseBehavior) boss.pauseBehavior()

    // Boss 多轮答题：questionsNeeded = boss 当前 HP
    eventBus.emit(EVENTS.SHOW_BOSS_QUIZ, {
      bossName: boss.bossName,
      questionsNeeded: boss.hp,
      bossCurrentHp: boss.hp,
      bossMaxHp: boss.maxHp,
      timeLimit: levelManager.difficultyConfig.timer
    })
  }

  /**
   * Handle boss charging collision damage
   */
  handleBossDamage() {
    if (this.invincible) return
    if (levelManager.lives <= 0) return  // 防止多重命中导致负生命值

    const result = levelManager.loseLife()
    this.startInvincibility()

    // Bounce player away from boss
    if (this.boss && this.player) {
      const dx = this.player.x - this.boss.x
      const dy = this.player.y - this.boss.y
      const dist = Math.hypot(dx, dy) || 1
      this.player.setVelocity((dx / dist) * 300, (dy / dist) * 300)
      this.time.delayedCall(200, () => {
        if (this.player?.active) this.player.setVelocity(0, 0)
      })
    }

    if (result === 'game_over') return
  }

  /**
   * Bullet hit player
   */
  onBulletHit(player, bullet) {
    if (this.invincible || !bullet.active) return
    if (levelManager.lives <= 0) return  // 防止多重命中导致负生命值

    bullet.setActive(false).setVisible(false)
    bullet.body.enable = false

    const result = levelManager.loseLife()
    this.startInvincibility()

    if (result === 'game_over') return
  }

  /**
   * Start 2-second invincibility with flashing
   */
  startInvincibility() {
    if (this.invincible) return  // prevent tween stacking
    this.invincible = true

    // Flash player
    this.tweens.add({
      targets: this.player,
      alpha: { from: 0.3, to: 1 },
      duration: 150,
      yoyo: true,
      repeat: 6,
      onComplete: () => {
        if (this.player?.active) this.player.setAlpha(1)
        this.invincible = false
      }
    })
  }

  /**
   * Boss quiz result handler
   */
  onBossQuizResult(result) {
    if (!this.scene?.isActive()) return
    if (!this.boss || this.boss.defeated) {
      this.isPaused = false
      this.resetEncounterCooldown()
      return
    }

    const { correctCount, wrongCount, defeated, cancelled } = result

    if (cancelled) {
      // Quiz cancelled, bounce player away
      if (this.boss.resumeBehavior) this.boss.resumeBehavior()
      this.bouncePlayerFromBoss()
      this.isPaused = false
      this.resetEncounterCooldown()
      return
    }

    // Apply damage for each correct answer
    for (let i = 0; i < correctCount; i++) {
      if (!this.boss.defeated) {
        this.boss.takeDamage()
      }
    }

    // Apply life loss for wrong answers (loseLife already emits UPDATE_HUD)
    if (wrongCount > 0) {
      for (let i = 0; i < wrongCount; i++) {
        const lifeResult = levelManager.loseLife()
        if (lifeResult === 'game_over') return
      }
    }

    if (this.boss.defeated) {
      audioManager.play('boss_defeat')
      levelManager.bossDefeated = true
      // Add boss defeat score bonus (apply difficulty multiplier)
      const bossBonus = Math.round(500 * levelManager.difficultyConfig.scoreMultiplier)
      levelManager.score += bossBonus
      eventBus.emit(EVENTS.UPDATE_HUD, {
        score: levelManager.score,
        lives: levelManager.lives,
        combo: levelManager.combo
      })
      this.checkLevelComplete()
    } else {
      // Boss survived, bounce player away
      if (this.boss.resumeBehavior) this.boss.resumeBehavior()
      this.bouncePlayerFromBoss()
    }

    this.isPaused = false
    this.resetEncounterCooldown()
  }

  bouncePlayerFromBoss() {
    if (!this.boss || !this.player) return
    const dx = this.player.x - this.boss.x
    const dy = this.player.y - this.boss.y
    const dist = Math.hypot(dx, dy) || 1
    this.player.setVelocity((dx / dist) * 300, (dy / dist) * 300)
    this.time.delayedCall(200, () => {
      if (this.player?.active) this.player.setVelocity(0, 0)
    })
  }

  /**
   * Check if level is complete (all monsters + boss defeated)
   */
  checkLevelComplete() {
    const remainingMonsters = this.monsters.getChildren().filter(m => !m.getData('defeated'))
    const bossDefeated = !this.boss || this.boss.defeated

    if (remainingMonsters.length === 0 && bossDefeated) {
      this.isPaused = true
      this.input.enabled = false  // 防止过渡期间幽灵点击
      audioManager.play('level_complete')
      this.time.delayedCall(1000, () => {
        this.scene.start('ResultScene', levelManager.getLevelResult())
      })
    }
  }

  /**
   * 创建田园风格地图
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
      monster.setData('defeated', false)
      monster.setImmovable(true)
      monster.setDepth(5)

      this.tweens.add({
        targets: monster,
        y: monster.y - 5,
        duration: 1000 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })

      const label = this.add.text(positions[i].x, positions[i].y - 28, '❓', {
        fontSize: '16px',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(6)
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
    const { monsterIndex, isCorrect, score } = data

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
        }
        this.spawnCoinEffect(monster.x, monster.y, score)
      }

      audioManager.play('correct')
      if (data.combo > 0 && data.combo % 5 === 0) audioManager.play('combo')

      this.isPaused = false
      this.resetEncounterCooldown()

      // Check level complete
      this.checkLevelComplete()
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
  }

  onChatClosed() {
    if (!this.scene?.isActive()) return
    this.isPaused = false
    this.resetEncounterCooldown()
    this.resetNpcCooldown()
  }

  onGameOver(result) {
    if (!this.scene?.isActive()) return
    this.isPaused = true
    this.encounterCooldown = true  // prevent any new encounters
    this.invincible = true  // prevent damage during transition
    // Pause boss
    if (this.boss && !this.boss.defeated && this.boss.pauseBehavior) {
      this.boss.pauseBehavior()
    }
    this.time.delayedCall(500, () => {
      this.scene.start('ResultScene', result || levelManager.getLevelResult())
    })
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
    if (this.isPaused || !this.player) return

    const speed = 160
    let vx = 0
    let vy = 0
    let moving = false
    let direction = this.playerDirection

    if (this.cursors.left.isDown || this.wasd.left.isDown) { vx = -speed; direction = 'left'; moving = true }
    else if (this.cursors.right.isDown || this.wasd.right.isDown) { vx = speed; direction = 'right'; moving = true }

    if (this.cursors.up.isDown || this.wasd.up.isDown) { vy = -speed; direction = 'up'; moving = true }
    else if (this.cursors.down.isDown || this.wasd.down.isDown) { vy = speed; direction = 'down'; moving = true }

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

    // Update boss
    if (this.boss && !this.boss.defeated) {
      this.boss.update()
    }
  }

  shutdown() {
    eventBus.off(EVENTS.QUIZ_ANSWERED, this.boundOnQuizAnswered)
    eventBus.off(EVENTS.RESUME_GAME, this.boundOnResumeGame)
    eventBus.off(EVENTS.CHAT_CLOSED, this.boundOnChatClosed)
    eventBus.off(EVENTS.GAME_OVER, this.boundOnGameOver)
    eventBus.off(EVENTS.BOSS_QUIZ_RESULT, this.boundOnBossQuizResult)

    // 禁用输入，防止场景切换时幽灵点击穿透
    this.input.enabled = false

    // Kill all tweens to prevent callbacks firing after scene shutdown
    this.tweens.killAll()

    // Clean up monster labels
    if (this.monsterLabels) {
      this.monsterLabels.forEach(label => { if (label?.active) label.destroy() })
      this.monsterLabels = []
    }

    // Unconditionally cleanup boss (whether defeated or not)
    if (this.boss) {
      // Prevent defeat animation from firing post-shutdown
      this.boss.defeated = true
      this.boss.cleanupVisuals()
      if (this.boss.active) this.boss.destroy()
      this.boss = null
    }
  }
}
