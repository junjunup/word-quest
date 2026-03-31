import Phaser from 'phaser'
import eventBus, { EVENTS } from '../systems/EventBus'
import levelManager from '../systems/LevelManager'

/**
 * 答题战斗场景
 * 在WorldScene触发后切换到此场景进行答题
 * 或者以覆盖模式运行（通过Vue弹窗实现答题UI）
 *
 * 此场景主要处理战斗动画和视觉反馈
 */
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' })
  }

  init(data) {
    this.battleData = data || {}
  }

  create() {
    const { width, height } = this.cameras.main
    this.cameras.main.setBackgroundColor('#0f0f23')

    // 战斗背景
    this.createBattleBackground()

    // 玩家角色（左侧）
    const player = this.add.image(150, 400, 'player').setScale(4)
    this.tweens.add({
      targets: player,
      y: player.y - 5,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.add.text(150, 340, '勇者', {
      fontSize: '16px', fontFamily: 'Microsoft YaHei', color: '#4a90d9'
    }).setOrigin(0.5)

    // 怪物（右侧）
    this.monster = this.add.image(width - 200, 400, 'monster').setScale(4)
    this.tweens.add({
      targets: this.monster,
      y: this.monster.y - 8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.monsterName = this.add.text(width - 200, 340, '遗忘怪物', {
      fontSize: '16px', fontFamily: 'Microsoft YaHei', color: '#d0021b'
    }).setOrigin(0.5)

    // VS文字
    const vsText = this.add.text(width / 2, 380, 'VS', {
      fontSize: '36px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5)

    this.tweens.add({
      targets: vsText,
      scale: 1.2,
      duration: 600,
      yoyo: true,
      repeat: -1
    })

    // 战斗信息
    this.add.text(width / 2, 50, '⚔️ 词汇战斗 ⚔️', {
      fontSize: '28px', fontFamily: 'Microsoft YaHei', color: '#ffd700',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5)

    this.statusText = this.add.text(width / 2, 550, '请在弹窗中作答...', {
      fontSize: '18px', fontFamily: 'Microsoft YaHei', color: '#b8b8d4'
    }).setOrigin(0.5)

    // 监听答题结果来播放动画
    eventBus.on(EVENTS.QUIZ_ANSWERED, this.playResultAnimation.bind(this))
  }

  createBattleBackground() {
    // 简单的战斗场地背景
    const bg = this.add.graphics()
    // 地面
    bg.fillStyle(0x1a2a1a, 1)
    bg.fillRect(0, 450, 960, 190)
    bg.lineStyle(2, 0x3a5a3a)
    bg.lineBetween(0, 450, 960, 450)

    // 装饰粒子
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, 960)
      const y = Phaser.Math.Between(0, 400)
      const star = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.5))
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(1000, 2000),
        yoyo: true,
        repeat: -1
      })
    }
  }

  playResultAnimation(data) {
    const { isCorrect } = data
    const { width, height } = this.cameras.main

    if (isCorrect) {
      // 正确：攻击动画
      this.statusText.setText('✅ 回答正确！')
      this.statusText.setColor('#7ed321')

      // 怪物受击抖动
      this.tweens.add({
        targets: this.monster,
        x: this.monster.x + 10,
        duration: 50,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          // 怪物消失
          this.tweens.add({
            targets: this.monster,
            alpha: 0,
            scale: 0,
            duration: 500
          })
        }
      })

      // 闪光效果
      const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffd700, 0.3)
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy()
      })
    } else {
      // 错误：受伤动画
      this.statusText.setText('❌ 回答错误！')
      this.statusText.setColor('#d0021b')

      // 屏幕抖动
      this.cameras.main.shake(300, 0.01)

      // 红色闪烁
      const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0.2)
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
        onComplete: () => flash.destroy()
      })
    }
  }

  shutdown() {
    eventBus.off(EVENTS.QUIZ_ANSWERED)
  }
}
