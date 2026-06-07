import Phaser from 'phaser'

/**
 * 怪物 AI 状态机 — Word Dungeon v2
 * 支持三种怪物类型：近战(melee) / 远程(ranged) / 法术(caster)
 *
 * 近战: PATROL → PURSUE → ATTACK（碰撞伤害）
 * 远程: PATROL → PURSUE(保持距离) → RANGED_ATTACK（发射弹幕）
 * 法术: PATROL → PURSUE(接近) → CASTING（范围预警 → 伤害）
 */
const STATE = { PATROL: 'patrol', PURSUE: 'pursue', ATTACK: 'attack', RANGED_ATTACK: 'ranged_attack', CASTING: 'casting' }

export default class MonsterAI {
  /**
   * @param {Phaser.Physics.Arcade.Sprite} monster
   * @param {object} config
   * @param {'melee'|'ranged'|'caster'} config.monsterType 怪物类型
   */
  constructor(monster, config = {}) {
    this.monster = monster
    this.scene = monster.scene
    this.state = STATE.PATROL
    this.prevState = STATE.PATROL

    // 怪物类型
    this.monsterType = config.monsterType || 'melee'

    // 通用参数
    this.patrolSpeed = config.patrolSpeed || 30
    this.pursueSpeed = config.pursueSpeed || 80
    this.perceptionRange = config.perceptionRange || 150
    this.attackDamage = config.attackDamage || 1
    this.attackCooldown = config.attackCooldown || 1500
    this.knockbackDist = config.knockbackDist || 150
    this.loseTargetTime = config.loseTargetTime || 3000

    // 远程/法术特有参数
    this.preferredDistance = config.preferredDistance || 120  // 远程保持距离
    this.projectileSpeed = config.projectileSpeed || 160
    this.fireRate = config.fireRate || 2000
    this.castCooldown = config.castCooldown || 3000
    this.castRadius = config.castRadius || 70
    this.castWarnTime = config.castWarnTime || 1000  // 预警时间

    // 巡逻
    this.patrolPoints = config.patrolPoints || []
    this.currentPatrolIdx = 0

    // 内部状态
    this.lastAttackTime = 0
    this.lastFireTime = 0
    this.lastCastTime = 0
    this.lostTargetTimer = 0
    this.target = null
    this.isDefeated = false
    this._frozen = false
    this._casting = false

    // 回调（由 WorldScene 设置）
    this.onFireProjectile = null   // ({ x, y, tx, ty, speed, damage }) => void
    this.onCastArea = null         // ({ x, y, radius, damage, delay }) => void
  }

  /** 标记为已击败 */
  defeat() {
    this.isDefeated = true
    this.state = STATE.PATROL
    this.monster.setVelocity(0, 0)
    this.monster.setAlpha(0.3)
    this.monster.body.enable = false
  }

  /** 冻结（法杖武器效果） */
  freeze(duration) {
    if (this.isDefeated || this._frozen) return
    this._frozen = true
    this.monster.setVelocity(0, 0)
    this.monster.setTint(0x6699ff)
    this.scene.time.delayedCall(duration, () => {
      if (!this.isDefeated && this.monster.active) {
        this._frozen = false
        this.monster.clearTint()
      }
    })
  }

  isFrozen() { return !!this._frozen }

  /**
   * 每帧由 WorldScene.update 调用
   */
  update(player, delta, timeScale = 1.0) {
    if (this.isDefeated || this._frozen || !this.monster.active) return

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
        this._updatePursue(player, dist, delta, timeScale)
        break

      case STATE.ATTACK:
        // 碰撞攻击后短暂停留，由 onHitPlayer 切回
        break

      case STATE.RANGED_ATTACK:
        // 开火后冷却，自动切回
        break

      case STATE.CASTING:
        // 施法中，等待回调切回
        break
    }
  }

  /** 追击逻辑（根据怪物类型差异化） */
  _updatePursue(player, dist, delta, timeScale) {
    // 丢失目标检测
    if (dist > this.perceptionRange * 1.5) {
      this.lostTargetTimer += delta
      if (this.lostTargetTimer >= this.loseTargetTime) {
        this._changeState(STATE.PATROL)
        this.target = null
        this.lostTargetTimer = 0
        return
      }
    } else {
      this.lostTargetTimer = 0
    }

    if (this.monsterType === 'ranged') {
      // 远程：保持 preferredDistance，太近后退，太远靠近
      if (dist > this.preferredDistance + 30) {
        this._moveToward(player.x, player.y, this.pursueSpeed * timeScale)
      } else if (dist < this.preferredDistance - 20) {
        // 后退
        const angle = Phaser.Math.Angle.Between(player.x, player.y, this.monster.x, this.monster.y)
        this.monster.setVelocity(
          Math.cos(angle) * this.pursueSpeed * timeScale,
          Math.sin(angle) * this.pursueSpeed * timeScale
        )
      } else {
        this.monster.setVelocity(0, 0)
      }
      // 尝试开火
      this._tryFireProjectile(player)
    } else if (this.monsterType === 'caster') {
      // 法术：接近到 200px 后停止并施法
      if (dist > 200) {
        this._moveToward(player.x, player.y, this.pursueSpeed * timeScale)
      } else {
        this.monster.setVelocity(0, 0)
        this._tryCastArea(player)
      }
    } else {
      // 近战：直接靠近
      this._moveToward(player.x, player.y, this.pursueSpeed * timeScale)
    }
  }

  /** 尝试发射弹幕 */
  _tryFireProjectile(player) {
    const now = Date.now()
    if (now - this.lastFireTime < this.fireRate) return
    this.lastFireTime = now
    this._changeState(STATE.RANGED_ATTACK)

    if (this.onFireProjectile) {
      this.onFireProjectile({
        x: this.monster.x, y: this.monster.y,
        tx: player.x, ty: player.y,
        speed: this.projectileSpeed,
        damage: this.attackDamage
      })
    }

    // 短暂延迟后恢复追击
    this.scene.time.delayedCall(400, () => {
      if (this.state === STATE.RANGED_ATTACK && !this.isDefeated) {
        this._changeState(STATE.PURSUE)
      }
    })
  }

  /** 尝试施放范围法术 */
  _tryCastArea(player) {
    if (this._casting) return
    const now = Date.now()
    if (now - this.lastCastTime < this.castCooldown) return
    this.lastCastTime = now
    this._casting = true
    this._changeState(STATE.CASTING)

    // 视觉：短暂闪烁
    this.monster.setTint(0xff4444)
    this.scene.time.delayedCall(300, () => {
      if (!this.isDefeated && this.monster.active) this.monster.clearTint()
    })

    if (this.onCastArea) {
      this.onCastArea({
        x: player.x, y: player.y,
        radius: this.castRadius,
        damage: this.attackDamage,
        delay: this.castWarnTime
      })
    }

    // 施法完成后恢复
    this.scene.time.delayedCall(this.castWarnTime + 200, () => {
      this._casting = false
      if (this.state === STATE.CASTING && !this.isDefeated) {
        this._changeState(STATE.PURSUE)
      }
    })
  }

  /** 巡逻 */
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

  /** 移动到坐标 */
  _moveToward(x, y, speed) {
    if (speed <= 0) { this.monster.setVelocity(0, 0); return }
    this.scene.physics.moveTo(this.monster, x, y, speed)
    this.monster.setFlipX(x < this.monster.x)
  }

  /** 近战碰撞 — 由 WorldScene 碰撞回调调用 */
  onHitPlayer(player, onDamage) {
    if (this.monsterType !== 'melee') return  // 仅近战触发碰撞
    const now = Date.now()
    if (now - this.lastAttackTime < this.attackCooldown) return
    this.lastAttackTime = now
    this._changeState(STATE.ATTACK)

    if (onDamage) onDamage(this.attackDamage)

    const angle = Phaser.Math.Angle.Between(this.monster.x, this.monster.y, player.x, player.y)
    player.setVelocity(Math.cos(angle) * this.knockbackDist, Math.sin(angle) * this.knockbackDist)
    player.setAlpha(0.5)
    player.scene.time.delayedCall(200, () => {
      if (player.active) player.setVelocity(0, 0)
    })

    this.scene.time.delayedCall(300, () => {
      if (this.state === STATE.ATTACK && !this.isDefeated) {
        this._changeState(STATE.PURSUE)
      }
    })
  }

  _changeState(newState) {
    this.prevState = this.state
    this.state = newState
  }

  getState() { return this.state }
  getPatrolPoints() { return this.patrolPoints }
}

export { STATE }
