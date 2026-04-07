import Boss from './Boss'
import Phaser from 'phaser'

/**
 * 冲锋Boss - 静止→警告→冲锋→恢复 循环
 * 冲锋碰到玩家扣血
 */
export default class ChargingBoss extends Boss {
  constructor(scene, x, y, config) {
    super(scene, x, y, { ...config, bossType: 'charging' })

    this.state = 'resting' // resting | warning | charging | recovering
    this.stateTimer = 0
    this.restDuration = 3000
    this.warningDuration = 1000
    this.chargeDuration = 1500
    this.recoverDuration = 1000
    this.chargeSpeed = 200
    this.chargeTarget = { x: 0, y: 0 }
    this.isCharging = false

    this.setImmovable(false)
    this.body.setCollideWorldBounds(true)

    // Warning line graphic
    this.warningLine = scene.add.graphics().setDepth(7)

    // First-time warning tip
    if (!localStorage.getItem('wordquest:chargeBossSeen')) {
      localStorage.setItem('wordquest:chargeBossSeen', 'true')
      const tip = scene.add.text(x, y - 70, '⚠️ Boss会冲锋！看到闪烁快躲开！', {
        fontSize: '12px',
        fontFamily: 'Microsoft YaHei',
        color: '#ffcc00',
        stroke: '#000',
        strokeThickness: 3,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setDepth(20)

      scene.tweens.add({
        targets: tip,
        alpha: 0,
        y: y - 100,
        duration: 4000,
        delay: 2000,
        onComplete: () => tip.destroy()
      })
    }

    // Start the behavior loop
    this.startResting()
  }

  startResting() {
    this.state = 'resting'
    this.body.setVelocity(0, 0)
    this.isCharging = false

    this.stateEvent = this.scene.time.delayedCall(this.restDuration, () => {
      if (this.active && !this.defeated) this.startWarning()
    })
  }

  startWarning() {
    if (!this.scene?.player || this.defeated) return
    this.state = 'warning'

    // Lock target position
    this.chargeTarget = {
      x: this.scene.player.x,
      y: this.scene.player.y
    }

    // Flash warning animation
    let flashCount = 0
    this.flashTimer = this.scene.time.addEvent({
      delay: 150,
      callback: () => {
        if (!this.active) return
        flashCount++
        this.setAlpha(flashCount % 2 === 0 ? 1 : 0.3)
      },
      repeat: 5
    })

    // Draw warning line
    this.updateWarningLine()

    this.stateEvent = this.scene.time.delayedCall(this.warningDuration, () => {
      if (this.active && !this.defeated) this.startCharging()
    })
  }

  updateWarningLine() {
    if (!this.warningLine || !this.active) return
    this.warningLine.clear()
    this.warningLine.lineStyle(2, 0xff0000, 0.5)
    this.warningLine.lineBetween(this.x, this.y, this.chargeTarget.x, this.chargeTarget.y)
  }

  startCharging() {
    this.state = 'charging'
    this.isCharging = true
    this.setAlpha(1)

    // Clear warning line
    if (this.warningLine) this.warningLine.clear()

    // Charge towards locked target
    this.scene.physics.moveTo(this, this.chargeTarget.x, this.chargeTarget.y, this.chargeSpeed)

    // Flip based on direction
    this.setFlipX(this.chargeTarget.x < this.x)

    this.stateEvent = this.scene.time.delayedCall(this.chargeDuration, () => {
      if (this.active && !this.defeated) this.startRecovering()
    })
  }

  startRecovering() {
    this.state = 'recovering'
    this.isCharging = false
    this.body.setVelocity(0, 0)

    this.stateEvent = this.scene.time.delayedCall(this.recoverDuration, () => {
      if (this.active && !this.defeated) this.startResting()
    })
  }

  update() {
    if (this.defeated || !this.active) return
    super.update()

    // Update warning line during warning state
    if (this.state === 'warning' && this.warningLine) {
      this.updateWarningLine()
    }
  }

  pauseBehavior() {
    this.body.setVelocity(0, 0)
    if (this.stateEvent) this.stateEvent.paused = true
    if (this.flashTimer) this.flashTimer.paused = true
  }

  resumeBehavior() {
    if (this.stateEvent) this.stateEvent.paused = false
    if (this.flashTimer) this.flashTimer.paused = false
    // Resume charging if in charge state
    if (this.state === 'charging') {
      this.scene.physics.moveTo(this, this.chargeTarget.x, this.chargeTarget.y, this.chargeSpeed)
    }
  }

  defeat() {
    if (this.stateEvent) { this.stateEvent.remove(); this.stateEvent = null }
    if (this.flashTimer) { this.flashTimer.remove(); this.flashTimer = null }
    if (this.warningLine) { this.warningLine.destroy(); this.warningLine = null }
    super.defeat()
  }

  destroy(fromScene) {
    if (this.stateEvent) { this.stateEvent.remove(); this.stateEvent = null }
    if (this.flashTimer) { this.flashTimer.remove(); this.flashTimer = null }
    if (this.warningLine) { this.warningLine.destroy(); this.warningLine = null }
    super.destroy(fromScene)
  }
}
