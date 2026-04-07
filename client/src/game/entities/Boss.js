import Phaser from 'phaser'

/**
 * Boss 基类 - 继承 Phaser.Physics.Arcade.Sprite
 * 提供HP条、名称标签、击败动画等通用功能
 */
export default class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config) {
    // 使用cow_sheet作为Boss贴图
    const textureKey = scene.textures.exists('cow_sheet') ? 'cow_sheet' : 'npc'
    super(scene, x, y, textureKey, 0)

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.scene = scene
    this.bossType = config.bossType || 'roaming'
    this.bossName = config.name || '👹 BOSS'
    this.hp = config.baseHp || 3
    this.maxHp = this.hp
    this.speed = config.speed || 30
    this.defeated = false
    this.isActive = true

    // Visual setup
    this.setScale(3)
    this.setDepth(8)
    this.body.setSize(24, 24)
    this.body.setOffset(4, 4)
    this.setImmovable(true)

    // Play cow animation
    if (scene.anims.exists('cow_idle')) {
      this.play('cow_idle')
    }

    // Apply boss tint based on type
    const tints = {
      roaming: 0xff6666,
      turret: 0xaa66ff,
      charging: 0xff9933
    }
    this.setTint(tints[this.bossType] || 0xff6666)

    // HP bar graphics
    this.hpBarBg = scene.add.graphics().setDepth(9)
    this.hpBarFill = scene.add.graphics().setDepth(9)

    // Name label
    this.nameLabel = scene.add.text(x, y - 40, `👹 ${this.bossName}`, {
      fontSize: '10px',
      fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#ff4444',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(9)

    // Glow effect (alpha pulsing)
    scene.tweens.add({
      targets: this,
      alpha: { from: 0.85, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.updateHpBar()
  }

  updateHpBar() {
    const barWidth = 50
    const barHeight = 6
    const x = this.x - barWidth / 2
    const y = this.y - 50

    this.hpBarBg.clear()
    this.hpBarBg.fillStyle(0x333333, 0.8)
    this.hpBarBg.fillRect(x, y, barWidth, barHeight)
    this.hpBarBg.lineStyle(1, 0x000000)
    this.hpBarBg.strokeRect(x, y, barWidth, barHeight)

    this.hpBarFill.clear()
    const fillWidth = (this.hp / this.maxHp) * barWidth
    const color = this.hp > this.maxHp / 2 ? 0xff4444 : (this.hp > 1 ? 0xff8800 : 0xff0000)
    this.hpBarFill.fillStyle(color, 1)
    this.hpBarFill.fillRect(x, y, fillWidth, barHeight)
  }

  takeDamage() {
    if (this.defeated) return

    this.hp--
    this.updateHpBar()

    // Camera shake feedback
    this.scene.cameras.main.shake(200, 0.01)

    // Flash white briefly
    this.setTintFill(0xffffff)
    this.scene.time.delayedCall(100, () => {
      if (this.active) {
        const tints = { roaming: 0xff6666, turret: 0xaa66ff, charging: 0xff9933 }
        this.setTint(tints[this.bossType] || 0xff6666)
      }
    })

    if (this.hp <= 0) {
      this.defeat()
    }
  }

  defeat() {
    this.defeated = true
    this.isActive = false

    // Stop physics
    this.body.setVelocity(0, 0)
    this.body.enable = false

    // Explosion particle effect
    this.spawnDefeatParticles()

    // Boss defeat animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0,
      angle: 360,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        // Guard: scene may have shutdown during animation
        if (!this.scene || !this.scene.scene?.isActive()) return
        this.cleanupVisuals()
        if (this.active) this.destroy()
      }
    })

    // Score bonus for defeating boss - visual effect only
    // Actual score accounting happens in WorldScene.onBossQuizResult
    const bossScore = 500
    this.scene.spawnCoinEffect(this.x, this.y, bossScore)
  }

  spawnDefeatParticles() {
    const colors = [0xffc847, 0xff6666, 0xffaa00, 0xff4444]
    for (let i = 0; i < 12; i++) {
      const particleKey = this.scene.textures.exists('boss_particle') ? 'boss_particle' : 'coin'
      const particle = this.scene.add.image(this.x, this.y, particleKey)
        .setDepth(20)
        .setScale(1.5)
        .setTint(colors[i % colors.length])

      this.scene.tweens.add({
        targets: particle,
        x: this.x + Phaser.Math.Between(-80, 80),
        y: this.y + Phaser.Math.Between(-80, 80),
        alpha: 0,
        scale: 0,
        duration: 600,
        delay: i * 50,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      })
    }
  }

  cleanupVisuals() {
    if (this.hpBarBg) { this.hpBarBg.destroy(); this.hpBarBg = null }
    if (this.hpBarFill) { this.hpBarFill.destroy(); this.hpBarFill = null }
    if (this.nameLabel) { this.nameLabel.destroy(); this.nameLabel = null }
  }

  updateVisualPositions() {
    if (!this.active || this.defeated) return
    if (this.nameLabel) {
      this.nameLabel.setPosition(this.x, this.y - 40)
    }
    this.updateHpBar()
  }

  update() {
    if (this.defeated || !this.active) return
    this.updateVisualPositions()
  }

  destroy(fromScene) {
    this.cleanupVisuals()
    super.destroy(fromScene)
  }
}
