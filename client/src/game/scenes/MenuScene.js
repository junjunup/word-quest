import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'

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

    // 木质按钮
    this.createWoodButton(width / 2, 230, '🌿 开 始 冒 险', 0x5b8c3e, 0x3a6b1e, () => {
      eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, { mode: 'new' })
    })

    this.createWoodButton(width / 2, 300, '📖 继 续 游 戏', 0x7eb55e, 0x5b8c3e, () => {
      eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, { mode: 'continue' })
    })

    this.createWoodButton(width / 2, 370, '👤 角 色', 0x9b7ed3, 0x7b5eb3, () => {
      eventBus.emit(EVENTS.SHOW_CHARACTER_SELECT)
    })

    this.createWoodButton(width / 2, 440, '🏆 排 行 榜', 0xe8a33c, 0xb8832e, () => {
      eventBus.emit(EVENTS.SHOW_LEADERBOARD)
    })

    // 底部信息
    this.add.text(width / 2, height - 40, '🌾 穿越词汇田园，击败遗忘小怪！', {
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

    hitArea.on('pointerdown', callback)
  }

  shutdown() {
    this.tweens.killAll()
  }
}
