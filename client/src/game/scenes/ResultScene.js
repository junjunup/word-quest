import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import audioManager from '../systems/AudioManager'

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
    this._pendingTimeouts = []
    this._needsRebuild = false
    // Defensive: clear any stale display objects from previous session
    this.children.removeAll(true)
  }

  create() {
    const { width, height } = this.cameras.main
    this.cameras.main.setBackgroundColor('#3a6b1e')

    // 注册 shutdown 清理
    this.events.once('shutdown', this.shutdown, this)

    // 注册 wake 处理：当场景从 SLEEPING 唤醒时，强制重建 UI
    this.events.on('wake', (sys, data) => {
      if (this._needsRebuild) return
      this._needsRebuild = true
      if (data) this.result = data
      this.children.removeAll(true)
      this.tweens.killAll()
      this._pendingTimeouts = []
      this.events.once('shutdown', this.shutdown, this)
      this._buildUI()
      this._needsRebuild = false
    })

    // ResultScene must stay interactive even if a later visual/audio setup fails.
    // Ghost-click prevention is handled by delayed button interactivity, not global input disable.
    this.input.enabled = true

    // 初始化音频并播放结算背景音乐
    audioManager.init(this)
    audioManager.playBGM('bgm_result')

    this._buildUI()
  }

  _buildUI() {
    const { width, height } = this.cameras.main
    const {
      chapter = 1, level = 1, stars = 1, score = 0,
      correctCount = 0, wrongCount = 0, totalWords = 0,
      correctRate = 0, maxCombo = 0, totalTime = 0,
      difficulty = 'normal', scoreMultiplier = 1.0,
      bossDefeated = false, livesRemaining = 0,
      isTutorial = false
    } = this.result

    // 田园背景
    this.createBackground(width, height)

    // 标题
    const isGameOver = livesRemaining <= 0 && stars === 0
    audioManager.play(isGameOver ? 'wrong' : 'level_complete')
    const titleText = isGameOver ? '💀 挑战失败...' : '🎉 关卡完成！'
    // 结算 UI 全部设为高 depth，防止旧场景残留贴图遮挡
    this.add.text(width / 2, 40, titleText, {
      fontSize: '30px', fontFamily: '"Press Start 2P", Microsoft YaHei', color: isGameOver ? '#ff6666' : '#ffc847',
      fontStyle: 'bold', stroke: '#5b3a1a', strokeThickness: 5
    }).setOrigin(0.5).setDepth(200)

    // 章节关卡信息
    this.add.text(width / 2, 85, `第${chapter}章 - 第${level}关`, {
      fontSize: '16px', fontFamily: 'Microsoft YaHei', color: '#f5edd6',
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5)

    // 教程关完成：特殊祝贺面板
    if (isTutorial && !isGameOver) {
      const tutorialBox = this.add.graphics().setDepth(200)
      tutorialBox.fillStyle(0xfff8e7, 0.92)
      tutorialBox.fillRoundedRect(width / 2 - 220, 100, 440, 40, 8)
      tutorialBox.lineStyle(2, 0xffc847)
      tutorialBox.strokeRoundedRect(width / 2 - 220, 100, 440, 40, 8)

      this.add.text(width / 2, 110, '🎓 教程完成！你已掌握基本操作，继续冒险吧！', {
        fontSize: '14px', fontFamily: 'Microsoft YaHei', color: '#5b3a1a', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(201)

      this.add.text(width / 2, 130, '💡 提示：之后的关卡有 Boss 战，难度更高但奖励也更丰厚！', {
        fontSize: '11px', fontFamily: 'Microsoft YaHei', color: '#8b6914'
      }).setOrigin(0.5).setDepth(201)
    }

    // 难度badge + Boss击败标识
    const badges = []
    const diffLabels = { easy: '🌱 简单', normal: '⚔️ 普通', hard: '🔥 困难' }
    badges.push(diffLabels[difficulty] || '⚔️ 普通')
    if (bossDefeated) badges.push('👹 Boss已击败')

    this.add.text(width / 2, isTutorial && !isGameOver ? 155 : 110, badges.join('  |  '), {
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

    // 木质成绩面板（depth=200 高于所有游戏元素）
    const panelY = 195
    const panelW = 420
    const panelH = 260
    const panelBg = this.add.graphics().setDepth(200)
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
      }).setDepth(210)
      const valueText = this.add.text(width / 2 + 170, y, stat.value, {
        fontSize: '14px', fontFamily: '"Press Start 2P", Arial', color: stat.color, fontStyle: 'bold'
      }).setOrigin(1, 0).setDepth(210)

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
    const diffMult = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.8 : 1.0
    const goldGain = Math.floor(stars * 30 * diffMult)
    const rewardsText = this.add.text(width / 2, 485, `+${expGain} EXP ✨  |  +${goldGain} 🪙`, {
      fontSize: '18px', fontFamily: '"Press Start 2P", Arial', color: '#ffc847', fontStyle: 'bold',
      stroke: '#5b3a1a', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(200)

    this.tweens.add({
      targets: rewardsText,
      alpha: 1,
      y: 475,
      duration: 600,
      delay: 2500,
      ease: 'Power2'
    })

    // 按钮区域
    const btnY = 530
    const MAX_LEVELS = 5
    const MAX_CHAPTERS = 6

    // 统一的返回菜单+关卡选择：直接切 Phaser 场景 + 同步通知 Vue
    const goToLevelSelect = (mode, suggestedChapter, suggestedLevel) => {
      // 先强制停止当前 ResultScene，消除残留渲染
      this.scene.stop()
      // 确保 MenuScene 走完整 create（而非仅 wake，避免空白菜单+后续卡死）
      const ms = this.game.scene.getScene('MenuScene')
      if (ms && ms.scene.isSleeping()) { ms.scene.wake() }
      this.game.scene.start('MenuScene')
      eventBus.emit(EVENTS.SHOW_LEVEL_SELECT, { mode, suggestedChapter, suggestedLevel })
    }

    // 死亡结算不允许直接进入下一关，只提供重试与关卡选择
    const isLastLevel = (chapter >= MAX_CHAPTERS && level >= MAX_LEVELS)
    const nextBtnText = isGameOver ? '重新挑战 ▶' : (isLastLevel ? '🏆 全部通关！' : '下一关 ▶')
    this.createWoodButton(width / 2 - 140, btnY, nextBtnText, 0x5b8c3e, 0x3a6b1e, () => {
      if (!this.scene.isActive()) return
      this.input.enabled = false
      if (isLastLevel) {
        this.scene.start('MenuScene')
        return
      }
      if (isGameOver) {
        goToLevelSelect('retry', chapter, level)
        return
      }
      const nextLevel = level < MAX_LEVELS ? level + 1 : 1
      const nextChapter = level >= MAX_LEVELS ? chapter + 1 : chapter
      goToLevelSelect('continue', nextChapter, nextLevel)
    }, 3000)

    const retryBtnText = isGameOver ? '关卡选择 📖' : '再来一次 🔄'
    this.createWoodButton(width / 2 + 140, btnY, retryBtnText, 0xe8a33c, 0xb8832e, () => {
      if (!this.scene.isActive()) return
      this.input.enabled = false
      goToLevelSelect(isGameOver ? 'continue' : 'retry', chapter, level)
    }, 3200)

    // 返回菜单（depth=200）
    this.add.text(width / 2, 590, '🏠 返回菜单', {
      fontSize: '13px', fontFamily: 'Microsoft YaHei', color: '#c4b99a',
      stroke: '#2d5016', strokeThickness: 2
    }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        audioManager.play('click')
        if (!this.scene.isActive()) return
        this.input.enabled = false
        this.scene.stop()
        const ms = this.game.scene.getScene('MenuScene')
        if (ms && ms.scene.isSleeping()) { ms.scene.wake() }
        this.game.scene.start('MenuScene')
      })
      .on('pointerover', function () { this.setColor('#ffc847') })
      .on('pointerout', function () { this.setColor('#c4b99a') })

    // 通知Vue层：死亡流程已由 GAME_OVER 处理，避免把死亡误记为关卡完成
    if (!isGameOver) {
      eventBus.emit(EVENTS.LEVEL_COMPLETE, this.result)
    }

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

    const bg = this.add.graphics().setDepth(210)
    bg.fillStyle(fillColor, 1)
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
    bg.lineStyle(3, strokeColor)
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4)
    bg.setAlpha(0)

    const label = this.add.text(x, y, text, {
      fontSize: '15px', fontFamily: 'Microsoft YaHei', color: '#f5edd6', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setAlpha(0).setDepth(210)

    this.tweens.add({
      targets: [bg, label],
      alpha: 1,
      duration: 400,
      delay
    })

    const hitArea = this.add.rectangle(x, y, btnW, btnH).setAlpha(0.001).setDepth(210)
    // 使用原生 setTimeout 避免被 shutdown() 的 tweens.killAll() 连带清除
    const btnTimer = setTimeout(() => {
      if (!hitArea.scene || !this.scene?.isActive()) return
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        audioManager.play('click')
        callback()
      })
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
      // 定时器执行完后从清理列表移除
      if (this._pendingTimeouts) {
        this._pendingTimeouts = this._pendingTimeouts.filter(t => t !== btnTimer)
      }
    }, delay + 400)
    // 将按钮定时器加入清理列表
    if (!this._pendingTimeouts) this._pendingTimeouts = []
    this._pendingTimeouts.push(btnTimer)
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }


  shutdown() {
    // Clean up pending native timeouts
    if (this._pendingTimeouts) {
      this._pendingTimeouts.forEach(id => clearTimeout(id))
      this._pendingTimeouts = []
    }

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
