/**
 * 本地背包系统 — localStorage 持久化
 * 管理装备/消耗品/金币的携带与阵亡丢失
 */
const STORAGE_KEY = 'wordquest:inventory'

// 默认装备数据
const DEFAULT_WEAPONS = [
  { id: 'sword', name: '木剑', icon: '⚔️', desc: '拼写模式：看中文释义输入英文', owned: true },
  { id: 'bow', name: '猎弓', icon: '🏹', desc: '听力模式：听发音输入英文', owned: false, unlockLevel: 5, price: 500 },
  { id: 'staff', name: '法杖', icon: '🪄', desc: '词义模式：看英文选中文', owned: false, unlockLevel: 10, price: 800 },
  { id: 'hammer', name: '战锤', icon: '🔨', desc: '语境模式：填句子空缺', owned: false, unlockLevel: 15, price: 1200 }
]

const DEFAULT_ARMORS = [
  { id: 'cloth', name: '布衣', icon: '👘', hpBonus: 1, price: 0, owned: true },
  { id: 'leather', name: '皮甲', icon: '🦺', hpBonus: 2, price: 100, owned: false },
  { id: 'iron', name: '铁甲', icon: '🛡️', hpBonus: 3, price: 300, owned: false }
]

const DEFAULT_CONSUMABLES = [
  { id: 'health_potion', name: '生命药水', icon: '🧪', effect: 'heal', value: 2, price: 50 },
  { id: 'freeze_scroll', name: '冻结卷轴', icon: '📜', effect: 'freeze', value: 5, price: 80 },
  { id: 'bomb', name: '炸弹', icon: '💣', effect: 'stun', value: 3, price: 100 }
]

class Inventory {
  constructor() {
    this.data = this._load()
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch (e) { /* ignore */ }
    return this._defaultData()
  }

  _defaultData() {
    return {
      gold: 100,
      equippedWeapon: 'sword',
      equippedArmor: 'cloth',
      weapons: JSON.parse(JSON.stringify(DEFAULT_WEAPONS)),
      armors: JSON.parse(JSON.stringify(DEFAULT_ARMORS)),
      consumables: [
        { id: 'health_potion', qty: 3 },
        { id: 'freeze_scroll', qty: 1 }
      ]
    }
  }

  _save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)) } catch (e) {} }

  getGold() { return this.data.gold || 0 }
  addGold(amount) { this.data.gold = (this.data.gold || 0) + amount; this._save() }
  spendGold(amount) { if (this.data.gold >= amount) { this.data.gold -= amount; this._save(); return true } return false }

  getEquippedWeapon() { return this.data.equippedWeapon || 'sword' }
  setEquippedWeapon(id) { this.data.equippedWeapon = id; this._save() }

  getEquippedArmor() { return this.data.equippedArmor || 'cloth' }
  setEquippedArmor(id) { this.data.equippedArmor = id; this._save() }
  getArmorBonus() {
    const armor = DEFAULT_ARMORS.find(a => a.id === this.data.equippedArmor)
    return armor ? armor.hpBonus : 1
  }

  getWeapons() { return this.data.weapons || DEFAULT_WEAPONS }
  getArmors() { return this.data.armors || DEFAULT_ARMORS }
  getConsumables() {
    return (this.data.consumables || []).map(c => {
      const def = DEFAULT_CONSUMABLES.find(d => d.id === c.id)
      return { ...def, qty: c.qty || 0 }
    })
  }

  buyWeapon(id, price) {
    const w = this.data.weapons.find(w => w.id === id)
    if (w && !w.owned && this.spendGold(price)) { w.owned = true; this._save(); return true }
    return false
  }

  buyArmor(id, price) {
    const a = this.data.armors.find(a => a.id === id)
    if (a && !a.owned && this.spendGold(price)) { a.owned = true; this._save(); return true }
    return false
  }

  buyConsumable(id, price) {
    if (!this.spendGold(price)) return false
    const existing = this.data.consumables.find(c => c.id === id)
    if (existing) existing.qty = (existing.qty || 0) + 1
    else this.data.consumables.push({ id, qty: 1 })
    this._save(); return true
  }

  /** 阵亡：丢失携带金币和消耗品，保留武器和学习成果 */
  onDeath() {
    this.data.gold = Math.floor(this.data.gold * 0.3)  // 保留30%金币
    this.data.consumables = []  // 消耗品全丢
    this._save()
  }

  /** 撤离成功：保留所有收获 */
  onExtract(goldEarned) {
    this.addGold(goldEarned)
    this._save()
  }
}

export default new Inventory()
export { DEFAULT_WEAPONS, DEFAULT_ARMORS, DEFAULT_CONSUMABLES }
