import Boss from './Boss'
import Phaser from 'phaser'

/**
 * 炮台Boss - 固定位置，定时发射子弹
 * 子弹碰到玩家扣血
 */
export default class TurretBoss extends Boss {
  constructor(scene, x, y, config) {
    super(scene, x, y, { ...config, bossType: 'turret' })

    this.setImmovable(true)
    this.fireRate = config.difficulty === 'hard' ? 2000 : 3000
    this.bulletSpeed = config.difficulty === 'hard' ? 150 : 120

    // Bullet group
    this.bullets = scene.physics.add.group({
      defaultKey: 'boss_bullet',
      maxSize: 10
    })

    // Start firing timer
    this.fireTimer = scene.time.addEvent({
      delay: this.fireRate,
      callback: this.fireBullet,
      callbackScope: this,
      loop: true
    })
  }

  fireBullet() {
    if (this.defeated || !this.active || !this.scene?.player) return

    const bullet = this.bullets.get(this.x, this.y)
    if (!bullet) return

    bullet.setActive(true).setVisible(true)
    bullet.setDepth(7)
    bullet.setScale(2)
    bullet.body.enable = true

    // Move towards player's current position
    const player = this.scene.player
    this.scene.physics.moveTo(bullet, player.x, player.y, this.bulletSpeed)

    // Auto-destroy after 4 seconds
    this.scene.time.delayedCall(4000, () => {
      if (bullet && bullet.active) {
        bullet.setActive(false).setVisible(false)
        bullet.body.enable = false
      }
    })
  }

  update() {
    if (this.defeated || !this.active) return
    super.update()

    // Face the player
    if (this.scene?.player) {
      this.setFlipX(this.scene.player.x < this.x)
    }
  }

  pauseBehavior() {
    if (this.fireTimer) this.fireTimer.paused = true
  }

  resumeBehavior() {
    if (this.fireTimer) this.fireTimer.paused = false
  }

  defeat() {
    // Clean up bullets and timer
    if (this.fireTimer) {
      this.fireTimer.remove()
      this.fireTimer = null
    }
    this.bullets.clear(true, true)
    super.defeat()
  }

  destroy(fromScene) {
    if (this.fireTimer) {
      this.fireTimer.remove()
      this.fireTimer = null
    }
    if (this.bullets) {
      this.bullets.clear(true, true)
    }
    super.destroy(fromScene)
  }
}
