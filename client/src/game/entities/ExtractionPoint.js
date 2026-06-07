import Phaser from 'phaser'

/** Extraction Point — reach and press E to extract */
export default class ExtractionPoint {
  constructor(scene, x, y) {
    this.scene = scene
    this.used = false
    this.activated = false
    this.x = x
    this.y = y

    // Portal rings (drawn bottom-up)
    this.gfxOuter = scene.add.graphics().setDepth(3)
    this.gfxInner = scene.add.graphics().setDepth(5)

    this._drawNormal()

    this.label = scene.add.text(x, y, '🚪 Extraction', {
      fontSize: '14px', fontFamily: '"Press Start 2P", monospace',
      color: '#aaddff', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(6)

    // Orbiting particles
    this._particles = []
    for (let i = 0; i < 6; i++) {
      const p = scene.add.image(x, y, 'boss_particle')
        .setScale(1.5).setTint(0x88bbff).setDepth(4).setAlpha(0.6)
      this._particles.push({ obj: p, angle: (i / 6) * Math.PI * 2, speed: 0.8 + Math.random() * 0.4 })
    }

    // Pulse tweens
    this._pulseTween = scene.tweens.add({
      targets: [this.label], alpha: { from: 0.5, to: 1 },
      duration: 1200, yoyo: true, repeat: -1
    })

    // Beam (hidden until activated)
    this._beam = scene.add.graphics().setDepth(2).setAlpha(0)
  }

  _drawNormal() {
    // Outer ring
    this.gfxOuter.clear()
    this.gfxOuter.lineStyle(3, 0x4488ff, 0.6)
    this.gfxOuter.strokeCircle(this.x, this.y, 42)
    this.gfxOuter.lineStyle(2, 0x6699cc, 0.3)
    this.gfxOuter.strokeCircle(this.x, this.y, 52)
    // Inner glow
    this.gfxInner.clear()
    this.gfxInner.fillStyle(0x4488ff, 0.2)
    this.gfxInner.fillCircle(this.x, this.y, 36)
    this.gfxInner.lineStyle(2, 0x88bbff, 0.7)
    this.gfxInner.strokeCircle(this.x, this.y, 36)
  }

  _drawActivated() {
    this.gfxOuter.clear()
    this.gfxOuter.lineStyle(3, 0x44ff88, 0.8)
    this.gfxOuter.strokeCircle(this.x, this.y, 42)
    this.gfxOuter.lineStyle(2, 0x44ff88, 0.4)
    this.gfxOuter.strokeCircle(this.x, this.y, 55)
    this.gfxInner.clear()
    this.gfxInner.fillStyle(0x44ff88, 0.5)
    this.gfxInner.fillCircle(this.x, this.y, 36)
    this.gfxInner.lineStyle(3, 0x66ffaa, 0.9)
    this.gfxInner.strokeCircle(this.x, this.y, 36)
    // Light beam (vertical column)
    this._beam.clear()
    this._beam.fillStyle(0x44ff88, 0.12)
    this._beam.fillRect(this.x - 15, this.y - 120, 30, 160)
    this._beam.fillStyle(0xffffff, 0.08)
    this._beam.fillRect(this.x - 6, this.y - 120, 12, 160)
    this.scene.tweens.add({
      targets: this._beam, alpha: { from: 0.3, to: 0.7 },
      duration: 500, yoyo: true, repeat: -1
    })
  }

  /** Activate after all enemies defeated */
  activate() {
    if (this.activated || this.used) return
    this.activated = true
    if (this._pulseTween) this._pulseTween.stop()
    this._drawActivated()
    this.label.setText('🚪 EXTRACT')
    this.label.setColor('#44ff88')
    // Stronger pulse
    this._pulseTween = this.scene.tweens.add({
      targets: [this.label, this.gfxInner, this.gfxOuter],
      alpha: { from: 0.7, to: 1 },
      scale: { from: 1, to: 1.1 },
      duration: 500, yoyo: true, repeat: -1
    })
    // Speed up orbiting particles & tint green
    this._particles.forEach(p => { p.speed = 1.5; p.obj.setTint(0x44ff88); p.obj.setAlpha(0.9) })
  }

  /** Update orbiting particles (called from scene.update) */
  update(time, delta) {
    if (this.used) return
    const dt = delta / 1000
    this._particles.forEach(p => {
      p.angle += p.speed * dt * 2
      p.obj.setPosition(
        this.x + Math.cos(p.angle) * 44,
        this.y + Math.sin(p.angle) * 44
      )
    })
  }

  isPlayerNear(player) {
    if (this.used) return false
    return Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) < 50
  }

  triggerExtraction() {
    this.used = true
    this.label.setText('✅ Extracting...')
    if (this._pulseTween) this._pulseTween.stop()
    // Particle burst
    for (let i = 0; i < 12; i++) {
      const p = this.scene.add.image(this.x, this.y, 'boss_particle')
        .setDepth(20).setTint(this.activated ? 0x44ff88 : 0x88bbff).setScale(2)
      this.scene.tweens.add({
        targets: p, alpha: 0, scale: 0,
        x: this.x + Phaser.Math.Between(-40, 40),
        y: this.y - Phaser.Math.Between(20, 60),
        duration: 600, delay: i * 30,
        onComplete: () => p.destroy()
      })
    }
    // Flash
    const flash = this.scene.add.circle(this.x, this.y, 60, 0xffffff, 0.6).setDepth(19)
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 400, onComplete: () => flash.destroy() })
  }

  destroy() {
    if (this._pulseTween) this._pulseTween.stop()
    this._particles.forEach(p => p.obj.destroy())
    this._particles = []
    if (this.gfxOuter) this.gfxOuter.destroy()
    if (this.gfxInner) this.gfxInner.destroy()
    if (this._beam) this._beam.destroy()
    if (this.label) this.label.destroy()
  }
}
