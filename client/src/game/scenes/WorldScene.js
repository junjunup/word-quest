import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'
import { failedAssetKeys } from './BootScene'

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
    this.hudTexts = {}
    this.isPaused = false
    this.encounterCooldown = false
    this.playerDirection = 'down' // 当前朝向
  }

  init(data) {
    this.continueGame = data?.continueGame || false
    this.chapter = data?.chapter || levelManager.currentChapter || 1
    this.level = data?.level || levelManager.currentLevel || 1
  }

  create() {
    const { width, height } = this.cameras.main
    // 田园绿色背景
    this.cameras.main.setBackgroundColor('#4a8c28')
    this.isPaused = false
    this.encounterCooldown = false
    this.npcCooldown = false

    // 生成田园地图
    this.createPastoralMap()

    // 创建玩家（使用 Sprout Lands 角色）
    this.createPlayer()

    // 创建怪物（使用小鸡 sprite）
    const wordCount = levelManager.getTotalWords()
    this.monsterCount = wordCount > 0 ? Math.min(wordCount, 10) : Math.min(6 + this.level, 10)
    this.createMonsters()

    // 创建NPC（使用奶牛 sprite）
    this.createNPC()

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

    // 碰撞检测
    this.physics.add.overlap(this.player, this.monsters, this.onMonsterEncounter, null, this)
    this.physics.add.overlap(this.player, this.npcs, this.onNPCInteract, null, this)

    // 监听Vue事件
    this.boundOnQuizAnswered = this.onQuizAnswered.bind(this)
    this.boundOnResumeGame = this.onResumeGame.bind(this)
    this.boundOnChatClosed = this.onChatClosed.bind(this)
    this.boundOnGameOver = this.onGameOver.bind(this)

    eventBus.on(EVENTS.QUIZ_ANSWERED, this.boundOnQuizAnswered)
    eventBus.on(EVENTS.RESUME_GAME, this.boundOnResumeGame)
    eventBus.on(EVENTS.CHAT_CLOSED, this.boundOnChatClosed)
    eventBus.on(EVENTS.GAME_OVER, this.boundOnGameOver)

    // 注册 Phaser 场景 shutdown 事件，确保离开时清理监听器
    this.events.once('shutdown', this.shutdown, this)

    // 通知 Vue 层当前关卡信息
    eventBus.emit(EVENTS.START_LEVEL, {
      chapter: this.chapter,
      level: this.level,
      continueGame: this.continueGame
    })

    // 发送初始HUD数据
    eventBus.emit(EVENTS.UPDATE_HUD, {
      lives: levelManager.lives,
      score: levelManager.score,
      combo: levelManager.combo,
      chapter: this.chapter,
      level: this.level,
      progress: levelManager.getProgress()
    })
  }

  /**
   * 创建田园风格地图
   * - 多种草地瓦片随机变化
   * - 木栅栏边界
   * - 装饰物散布（花、蘑菇、石头、树）
   */
  createPastoralMap() {
    const mapWidth = 30
    const mapHeight = 20
    const tileSize = 32 // 显示尺寸（16px 素材 x2 缩放）

    this.mapContainer = this.add.container(0, 0)
    this.decoContainer = this.add.container(0, 0).setDepth(2)

    const isValid = (key) => this.textures.exists(key) && !failedAssetKeys.has(key)
    const hasGrassTileset = isValid('grass_tileset')
    const hasFenceSheet = isValid('fence_sheet')
    const hasGrassDecor = isValid('grass_decor')

    // === 预生成草地变种纹理（从 tileset 裁剪） ===
    if (hasGrassTileset && !this.textures.exists('grass_v0')) {
      const grassSource = this.textures.get('grass_tileset').getSourceImage()
      for (let v = 0; v < 4; v++) {
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const ctx = canvas.getContext('2d')
        // Grass.png 中心纯草地区域: 从 (48,32) 开始的 2x2 格
        const sx = 48 + (v % 2) * 16
        const sy = 32 + Math.floor(v / 2) * 16
        ctx.drawImage(grassSource, sx, sy, 16, 16, 0, 0, 16, 16)
        this.textures.addCanvas(`grass_v${v}`, canvas)
      }
    }

    // === 铺设草地 ===
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const px = x * tileSize + 16
        const py = y * tileSize + 16
        const isWall = (y === 0 || y === mapHeight - 1 || x === 0 || x === mapWidth - 1)

        if (isWall) {
          // 栅栏边界
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
          // 草地 - 使用预生成的变种纹理
          if (hasGrassTileset && this.textures.exists('grass_v0')) {
            const v = Phaser.Math.Between(0, 3)
            const tile = this.add.image(px, py, `grass_v${v}`).setScale(2)
            this.mapContainer.add(tile)
          } else {
            // Fallback 草地 - 多种绿色变种
            const grassColors = [0x5b8c3e, 0x4a8c28, 0x6b9c4e, 0x5a9a38]
            const color = grassColors[Phaser.Math.Between(0, grassColors.length - 1)]
            const tile = this.add.rectangle(px, py, tileSize, tileSize, color)
            this.mapContainer.add(tile)
          }
        }
      }
    }

    // === 散布装饰物 ===
    this.addDecorations(mapWidth, mapHeight, tileSize, hasGrassDecor)

    // === 边界物理体 ===
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

  /**
   * 在地图上随机散布田园装饰物
   */
  addDecorations(mapWidth, mapHeight, tileSize, hasGrassDecor) {
    const decoCount = 40 // 装饰物数量
    const padding = 2 // 距边界的距离（格子数）

    for (let i = 0; i < decoCount; i++) {
      const gx = Phaser.Math.Between(padding, mapWidth - padding - 1)
      const gy = Phaser.Math.Between(padding, mapHeight - padding - 1)
      const px = gx * tileSize + 16
      const py = gy * tileSize + 16

      // 避开玩家出生点和NPC区域
      if (Math.hypot(px - 80, py - 300) < 100) continue
      if (Math.hypot(px - 700, py - 300) < 100) continue

      if (hasGrassDecor) {
        // 从 grass_decor spritesheet 中选择装饰
        // 帧布局 (9x5 grid of 16x16):
        // Row 0: 大树(0-2), 小树(3-5), 花(6-8)
        // Row 1: 蘑菇(9-11), 石头(12-14), 灌木(15-17)
        // Row 2-4: 其他装饰
        const decoFrames = [0, 3, 6, 7, 8, 9, 12, 15, 18, 21, 24, 27]
        const frame = decoFrames[Phaser.Math.Between(0, decoFrames.length - 1)]
        const deco = this.add.image(px, py, 'grass_decor', frame).setScale(2)
        deco.setAlpha(0.9)
        this.decoContainer.add(deco)
      } else {
        // Fallback 装饰 - 用简单图形
        const decoType = Phaser.Math.Between(0, 3)
        let deco
        switch (decoType) {
          case 0: // 花朵
            deco = this.add.circle(px, py, 4, 0xff9999)
            break
          case 1: // 蘑菇
            deco = this.add.circle(px, py, 5, 0xd4a373)
            break
          case 2: // 石头
            deco = this.add.circle(px, py, 6, 0x999999)
            break
          case 3: // 草丛
            deco = this.add.rectangle(px, py, 10, 8, 0x3a6b1e)
            break
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
      // 设置碰撞体积（角色在48x48帧中较小）
      this.player.body.setSize(16, 16)
      this.player.body.setOffset(16, 24)
    } else {
      this.player = this.physics.add.sprite(80, 300, 'player')
      this.player.setScale(1.2)
    }

    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    // 播放默认朝下idle动画
    if (this.hasPlayerSheet && this.anims.exists('player_idle_down')) {
      this.player.play('player_idle_down')
    }

    this.playerNameText = this.add.text(0, 0, '🌿 勇者', {
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
        // 播放小鸡动画
        if (this.anims.exists('chicken_idle')) {
          monster.play('chicken_idle')
        }
      } else {
        monster = this.monsters.create(positions[i].x, positions[i].y, 'monster')
        monster.setScale(1.2)
      }

      monster.setData('index', i)
      monster.setData('defeated', false)
      monster.setImmovable(true)
      monster.setDepth(5)

      // 怪物浮动动画
      this.tweens.add({
        targets: monster,
        y: monster.y - 5,
        duration: 1000 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })

      // 问号标识 - 像素风格
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
    // HUD 由 Vue 层 (GameView.vue) 渲染，Phaser 只显示底部操作提示
    this.add.text(480, 620, '🌿 方向键/WASD 移动  |  接触小鸡答题  |  找到小智获得帮助', {
      fontSize: '10px', fontFamily: 'Microsoft YaHei', color: '#3a6b1e',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100)
  }

  /**
   * 生成有最小间距保证的随机位置
   */
  generateSpacedPositions(count, minX, maxX, minY, maxY, minDist, excludeZones = []) {
    const positions = []
    const maxAttempts = 100
    const excludeDist = 80

    for (let i = 0; i < count; i++) {
      let placed = false
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = Phaser.Math.Between(minX, maxX)
        const y = Phaser.Math.Between(minY, maxY)
        const tooCloseToOther = positions.some(p =>
          Math.hypot(p.x - x, p.y - y) < minDist
        )
        const tooCloseToExcluded = excludeZones.some(p =>
          Math.hypot(p.x - x, p.y - y) < excludeDist
        )
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

    // 用速度脉冲弹开玩家（保持物理碰撞，避免穿墙）
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
    const { monsterIndex, isCorrect, score } = data

    const monster = this.monsters.getChildren().find(m => m.getData('index') === monsterIndex)

    if (isCorrect) {
      if (monster) {
        monster.setData('defeated', true)
        // 消灭动画 - 弹跳消失
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

      this.isPaused = false
      this.resetEncounterCooldown()

      const remainingMonsters = this.monsters.getChildren().filter(m => !m.getData('defeated'))
      if (remainingMonsters.length === 0) {
        this.isPaused = true
        this.time.delayedCall(1000, () => {
          this.scene.start('ResultScene', levelManager.getLevelResult())
        })
      }
    } else {
      // 答错：怪物暂时变暗，2秒后恢复可交互（错词重测）
      if (monster) {
        monster.setAlpha(0.3)
        if (this.monsterLabels[monsterIndex]) {
          this.monsterLabels[monsterIndex].setText('💀')
        }
        // 2秒后恢复怪物，允许重新答题
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
      this.resetEncounterCooldown()
    }

    this.updateHUD(data)
  }

  onResumeGame() {
    this.isPaused = false
    this.resetEncounterCooldown()
    this.resetNpcCooldown()
  }

  onChatClosed() {
    this.isPaused = false
    this.resetEncounterCooldown()
    this.resetNpcCooldown()
  }

  onGameOver(result) {
    this.isPaused = true
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

  updateHUD(data) {
    // HUD 更新由 Vue 层处理，通过 eventBus 传递数据即可
    // WorldScene 不再维护 Phaser HUD 元素
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

    // 对角线移动向量归一化，防止对角线速度 +41%
    if (vx !== 0 && vy !== 0) {
      const factor = Math.SQRT1_2 // 1/√2 ≈ 0.707
      vx *= factor
      vy *= factor
    }

    this.player.setVelocity(vx, vy)

    // 切换角色动画（hasPlayerSheet 在 create 中已缓存）
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
  }

  shutdown() {
    eventBus.off(EVENTS.QUIZ_ANSWERED, this.boundOnQuizAnswered)
    eventBus.off(EVENTS.RESUME_GAME, this.boundOnResumeGame)
    eventBus.off(EVENTS.CHAT_CLOSED, this.boundOnChatClosed)
    eventBus.off(EVENTS.GAME_OVER, this.boundOnGameOver)
  }
}
