import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import audioManager from '../systems/AudioManager'

/**
 * 游戏主菜单场景 - 田园像素风
 */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  create() {
    const { width, height } = this.cameras.main
    // 田园绿色背景
    this.cameras.main.setBackgroundColor('#4a8c28')

    // 注册 shutdown 清理
    this.events.once('shutdown', this.shutdown, this)

    // 安全网：确保其他场景已休眠（改用 sleep 避免 stop 连锁反应）
    for (const key of ['WorldScene', 'ResultScene', 'PreparationScene']) {
      const s = this.game.scene.getScene(key)
      if (s && s.scene.isActive()) {
        s.scene.sleep()
      }
    }

    // 场景刚创建时禁用输入，防止上一个场景的残留点击穿透
    this.input.enabled = false

    // 初始化音频并播放菜单背景音乐
    audioManager.init(this)
    audioManager.playBGM('bgm_menu')

    // 田园背景（草地+装饰）
    this.createPastoralBackground(width, height)

    // 标题
    this.add.text(width / 2, 80, '词汇大冒险', {
      fontSize: '40px',
      fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#ffc847',
      fontStyle: 'bold',
      stroke: '#5b3a1a',
      strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(width / 2, 135, 'WORD QUEST', {
      fontSize: '16px',
      fontFamily: '"Press Start 2P", Arial',
      color: '#f5edd6',
      letterSpacing: 6,
      stroke: '#5b3a1a',
      strokeThickness: 3
    }).setOrigin(0.5)

    // 装饰线 - 木质风格
    const line = this.add.graphics()
    line.lineStyle(3, 0x8b6914, 0.8)
    line.lineBetween(width / 2 - 140, 165, width / 2 + 140, 165)
    // 两端小菱形
    line.fillStyle(0xffc847)
    line.fillRect(width / 2 - 144, 162, 8, 8)
    line.fillRect(width / 2 + 136, 162, 8, 8)

    // 首次访问：小智欢迎气泡（必须在按钮之前创建，否则全屏dismissZone会拦截按钮点击）
    const hasVisited = localStorage.getItem('wordquest:hasVisited')
    if (!hasVisited) {
      this.showFirstTimeWelcome(width, height)
      localStorage.setItem('wordquest:hasVisited', 'true')
    }

    // 木质按钮（在欢迎气泡之后创建，确保按钮在display list上层，获得输入优先权）
    this.createWoodButton(width / 2, 210, '🌿 开 始 冒 险', 0x5b8c3e, 0x3a6b1e, () => {
      eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, { mode: 'new' })
    })

    this.createWoodButton(width / 2, 268, '📖 继 续 游 戏', 0x7eb55e, 0x5b8c3e, () => {
      eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, { mode: 'continue' })
    })

    this.createWoodButton(width / 2, 326, '👤 角 色', 0x9b7ed3, 0x7b5eb3, () => {
      eventBus.emit(EVENTS.SHOW_CHARACTER_SELECT)
    })

    this.createWoodButton(width / 2, 384, '🏆 排 行 榜', 0xe8a33c, 0xb8832e, () => {
      eventBus.emit(EVENTS.SHOW_LEADERBOARD)
    })

    this.createWoodButton(width / 2, 442, '🔥 每 日 挑 战', 0xd45b3e, 0xa04030, () => {
      eventBus.emit(EVENTS.SHOW_DAILY_CHALLENGE)
    })

    this.createWoodButton(width / 2, 500, '🛒 商 店', 0x7b5eb3, 0x5b3e93, () => {
      eventBus.emit(EVENTS.SHOW_SHOP)
    })

    // 底部信息
    this.add.text(width / 2, height - 30, '🌾 穿越词汇田园，击败遗忘小怪！', {
      fontSize: '13px',
      fontFamily: 'Microsoft YaHei',
      color: '#c4b99a',
      stroke: '#2d5016',
      strokeThickness: 2
    }).setOrigin(0.5)

    // NPC小智出场（使用奶牛或fallback）
    const hasCow = this.textures.exists('cow_sheet')
    let npc
    if (hasCow) {
      npc = this.add.sprite(width - 80, height - 100, 'cow_sheet', 0).setScale(2.5)
      if (this.anims.exists('cow_idle')) {
        npc.play('cow_idle')
      }
    } else {
      npc = this.add.image(width - 80, height - 100, 'npc').setScale(2)
    }

    this.add.text(width - 80, height - 135, '🌟 小智', {
      fontSize: '11px',
      fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#5b8c3e',
      stroke: '#fff',
      strokeThickness: 2
    }).setOrigin(0.5)

    // 小智浮动动画
    this.tweens.add({
      targets: npc,
      y: npc.y - 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // 延迟启用输入，等待上一场景残留的指针事件完全排空
    // 使用原生 setTimeout 避免被上一场景 shutdown 的 tweens.killAll() 连带清除
    this._inputTimer = setTimeout(() => {
      if (this.scene?.isActive()) {
        this.input.enabled = true
      }
      this._inputTimer = null
    }, 200)
  }

  /**
   * 创建田园背景（替代星空）
   */
  createPastoralBackground(width, height) {
    // 渐变草地底色
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x4a8c28, 0x4a8c28, 0x3a6b1e, 0x3a6b1e, 1)
    bg.fillRect(0, 0, width, height)

    // 散布像素草丛和花朵
    const hasGrassDecor = this.textures.exists('grass_decor')

    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)

      if (hasGrassDecor) {
        const frames = [6, 7, 8, 18, 21, 24, 27] // 花/小装饰帧
        const frame = frames[Phaser.Math.Between(0, frames.length - 1)]
        const deco = this.add.image(x, y, 'grass_decor', frame).setScale(2)
        deco.setAlpha(Phaser.Math.FloatBetween(0.3, 0.6))
      } else {
        // Fallback: 简单像素点
        const colors = [0xff9999, 0xffcc66, 0x99ff99, 0xffffff]
        const color = colors[Phaser.Math.Between(0, colors.length - 1)]
        const dot = this.add.circle(x, y, Phaser.Math.Between(2, 4), color)
        dot.setAlpha(Phaser.Math.FloatBetween(0.3, 0.7))
      }
    }

    // 飘落叶片效果
    for (let i = 0; i < 12; i++) {
      const leaf = this.add.text(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(-50, height),
        '🍃',
        { fontSize: `${Phaser.Math.Between(10, 18)}px` }
      ).setAlpha(Phaser.Math.FloatBetween(0.3, 0.6))

      this.tweens.add({
        targets: leaf,
        x: leaf.x + Phaser.Math.Between(-100, 100),
        y: height + 50,
        rotation: Phaser.Math.FloatBetween(-1, 1),
        duration: Phaser.Math.Between(6000, 12000),
        delay: Phaser.Math.Between(0, 5000),
        repeat: -1,
        onRepeat: () => {
          leaf.setPosition(Phaser.Math.Between(0, width), -50)
        }
      })
    }
  }

  /**
   * 创建木质像素风按钮
   */
  createWoodButton(x, y, text, fillColor, strokeColor, callback) {
    const btnW = 280
    const btnH = 50

    const bg = this.add.graphics()
    // 主体
    bg.fillStyle(fillColor, 1)
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
    // 边框
    bg.lineStyle(3, strokeColor)
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
    // 高光线（顶部）
    bg.lineStyle(1, 0xffffff, 0.15)
    bg.lineBetween(x - btnW / 2 + 6, y - btnH / 2 + 3, x + btnW / 2 - 6, y - btnH / 2 + 3)

    const btn = this.add.text(x, y, text, {
      fontSize: '18px',
      fontFamily: 'Microsoft YaHei',
      color: '#f5edd6',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 1
    }).setOrigin(0.5)

    // 交互区域
    const hitArea = this.add.rectangle(x, y, btnW, btnH).setInteractive({ useHandCursor: true })
    hitArea.setAlpha(0.001)

    hitArea.on('pointerover', () => {
      bg.clear()
      // 悬浮时变亮
      bg.fillStyle(fillColor, 0.85)
      bg.fillRoundedRect(x - btnW / 2 - 3, y - btnH / 2 - 2, btnW + 6, btnH + 4, 6)
      bg.lineStyle(3, 0xffc847)
      bg.strokeRoundedRect(x - btnW / 2 - 3, y - btnH / 2 - 2, btnW + 6, btnH + 4, 6)
      btn.setScale(1.05)
    })

    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(fillColor, 1)
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
      bg.lineStyle(3, strokeColor)
      bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
      bg.lineStyle(1, 0xffffff, 0.15)
      bg.lineBetween(x - btnW / 2 + 6, y - btnH / 2 + 3, x + btnW / 2 - 6, y - btnH / 2 + 3)
      btn.setScale(1)
    })

    hitArea.on('pointerdown', () => {
      audioManager.play('click')
      callback()
    })
  }

  /**
   * 首次访问欢迎气泡 — 小智引导新玩家点击"开始冒险"
   */
  showFirstTimeWelcome(width, height) {
    const bubbleX = width / 2
    const bubbleY = 195

    // 对话气泡背景
    const bubble = this.add.graphics()
    bubble.fillStyle(0xfff8e7, 0.95)
    bubble.fillRoundedRect(bubbleX - 200, bubbleY - 45, 400, 65, 10)
    bubble.lineStyle(2, 0x8b6914)
    bubble.strokeRoundedRect(bubbleX - 200, bubbleY - 45, 400, 65, 10)
    // 小三角指向开始按钮
    bubble.fillStyle(0xfff8e7, 0.95)
    bubble.fillTriangle(
      bubbleX - 10, bubbleY + 20,
      bubbleX + 10, bubbleY + 20,
      bubbleX, bubbleY + 38
    )
    bubble.lineStyle(2, 0x8b6914)
    const tri = new Phaser.Geom.Triangle(bubbleX - 10, bubbleY + 20, bubbleX + 10, bubbleY + 20, bubbleX, bubbleY + 38)
    bubble.strokeTriangle(tri)
    // 覆盖三角底边
    bubble.lineStyle(2, 0xfff8e7, 0.95)
    bubble.lineBetween(bubbleX - 10, bubbleY + 20, bubbleX + 10, bubbleY + 20)

    // 欢迎文字
    this.add.text(bubbleX, bubbleY - 22, '👋 欢迎来到词汇大冒险！', {
      fontSize: '15px',
      fontFamily: 'Microsoft YaHei',
      color: '#5b3a1a',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.add.text(bubbleX, bubbleY + 5, '我是小智 ✨ 点击\`开始冒险\`进入你的第一课吧！', {
      fontSize: '12px',
      fontFamily: 'Microsoft YaHei',
      color: '#8b6914'
    }).setOrigin(0.5)

    // 指向开始按钮的闪烁箭头
    const arrow = this.add.text(width / 2, 210, '👇', {
      fontSize: '22px'
    }).setOrigin(0.5)

    this.tweens.add({
      targets: arrow,
      y: arrow.y + 8,
      duration: 600,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // 3秒后自动淡出
        this.tweens.add({
          targets: [bubble, arrow],
          alpha: 0,
          duration: 800,
          delay: 1000
        })
      }
    })

    // 点击气泡或任意位置关闭（在按钮之前创建，display list 中处于按钮下方，不会拦截按钮点击）
    const dismissZone = this.add.rectangle(width / 2, height / 2, width, height)
      .setInteractive({ useHandCursor: false })
      .setAlpha(0.001)
    dismissZone.once('pointerdown', () => {
      this.tweens.add({
        targets: [bubble, arrow],
        alpha: 0,
        duration: 400
      })
    })
  }

  shutdown() {
    // 清理原生定时器
    if (this._inputTimer) { clearTimeout(this._inputTimer); this._inputTimer = null }

    // Clean up all tweens first
    this.tweens.killAll()

    // Disable input on the scene to prevent queued pointer events
    this.input.enabled = false

    // Remove all event listeners from keyboard input
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown')
      this.input.keyboard.off('keyup')
    }

    // Remove all display objects - this also removes event listeners attached to them
    this.children.removeAll(true)
  }
}
