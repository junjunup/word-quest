import RoamingBoss from './RoamingBoss'
import TurretBoss from './TurretBoss'
import ChargingBoss from './ChargingBoss'

const BOSS_CLASSES = {
  roaming: RoamingBoss,
  turret: TurretBoss,
  charging: ChargingBoss
}

/**
 * Boss工厂函数
 * @param {Phaser.Scene} scene - 当前场景
 * @param {number} x - 生成X坐标
 * @param {number} y - 生成Y坐标
 * @param {object} config - Boss配置 { bossType, name, baseHp, speed, difficulty }
 * @returns {Boss} Boss实例
 */
export function createBoss(scene, x, y, config) {
  const BossClass = BOSS_CLASSES[config.bossType] || RoamingBoss
  return new BossClass(scene, x, y, config)
}

/**
 * 根据章节和关卡号获取Boss类型
 * x-1: roaming, x-2: turret, x-3: charging, x-4: roaming, x-5: turret
 */
export function getBossTypeForLevel(chapter, level) {
  const types = ['roaming', 'turret', 'charging', 'roaming', 'turret']
  return types[(level - 1) % types.length]
}
