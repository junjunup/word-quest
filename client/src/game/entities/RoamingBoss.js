import Boss from './Boss'
import Phaser from 'phaser'

/**
 * 游荡Boss - 沿巡逻点缓慢移动
 * 玩家需要追上接触触发答题
 */
export default class RoamingBoss extends Boss {
  constructor(scene, x, y, config) {
    super(scene, x, y, { ...config, bossType: 'roaming' })

    this.patrolPoints = []
    this.currentPatrolIndex = 0
    this.patrolSpeed = config.speed || 30

    // Generate 4-6 random patrol waypoints
    this.generatePatrolPoints()
    this.setImmovable(false)
    this.body.setCollideWorldBounds(true)
  }

  generatePatrolPoints() {
    const count = Phaser.Math.Between(4, 6)
    // Generate points within the map area (away from walls)
    for (let i = 0; i < count; i++) {
      this.patrolPoints.push({
        x: Phaser.Math.Between(200, 750),
        y: Phaser.Math.Between(100, 550)
      })
    }
  }

  update() {
    if (this.defeated || !this.active) return
    super.update()

    if (this.patrolPoints.length === 0) return

    const target = this.patrolPoints[this.currentPatrolIndex]
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y)

    if (dist < 10) {
      // Reached waypoint, move to next
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
    } else {
      // Move towards target
      this.scene.physics.moveTo(this, target.x, target.y, this.patrolSpeed)

      // Flip sprite based on direction
      if (target.x < this.x) {
        this.setFlipX(true)
      } else {
        this.setFlipX(false)
      }
    }
  }

  pauseBehavior() {
    this.body.setVelocity(0, 0)
    this._wasPaused = true
  }

  resumeBehavior() {
    this._wasPaused = false
  }
}
