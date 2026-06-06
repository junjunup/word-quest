import Phaser from 'phaser'

/**
 * 怪物 AI 状态机 — Word Dungeon 战斗系统
 * 状态: PATROL（巡逻）→ PURSUE（追击）→ ATTACK（攻击）
 */
const STATE = { PATROL: 'patrol', PURSUE: 'pursue', ATTACK: 'attack' }

export default class MonsterAI {
  /**
   * @param {Phaser.Physics.Arcade.Sprite} monster 怪物 sprite
   * @param {object} config AI 参数配置
   */
  constructor(monster, config = {}) {
    this.monster = monster
    this.scene = monster.scene
    this.state = STATE.PATROL
    this.prevState = STATE.PATROL

    // 可配置参数（带默认值）
    this.patrolSpeed = config.patrolSpeed || 30
    this.pursueSpeed = config.pursueSpeed || 80
    this.perceptionRange = config.perceptionRange || 150
    this.attackDamage = config.attackDamage || 1
    this.attackCooldown = config.attackCooldown || 1500
    this.knockbackDist = config.knockbackDist || 150
    this.loseTargetTime = config.loseTargetTime || 3000

    // 巡逻路径点
    this.patrolPoints = config.patrolPoints || []
    this.currentPatrolIdx = 0

    // 内部状态
    this.lastAttackTime = 0
    this.lostTargetTimer = 0
    this.target = null  // 当前追击目标 (player sprite)
    this.isDefeated = false
  }

  /** 标记怪物为已击败 */
  defeat() {
    this.isDefeated = true
    this.state = STATE.PATROL
    this.monster.setVelocity(0, 0)
    this.monster.setAlpha(0.3)
    this.monster.body.enable = false
  }

  /**
   * 每帧由 WorldScene.update 调用
   * @param {Phaser.Physics.Arcade.Sprite} player 玩家 sprite
   * @param {number} delta 帧间隔
   * @param {number} timeScale 当前时间缩放系数
   */
  update(player, delta, timeScale = 1.0) {
    if (this.isDefeated || !this.monster.active) return

    const dist = player ? Phaser.Math.Distance.Between(this.monster.x, this.monster.y, player.x, player.y) : Infinity

    switch (this.state) {
      case STATE.PATROL:
        this._updatePatrol(delta, timeScale)
        if (player && dist <= this.perceptionRange) {
          this._changeState(STATE.PURSUE)
          this.target = player
        }
        break

      case STATE.PURSUE:
        if (!player) { this._changeState(STATE.PATROL); break }
        this._moveToward(player.x, player.y, this.pursueSpeed * timeScale)
        if (dist > this.perceptionRange * 1.5) {
          this.lostTargetTimer += delta
          if (this.lostTargetTimer >= this.loseTargetTime) {
            this._changeState(STATE.PATROL)
            this.target = null
            this.lostTargetTimer = 0
          }
        } else {
          this.lostTargetTimer = 0
        }
        break

      case STATE.ATTACK:
        // 攻击后短暂停留，由外部触发切回 PURSUE
        break
    }
  }

  /** 巡逻逻辑：沿路径点往返移动 */
  _updatePatrol(delta, timeScale) {
    if (this.patrolPoints.length === 0) return
    const target = this.patrolPoints[this.currentPatrolIdx]
    const dist = Phaser.Math.Distance.Between(this.monster.x, this.monster.y, target.x, target.y)
    if (dist < 8) {
      this.currentPatrolIdx = (this.currentPatrolIdx + 1) % this.patrolPoints.length
    } else {
      this._moveToward(target.x, target.y, this.patrolSpeed * timeScale)
    }
  }

  /** 移动到指定坐标 */
  _moveToward(x, y, speed) {
    if (speed <= 0) { this.monster.setVelocity(0, 0); return }
    this.scene.physics.moveTo(this.monster, x, y, speed)
    this.monster.setFlipX(x < this.monster.x)
  }

  /** 怪物碰到玩家 — 由 WorldScene 碰撞回调调用 */
  onHitPlayer(player, onDamage) {
    const now = Date.now()
    if (now - this.lastAttackTime < this.attackCooldown) return
    this.lastAttackTime = now
    this._changeState(STATE.ATTACK)

    // 扣血回调
    if (onDamage) onDamage(this.attackDamage)

    // 击退玩家
    const angle = Phaser.Math.Angle.Between(this.monster.x, this.monster.y, player.x, player.y)
    player.setVelocity(Math.cos(angle) * this.knockbackDist, Math.sin(angle) * this.knockbackDist)
    // 短暂无敌闪烁
    player.setAlpha(0.5)
    player.scene.time.delayedCall(200, () => {
      if (player.active) player.setVelocity(0, 0)
    })

    // 短暂后退后恢复追击
    this.scene.time.delayedCall(300, () => {
      if (this.state === STATE.ATTACK && !this.isDefeated) {
        this._changeState(STATE.PURSUE)
      }
    })
  }

  /** 状态切换 */
  _changeState(newState) {
    this.prevState = this.state
    this.state = newState
  }

  /** 获取当前状态 */
  getState() { return this.state }

  /** 获取巡逻点（渲染用） */
  getPatrolPoints() { return this.patrolPoints }
}

export { STATE }
