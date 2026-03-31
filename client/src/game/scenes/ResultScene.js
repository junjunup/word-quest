import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'

/**
 * 关卡结算场景 - 田园木质告示牌风格
 * 显示关卡成绩、星级、经验获取
 */
export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' })
  }

  init(data) {
    this.result = data || {}
  }

  create() {
    const { width, height } = this.cameras.main
    this.cameras.main.setBackgroundColor('#3a6b1e')

    // 注册 shutdown 清理
    this.events.once('shutdown', this.shutdown, this)

    const {
      chapter = 1, level = 1, stars = 1, score = 0,
      correctCount = 0, wrongCount = 0, totalWords = 0,
      correctRate = 0, maxCombo = 0, totalTime = 0
    } = this.result

    // 田园背景
    this.createBackground(width, height)

    // 标题 - 卷轴/告示牌风格
    this.add.text(width / 2, 50, '🎉 关卡完成！', {
      fontSize: '32px', fontFamily: '"Press Start 2P", Microsoft YaHei', color: '#ffc847',
      fontStyle: 'bold', stroke: '#5b3a1a', strokeThickness: 5
    }).setOrigin(0.5)

    // 章节关卡信息
    this.add.text(width / 2, 100, `第${chapter}章 - 第${level}关`, {
      fontSize: '16px', fontFamily: 'Microsoft YaHei', color: '#f5edd6',
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5)

    // 星级评定 - 动画逐个显示
    const starY = 155
    for (let i = 0; i < 3; i++) {
      const filled = i < stars
      const starImg = this.add.image(width / 2 - 50 + i * 50, starY, filled ? 'star' : 'star_empty')
        .setScale(0).setDepth(10)

      this.tweens.add({
        targets: starImg,
        scale: 2.5,
        duration: 400,
        delay: 500 + i * 300,
        ease: 'Back.easeOut'
      })
    }

    // 木质成绩面板
    const panelY = 220
    const panelW = 420
    const panelH = 230
    const panelBg = this.add.graphics()
    // 面板底色 - 羊皮纸/木纹色
    panelBg.fillStyle(0xd4a76a, 0.95)
    panelBg.fillRoundedRect(width / 2 - panelW / 2, panelY, panelW, panelH, 8)
    // 深色木质边框
    panelBg.lineStyle(4, 0x8b6914)
    panelBg.strokeRoundedRect(width / 2 - panelW / 2, panelY, panelW, panelH, 8)
    // 内边框装饰
    panelBg.lineStyle(1, 0xb8832e, 0.5)
    panelBg.strokeRoundedRect(width / 2 - panelW / 2 + 6, panelY + 6, panelW - 12, panelH - 12, 4)

    const stats = [
      { label: '🌟 得分', value: score.toString(), color: '#5b3a1a' },
      { label: '✅ 正确率', value: `${correctRate}%`, color: '#2d5016' },
      { label: '📝 答对/总题', value: `${correctCount}/${totalWords}`, color: '#5b3a1a' },
      { label: '🔥 最大连击', value: maxCombo.toString(), color: '#8b4513' },
      { label: '⏱ 用时', value: this.formatTime(totalTime), color: '#666' }
    ]

    stats.forEach((stat, i) => {
      const y = panelY + 28 + i * 40
      this.add.text(width / 2 - 170, y, stat.label, {
        fontSize: '15px', fontFamily: 'Microsoft YaHei', color: '#8b6914'
      })
      const valueText = this.add.text(width / 2 + 170, y, stat.value, {
        fontSize: '17px', fontFamily: '"Press Start 2P", Arial', color: stat.color, fontStyle: 'bold'
      }).setOrigin(1, 0)

      // 数值滑入动画
      valueText.setAlpha(0).setX(width / 2 + 210)
      this.tweens.add({
        targets: valueText,
        alpha: 1,
        x: width / 2 + 170,
        duration: 400,
        delay: 1500 + i * 150,
        ease: 'Power2'
      })
    })

    // 经验获取动画
    const expGain = Math.floor(score / 2)
    const expText = this.add.text(width / 2, 480, `+${expGain} EXP ✨`, {
      fontSize: '22px', fontFamily: '"Press Start 2P", Arial', color: '#5b8c3e', fontStyle: 'bold',
      stroke: '#fff', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: expText,
      alpha: 1,
      y: 470,
      duration: 600,
      delay: 2500,
      ease: 'Power2'
    })

    // 按钮区域 - 木质风格
    const btnY = 540
    const MAX_LEVELS = 5
    const MAX_CHAPTERS = 6

    this.createWoodButton(width / 2 - 140, btnY, '下一关 ▶', 0x5b8c3e, 0x3a6b1e, () => {
      const nextLevel = level < MAX_LEVELS ? level + 1 : 1
      const nextChapter = level >= MAX_LEVELS ? Math.min(chapter + 1, MAX_CHAPTERS) : chapter
      this.scene.start('WorldScene', { chapter: nextChapter, level: nextLevel })
    }, 3000)

    this.createWoodButton(width / 2 + 140, btnY, '再来一次 🔄', 0xe8a33c, 0xb8832e, () => {
      this.scene.start('WorldScene', { chapter, level })
    }, 3200)

    // 返回菜单
    this.add.text(width / 2, 600, '🏠 返回菜单', {
      fontSize: '13px', fontFamily: 'Microsoft YaHei', color: '#c4b99a',
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MenuScene'))
      .on('pointerover', function () { this.setColor('#ffc847') })
      .on('pointerout', function () { this.setColor('#c4b99a') })

    // 通知Vue层
    eventBus.emit(EVENTS.LEVEL_COMPLETE, this.result)
  }

  createBackground(width, height) {
    // 草地渐变
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x3a6b1e, 0x3a6b1e, 0x2d5016, 0x2d5016, 1)
    bg.fillRect(0, 0, width, height)

    // 散布田园装饰
    const hasGrassDecor = this.textures.exists('grass_decor')
    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      if (hasGrassDecor) {
        const frames = [6, 7, 8, 24, 27]
        const deco = this.add.image(x, y, 'grass_decor', frames[Phaser.Math.Between(0, frames.length - 1)])
          .setScale(2).setAlpha(0.3)
      } else {
        this.add.circle(x, y, 3, 0xffffff, 0.2)
      }
    }
  }

  createWoodButton(x, y, text, fillColor, strokeColor, callback, delay = 0) {
    const btnW = 220
    const btnH = 44

    const bg = this.add.graphics()
    bg.fillStyle(fillColor, 1)
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
    bg.lineStyle(3, strokeColor)
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
    bg.setAlpha(0)

    const label = this.add.text(x, y, text, {
      fontSize: '15px', fontFamily: 'Microsoft YaHei', color: '#f5edd6', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: [bg, label],
      alpha: 1,
      duration: 400,
      delay
    })

    // 按钮交互区域：延迟到视觉出现后才启用交互
    const hitArea = this.add.rectangle(x, y, btnW, btnH).setAlpha(0.001)
    this.time.delayedCall(delay + 400, () => {
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', callback)
      hitArea.on('pointerover', () => {
      label.setScale(1.05)
      bg.clear()
      bg.fillStyle(fillColor, 0.85)
      bg.fillRoundedRect(x - btnW / 2 - 2, y - btnH / 2 - 2, btnW + 4, btnH + 4, 6)
      bg.lineStyle(3, 0xffc847)
      bg.strokeRoundedRect(x - btnW / 2 - 2, y - btnH / 2 - 2, btnW + 4, btnH + 4, 6)
      })
      hitArea.on('pointerout', () => {
        label.setScale(1)
        bg.clear()
        bg.fillStyle(fillColor, 1)
        bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
        bg.lineStyle(3, strokeColor)
        bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
      })
    })
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  shutdown() {
    this.tweens.killAll()
  }
}
