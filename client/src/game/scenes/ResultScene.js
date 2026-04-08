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

    // 场景刚创建时禁用输入，防止上一个场景的残留点击穿透
    this.input.enabled = false

    const {
      chapter = 1, level = 1, stars = 1, score = 0,
      correctCount = 0, wrongCount = 0, totalWords = 0,
      correctRate = 0, maxCombo = 0, totalTime = 0,
      difficulty = 'normal', scoreMultiplier = 1.0,
      bossDefeated = false, livesRemaining = 0
    } = this.result

    // 田园背景
    this.createBackground(width, height)

    // 标题
    const isGameOver = livesRemaining <= 0 && stars === 0
    const titleText = isGameOver ? '💀 挑战失败...' : '🎉 关卡完成！'
    this.add.text(width / 2, 40, titleText, {
      fontSize: '30px', fontFamily: '"Press Start 2P", Microsoft YaHei', color: isGameOver ? '#ff6666' : '#ffc847',
      fontStyle: 'bold', stroke: '#5b3a1a', strokeThickness: 5
    }).setOrigin(0.5)

    // 章节关卡信息
    this.add.text(width / 2, 85, `第${chapter}章 - 第${level}关`, {
      fontSize: '16px', fontFamily: 'Microsoft YaHei', color: '#f5edd6',
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5)

    // 难度badge + Boss击败标识
    const badges = []
    const diffLabels = { easy: '🌱 简单', normal: '⚔️ 普通', hard: '🔥 困难' }
    badges.push(diffLabels[difficulty] || '⚔️ 普通')
    if (bossDefeated) badges.push('👹 Boss已击败')

    this.add.text(width / 2, 110, badges.join('  |  '), {
      fontSize: '13px', fontFamily: 'Microsoft YaHei',
      color: difficulty === 'hard' ? '#ff8866' : (difficulty === 'easy' ? '#88cc66' : '#f5edd6'),
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5)

    // 星级评定 - 动画逐个显示
    const starY = 150
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
    const panelY = 195
    const panelW = 420
    const panelH = 260
    const panelBg = this.add.graphics()
    panelBg.fillStyle(0xd4a76a, 0.95)
    panelBg.fillRoundedRect(width / 2 - panelW / 2, panelY, panelW, panelH, 8)
    panelBg.lineStyle(4, 0x8b6914)
    panelBg.strokeRoundedRect(width / 2 - panelW / 2, panelY, panelW, panelH, 8)
    panelBg.lineStyle(1, 0xb8832e, 0.5)
    panelBg.strokeRoundedRect(width / 2 - panelW / 2 + 6, panelY + 6, panelW - 12, panelH - 12, 4)

    // Score with multiplier display
    const baseScore = scoreMultiplier !== 1.0 ? Math.round(score / scoreMultiplier) : score
    const scoreDisplay = scoreMultiplier !== 1.0
      ? `${baseScore} × ${scoreMultiplier} = ${score}`
      : score.toString()

    const stats = [
      { label: '🌟 得分', value: scoreDisplay, color: '#5b3a1a' },
      { label: '✅ 正确率', value: `${correctRate}%`, color: '#2d5016' },
      { label: '📝 答对/总题', value: `${correctCount}/${totalWords}`, color: '#5b3a1a' },
      { label: '🔥 最大连击', value: maxCombo.toString(), color: '#8b4513' },
      { label: '⏱ 用时', value: this.formatTime(totalTime), color: '#666' },
      { label: '👹 Boss', value: bossDefeated ? '已击败 ✓' : '未击败', color: bossDefeated ? '#2d5016' : '#d45b3e' }
    ]

    stats.forEach((stat, i) => {
      const y = panelY + 22 + i * 38
      this.add.text(width / 2 - 170, y, stat.label, {
        fontSize: '14px', fontFamily: 'Microsoft YaHei', color: '#8b6914'
      })
      const valueText = this.add.text(width / 2 + 170, y, stat.value, {
        fontSize: '14px', fontFamily: '"Press Start 2P", Arial', color: stat.color, fontStyle: 'bold'
      }).setOrigin(1, 0)

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
    const expText = this.add.text(width / 2, 485, `+${expGain} EXP ✨`, {
      fontSize: '20px', fontFamily: '"Press Start 2P", Arial', color: '#5b8c3e', fontStyle: 'bold',
      stroke: '#fff', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: expText,
      alpha: 1,
      y: 478,
      duration: 600,
      delay: 2500,
      ease: 'Power2'
    })

    // 按钮区域
    const btnY = 530
    const MAX_LEVELS = 5
    const MAX_CHAPTERS = 6

    // "下一关" → 通过事件回到关卡选择
    this.createWoodButton(width / 2 - 140, btnY, '下一关 ▶', 0x5b8c3e, 0x3a6b1e, () => {
      if (!this.scene.isActive()) return  // 防止重复点击
      this.input.enabled = false
      const nextLevel = level < MAX_LEVELS ? level + 1 : 1
      const nextChapter = level >= MAX_LEVELS ? Math.min(chapter + 1, MAX_CHAPTERS) : chapter
      // 先切到 MenuScene，再延迟触发 LevelSelect，确保 scene 切换完成
      this.scene.start('MenuScene')
      setTimeout(() => {
        eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, {
          mode: 'continue',
          suggestedChapter: nextChapter,
          suggestedLevel: nextLevel
        })
      }, 100)
    }, 3000)

    // "再来一次"
    this.createWoodButton(width / 2 + 140, btnY, '再来一次 🔄', 0xe8a33c, 0xb8832e, () => {
      if (!this.scene.isActive()) return  // 防止重复点击
      this.input.enabled = false
      this.scene.start('MenuScene')
      setTimeout(() => {
        eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, {
          mode: 'retry',
          suggestedChapter: chapter,
          suggestedLevel: level
        })
      }, 100)
    }, 3200)

    // 返回菜单
    this.add.text(width / 2, 590, '🏠 返回菜单', {
      fontSize: '13px', fontFamily: 'Microsoft YaHei', color: '#c4b99a',
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.scene.isActive()) return
        this.input.enabled = false
        this.scene.start('MenuScene')
      })
      .on('pointerover', function () { this.setColor('#ffc847') })
      .on('pointerout', function () { this.setColor('#c4b99a') })

    // 通知Vue层
    eventBus.emit(EVENTS.LEVEL_COMPLETE, this.result)

    // 延迟启用输入，等待上一场景残留的指针事件完全排空
    this.time.delayedCall(200, () => {
      if (this.scene.isActive()) {
        this.input.enabled = true
      }
    })
  }

  createBackground(width, height) {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x3a6b1e, 0x3a6b1e, 0x2d5016, 0x2d5016, 1)
    bg.fillRect(0, 0, width, height)

    const hasGrassDecor = this.textures.exists('grass_decor')
    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      if (hasGrassDecor) {
        const frames = [6, 7, 8, 24, 27]
        this.add.image(x, y, 'grass_decor', frames[Phaser.Math.Between(0, frames.length - 1)])
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
