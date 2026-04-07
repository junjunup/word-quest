import Phaser from 'phaser'

// 全局追踪加载失败的素材key，供其他场景使用
export const failedAssetKeys = new Set()

/**
 * 启动加载场景 - 加载 Sprout Lands 田园像素风素材
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // 田园绿色背景
    this.cameras.main.setBackgroundColor('#2d5016')

    // 标题文字
    this.add.text(width / 2, height / 2 - 80, '词汇大冒险', {
      fontSize: '36px',
      fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#ffc847',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 2 - 40, 'WORD QUEST', {
      fontSize: '16px',
      fontFamily: '"Press Start 2P", Arial',
      color: '#c4b99a'
    }).setOrigin(0.5)

    // 进度条背景 - 木纹风格
    const progressBg = this.add.rectangle(width / 2, height / 2 + 20, 400, 20, 0x5b3a1a)
    progressBg.setStrokeStyle(3, 0x8b6914)

    // 进度条 - 自然绿色
    const progressBar = this.add.rectangle(width / 2 - 198, height / 2 + 20, 0, 16, 0x5b8c3e)
    progressBar.setOrigin(0, 0.5)

    // 进度文字
    const loadText = this.add.text(width / 2, height / 2 + 60, '正在进入田园世界...', {
      fontSize: '14px',
      fontFamily: 'Microsoft YaHei',
      color: '#c4b99a'
    }).setOrigin(0.5)

    // 监听加载进度
    this.load.on('progress', (value) => {
      progressBar.width = 396 * value
      loadText.setText(`正在进入田园世界... ${Math.round(value * 100)}%`)
    })

    this.load.on('complete', () => {
      loadText.setText('欢迎来到田园世界！')
    })

    // ---- 加载 Sprout Lands 素材 ----
    this.loadSproutLandsAssets()

    // ---- 加载 Sprout Lands UI 素材 ----
    this.loadSproutLandsUI()
  }

  /**
   * 加载 Sprout Lands 素材包
   * 素材路径基于 public/assets/sprout-lands/Sprout Lands - Sprites - Basic pack/
   */
  loadSproutLandsAssets() {
    const basePath = '/assets/sprout-lands/Sprout Lands - Sprites - Basic pack'

    // === 角色 spritesheets ===
    // Basic Charakter Spritesheet: 192x192, 每帧 48x48（角色在 48x48 画布中居中的 16x16 像素角色）
    // 实际上是 48x48 帧，4列 x 4行 = 16帧
    // Row 0: 面朝下静止 (4帧idle)
    // Row 1: 面朝上静止 (4帧idle)
    // Row 2: 面朝左静止 (4帧idle)
    // Row 3: 面朝右静止 (4帧idle)
    this.load.spritesheet('player_sheet', `${basePath}/Characters/Basic Charakter Spritesheet.png`, {
      frameWidth: 48,
      frameHeight: 48
    })

    // Basic Charakter Actions: 96x576 → 2列 x 12行 of 48x48
    // Contains various action animations (watering, chopping, etc.)
    this.load.spritesheet('player_actions', `${basePath}/Characters/Basic Charakter Actions.png`, {
      frameWidth: 48,
      frameHeight: 48
    })

    // === 动物（用作怪物/NPC） ===
    // Chicken: 64x32 → 4列 x 2行 of 16x16
    this.load.spritesheet('chicken_sheet', `${basePath}/Characters/Free Chicken Sprites.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Cow: 96x64 → 3列 x 2行 of 32x32
    this.load.spritesheet('cow_sheet', `${basePath}/Characters/Free Cow Sprites.png`, {
      frameWidth: 32,
      frameHeight: 32
    })

    // === 地形瓦片 ===
    // Grass tileset: 176x112 (complex tileset for autotiling)
    this.load.image('grass_tileset', `${basePath}/Tilesets/Grass.png`)

    // Fences: 64x64
    this.load.spritesheet('fence_sheet', `${basePath}/Tilesets/Fences.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Water: 64x16 → 4帧 of 16x16
    this.load.spritesheet('water_sheet', `${basePath}/Tilesets/Water.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Doors: 16x64 → 1列 x 4行 of 16x16
    this.load.spritesheet('door_sheet', `${basePath}/Tilesets/Doors.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Hills: 176x144
    this.load.image('hills_tileset', `${basePath}/Tilesets/Hills.png`)

    // === 装饰物 ===
    // Grass biome decorations: 144x80 → 9列 x 5行 of 16x16
    this.load.spritesheet('grass_decor', `${basePath}/Objects/Basic_Grass_Biom_things.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Plants: 96x32 → 6列 x 2行 of 16x16
    this.load.spritesheet('plants_sheet', `${basePath}/Objects/Basic_Plants.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Chest: 240x96 → 10列 x 4行 of 24x24
    // Actually: 240/5=48 per chest, 96/2=48, so 48x48 frames? Let's do 48x48
    this.load.spritesheet('chest_sheet', `${basePath}/Objects/Chest.png`, {
      frameWidth: 48,
      frameHeight: 48
    })

    // Wooden house
    this.load.image('wooden_house', `${basePath}/Tilesets/Wooden House.png`)

    // Tools and materials: 48x32 → 3列 x 2行 of 16x16
    this.load.spritesheet('tools_sheet', `${basePath}/Objects/Basic_tools_and_meterials.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Furniture: 144x96
    this.load.spritesheet('furniture_sheet', `${basePath}/Objects/Basic_Furniture.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // === 错误处理：追踪加载失败的素材 key ===
    this.failedKeys = failedAssetKeys
    this.load.on('loaderror', (file) => {
      console.warn(`素材加载失败: ${file.key}, 将使用占位图`)
      failedAssetKeys.add(file.key)
    })

    // === 音效加载 ===
    const sfxKeys = ['correct', 'wrong', 'boss_appear', 'boss_defeat', 'combo', 'coin', 'level_complete', 'click']
    sfxKeys.forEach(key => {
      this.load.audio(key, `/assets/audio/${key}.mp3`)
    })
  }

  /**
   * 加载 Sprout Lands UI 素材包
   * 素材路径基于 public/assets/sprout-lands-ui/Sprout Lands - UI Pack - Basic pack/
   */
  loadSproutLandsUI() {
    const uiPath = '/assets/sprout-lands-ui/Sprout Lands - UI Pack - Basic pack'

    // 对话框
    this.load.image('dialog_box', `${uiPath}/Sprite sheets/Dialouge UI/dialog box.png`)
    this.load.image('dialog_box_big', `${uiPath}/Sprite sheets/Dialouge UI/Premade dialog box  big.png`)
    this.load.image('dialog_box_medium', `${uiPath}/Sprite sheets/Dialouge UI/Premade dialog box medium.png`)

    // 按钮: UI Big Play Button 192x64 → 2x2 grid of 96x32
    this.load.spritesheet('ui_play_btn', `${uiPath}/Sprite sheets/UI Big Play Button.png`, {
      frameWidth: 96,
      frameHeight: 32
    })

    // 方形按钮 26x26: 96x192 → 2列(normal+pressed) x ? 行(颜色变种)
    this.load.spritesheet('ui_square_btn', `${uiPath}/Sprite sheets/buttons/Square Buttons 26x26.png`, {
      frameWidth: 48,
      frameHeight: 48
    })

    // 小方形按钮: 32x128 → 2列 x 8行 of 16x16
    this.load.spritesheet('ui_small_btn', `${uiPath}/Sprite sheets/buttons/Small Square Buttons.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // 图标集: 288x48 → 18列 x 3行 of 16x16
    this.load.spritesheet('ui_icons', `${uiPath}/Sprite sheets/Icons/All Icons.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // 特殊图标（星星、心、金币）: 112x64 → 7列 x 4行 of 16x16
    this.load.spritesheet('ui_special_icons', `${uiPath}/Sprite sheets/Icons/special icons/Special Icons.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // 心形血量条: 112x336
    this.load.image('ui_hearts_sheet', `${uiPath}/emojis-free/emoji style ui/Inventory_Herat_Spritesheet.png`)

    // 表情气泡
    this.load.image('speech_bubble', `${uiPath}/emojis-free/speech_bubble_grey.png`)

    // 设置面板背景
    this.load.image('ui_panel', `${uiPath}/Sprite sheets/Setting menu.png`)

    // 表情动画
    this.load.spritesheet('emote_sheet', `${uiPath}/Sprite sheets/Dialouge UI/Emotes/Teemo Basic emote animations sprite sheet.png`, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Sprout Lands 像素字体 (TTF)
    // 注意：字体需要通过 CSS @font-face 加载，不是 Phaser loader
  }

  create() {
    // 创建动画
    this.createAnimations()

    // 生成占位素材（用于加载失败的 fallback，以及 UI 元素）
    this.generateUIAssets()

    // After generating fallback textures, create simple fallback animations
    this.createFallbackAnimations()

    // 短暂延迟后进入菜单
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene')
    })
  }

  /**
   * 检查素材是否真正可用（已加载且未失败）
   * Phaser 对加载失败的纹理也会 textures.exists() 返回 true
   */
  isAssetValid(key) {
    return this.textures.exists(key) && !this.failedKeys.has(key)
  }

  /**
   * 创建角色动画
   */
  createAnimations() {
    // === 玩家角色动画 (Basic Charakter Spritesheet: 4x4 grid of 48x48) ===
    // Row 0 (frames 0-3): idle down
    // Row 1 (frames 4-7): idle up
    // Row 2 (frames 8-11): idle left
    // Row 3 (frames 12-15): idle right

    if (this.isAssetValid('player_sheet')) {
      // 朝下idle
      this.anims.create({
        key: 'player_idle_down',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      })

      // 朝上idle
      this.anims.create({
        key: 'player_idle_up',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 4, end: 7 }),
        frameRate: 6,
        repeat: -1
      })

      // 朝左idle/walk
      this.anims.create({
        key: 'player_idle_left',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 8, end: 11 }),
        frameRate: 6,
        repeat: -1
      })

      // 朝右idle/walk
      this.anims.create({
        key: 'player_idle_right',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 12, end: 15 }),
        frameRate: 6,
        repeat: -1
      })

      // Walk animations (use same frames at higher framerate for walking feel)
      this.anims.create({
        key: 'player_walk_down',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      })
      this.anims.create({
        key: 'player_walk_up',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 4, end: 7 }),
        frameRate: 10,
        repeat: -1
      })
      this.anims.create({
        key: 'player_walk_left',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 8, end: 11 }),
        frameRate: 10,
        repeat: -1
      })
      this.anims.create({
        key: 'player_walk_right',
        frames: this.anims.generateFrameNumbers('player_sheet', { start: 12, end: 15 }),
        frameRate: 10,
        repeat: -1
      })
    }

    // === 小鸡动画 (用作怪物) ===
    if (this.isAssetValid('chicken_sheet')) {
      this.anims.create({
        key: 'chicken_idle',
        frames: this.anims.generateFrameNumbers('chicken_sheet', { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      })
    }

    // === 奶牛动画 (用作NPC) ===
    if (this.isAssetValid('cow_sheet')) {
      this.anims.create({
        key: 'cow_idle',
        frames: this.anims.generateFrameNumbers('cow_sheet', { start: 0, end: 2 }),
        frameRate: 3,
        repeat: -1
      })
    }

    // === 水流动画 ===
    if (this.isAssetValid('water_sheet')) {
      this.anims.create({
        key: 'water_flow',
        frames: this.anims.generateFrameNumbers('water_sheet', { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      })
    }
  }

  /**
   * 生成 UI 素材和 fallback 占位素材
   * 使用田园像素风配色
   */
  generateUIAssets() {
    // --- 如果 spritesheet 加载失败，生成 fallback 的单帧纹理 ---
    if (!this.isAssetValid('player_sheet')) {
      // Fallback 玩家角色
      const pg = this.make.graphics({ add: false })
      pg.fillStyle(0x5b8c3e, 1)
      pg.fillRect(8, 8, 32, 32)
      pg.fillStyle(0xf5edd6, 1)
      pg.fillRect(16, 16, 6, 6)
      pg.fillRect(26, 16, 6, 6)
      pg.fillStyle(0xffc847, 1)
      pg.fillRect(12, 8, 24, 6)
      pg.generateTexture('player', 48, 48)
      pg.destroy()
    }

    if (!this.isAssetValid('chicken_sheet')) {
      // Fallback 怪物
      const mg = this.make.graphics({ add: false })
      mg.fillStyle(0xd45b3e, 1)
      mg.fillRect(2, 2, 28, 28)
      mg.fillStyle(0xffc847, 1)
      mg.fillRect(8, 8, 6, 6)
      mg.fillRect(18, 8, 6, 6)
      mg.generateTexture('monster', 32, 32)
      mg.destroy()
    }

    if (!this.isAssetValid('cow_sheet')) {
      // Fallback NPC
      const ng = this.make.graphics({ add: false })
      ng.fillStyle(0x7eb55e, 1)
      ng.fillRect(2, 2, 28, 28)
      ng.fillStyle(0xf5edd6, 1)
      ng.fillRect(8, 8, 6, 6)
      ng.fillRect(18, 8, 6, 6)
      ng.generateTexture('npc', 32, 32)
      ng.destroy()
    }

    // --- Grass tile fallback ---
    if (!this.isAssetValid('grass_tileset')) {
      const tg = this.make.graphics({ add: false })
      tg.fillStyle(0x5b8c3e, 1)
      tg.fillRect(0, 0, 16, 16)
      tg.generateTexture('grass_tile', 16, 16)
      tg.destroy()
    }

    // --- Fence fallback ---
    if (!this.isAssetValid('fence_sheet')) {
      const wg = this.make.graphics({ add: false })
      wg.fillStyle(0x8b6914, 1)
      wg.fillRect(0, 0, 16, 16)
      wg.lineStyle(1, 0x5b3a1a)
      wg.strokeRect(0, 0, 16, 16)
      wg.generateTexture('wall_tile', 16, 16)
      wg.destroy()
    }

    // --- 门 fallback ---
    if (!this.isAssetValid('door_sheet')) {
      const dg = this.make.graphics({ add: false })
      dg.fillStyle(0x8b6914, 1)
      dg.fillRect(0, 0, 32, 48)
      dg.fillStyle(0xffc847, 1)
      dg.fillRect(4, 4, 24, 40)
      dg.generateTexture('door', 32, 48)
      dg.destroy()
    }

    // === UI 素材（始终程序生成，田园风配色） ===

    // 金币 - 温暖金色
    const coinG = this.make.graphics({ add: false })
    coinG.fillStyle(0xffc847, 1)
    coinG.fillCircle(8, 8, 7)
    coinG.fillStyle(0xe8a33c, 1)
    coinG.fillCircle(8, 8, 4)
    coinG.fillStyle(0xffc847, 1)
    coinG.fillRect(6, 6, 4, 4)
    coinG.generateTexture('coin', 16, 16)
    coinG.destroy()

    // 心形 - 柔和红色
    const heartG = this.make.graphics({ add: false })
    heartG.fillStyle(0xe85050, 1)
    heartG.fillCircle(6, 6, 6)
    heartG.fillCircle(14, 6, 6)
    heartG.fillTriangle(0, 8, 20, 8, 10, 18)
    heartG.generateTexture('heart', 20, 20)
    heartG.destroy()

    // 星星 - 田园金色
    const starG = this.make.graphics({ add: false })
    starG.fillStyle(0xffc847, 1)
    // 画一个像素风五角星
    starG.fillRect(8, 0, 4, 4)
    starG.fillRect(4, 4, 12, 4)
    starG.fillRect(0, 8, 20, 4)
    starG.fillRect(2, 12, 6, 4)
    starG.fillRect(12, 12, 6, 4)
    starG.fillRect(0, 16, 4, 4)
    starG.fillRect(16, 16, 4, 4)
    starG.generateTexture('star', 20, 20)
    starG.destroy()

    // 空星星
    const starEG = this.make.graphics({ add: false })
    starEG.lineStyle(2, 0xffc847)
    starEG.strokeRect(8, 0, 4, 4)
    starEG.strokeRect(4, 4, 12, 4)
    starEG.strokeRect(0, 8, 20, 4)
    starEG.strokeRect(2, 12, 6, 4)
    starEG.strokeRect(12, 12, 6, 4)
    starEG.strokeRect(0, 16, 4, 4)
    starEG.strokeRect(16, 16, 4, 4)
    starEG.generateTexture('star_empty', 20, 20)
    starEG.destroy()

    // 按钮背景 - 木纹风格
    const btnG = this.make.graphics({ add: false })
    btnG.fillStyle(0x5b8c3e, 1)
    btnG.fillRoundedRect(0, 0, 200, 50, 4)
    btnG.lineStyle(3, 0x3a6b1e)
    btnG.strokeRoundedRect(0, 0, 200, 50, 4)
    btnG.generateTexture('btn_green', 200, 50)
    btnG.destroy()

    const btnGoldG = this.make.graphics({ add: false })
    btnGoldG.fillStyle(0xe8a33c, 1)
    btnGoldG.fillRoundedRect(0, 0, 200, 50, 4)
    btnGoldG.lineStyle(3, 0xb8832e)
    btnGoldG.strokeRoundedRect(0, 0, 200, 50, 4)
    btnGoldG.generateTexture('btn_gold', 200, 50)
    btnGoldG.destroy()

    // 保留旧 key 兼容性
    if (!this.isAssetValid('btn_blue')) {
      const btnBG = this.make.graphics({ add: false })
      btnBG.fillStyle(0x5b8c3e, 1)
      btnBG.fillRoundedRect(0, 0, 200, 50, 4)
      btnBG.lineStyle(3, 0x3a6b1e)
      btnBG.strokeRoundedRect(0, 0, 200, 50, 4)
      btnBG.generateTexture('btn_blue', 200, 50)
      btnBG.destroy()
    }

    // === Boss 相关纹理 ===

    // Boss子弹 - 8x8 橙色圆
    const bulletG = this.make.graphics({ add: false })
    bulletG.fillStyle(0xff8833, 1)
    bulletG.fillCircle(4, 4, 4)
    bulletG.fillStyle(0xffcc66, 1)
    bulletG.fillCircle(4, 4, 2)
    bulletG.generateTexture('boss_bullet', 8, 8)
    bulletG.destroy()

    // Boss击败粒子 - 4x4 黄色圆
    const partG = this.make.graphics({ add: false })
    partG.fillStyle(0xffdd44, 1)
    partG.fillCircle(2, 2, 2)
    partG.generateTexture('boss_particle', 4, 4)
    partG.destroy()
  }

  /**
   * 创建 fallback 动画（当 spritesheet 加载失败时，用单帧纹理创建最小动画）
   * 防止 WorldScene 调用 sprite.play('player_idle_down') 等时崩溃
   */
  createFallbackAnimations() {
    // Only create if main spritesheet animations weren't created
    const fallbackAnims = [
      'player_idle_down', 'player_idle_up', 'player_idle_left', 'player_idle_right',
      'player_walk_down', 'player_walk_up', 'player_walk_left', 'player_walk_right'
    ]

    for (const key of fallbackAnims) {
      if (!this.anims.exists(key) && this.textures.exists('player')) {
        this.anims.create({
          key,
          frames: [{ key: 'player', frame: 0 }],
          frameRate: 1,
          repeat: -1
        })
      }
    }

    if (!this.anims.exists('chicken_idle') && this.textures.exists('monster')) {
      this.anims.create({
        key: 'chicken_idle',
        frames: [{ key: 'monster', frame: 0 }],
        frameRate: 1,
        repeat: -1
      })
    }

    if (!this.anims.exists('cow_idle') && this.textures.exists('npc')) {
      this.anims.create({
        key: 'cow_idle',
        frames: [{ key: 'npc', frame: 0 }],
        frameRate: 1,
        repeat: -1
      })
    }
  }
}
