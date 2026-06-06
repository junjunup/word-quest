  onNPCInteract(player, npc) {
    if (this.isPaused || this.npcCooldown) return
    this.isPaused = true
    this.npcCooldown = true
    player.setVelocity(0, 0)
    audioManager.pauseBGM(300, 'chat')

    const dx = player.x - npc.x
    const dy = player.y - npc.y
    const dist = Math.hypot(dx, dy) || 1
    player.setVelocity((dx / dist) * 300, (dy / dist) * 300)
    this.time.delayedCall(200, () => {
      if (player.active) player.setVelocity(0, 0)
    })

    eventBus.emit(EVENTS.SHOW_CHAT, {
      npcType: npc.getData('type'),
      chapter: this.chapter,
      level: this.level
    })
  }

  onQuizAnswered(data) {
    if (!this.scene?.isActive()) return
    const { monsterIndex, isCorrect, score, gameOver = false } = data

    if (gameOver) {
      audioManager.play(isCorrect ? 'correct' : 'wrong')
      return
