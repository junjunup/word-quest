<template>
  <div class="shop-overlay" @click.self="$emit('close')">
    <div class="shop-panel">
      <div class="shop-header">
        <h2>🛒 金币商店</h2>
        <div class="shop-gold">🪙 {{ gold }}</div>
        <button class="shop-close" @click="$emit('close')">✕</button>
      </div>

      <div v-if="error" class="shop-error">{{ error }}</div>

      <div class="shop-items">
        <div v-for="item in items" :key="item.id" class="shop-item">
          <div class="item-icon">{{ item.icon }}</div>
          <div class="item-info">
            <strong>{{ item.name }}</strong>
            <span>{{ item.desc }}</span>
          </div>
          <button class="btn item-buy" :disabled="gold < item.price" @click="buy(item.id)">
            🪙 {{ item.price }}
          </button>
        </div>
      </div>

      <div class="shop-inventory" v-if="inventory.length > 0">
        <h3>🎒 我的背包</h3>
        <div class="inv-list">
          <span v-for="item in inventory" :key="item.itemId" class="inv-item">
            {{ item.icon }} {{ item.name }} x{{ item.quantity }}
          </span>
        </div>
        <p class="inv-hint">💡 道具在开始关卡前可选择使用</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getInventory, buyItem } from '@/api/dailyChallenge'

const emit = defineEmits(['close'])
const gold = ref(0)
const inventory = ref([])
const error = ref('')

const items = [
  { id: 'shield', icon: '🛡️', name: '护盾', desc: '下一关答错不扣命', price: 100 },
  { id: 'time_extend', icon: '⏰', name: '时间宝珠', desc: '下一关每题+10秒', price: 75 },
  { id: 'precision', icon: '🎯', name: '精准药剂', desc: '下一关只显示2个选项', price: 150 },
  { id: 'double_gold', icon: '💰', name: '双倍金币符', desc: '下一关金币翻倍', price: 120 },
  { id: 'extra_life', icon: '❤️', name: '生命之泉', desc: '下一关+1条命', price: 200 }
]

onMounted(loadInventory)

async function loadInventory() {
  try {
    const res = await getInventory()
    gold.value = res.data?.gold || 0
    inventory.value = res.data?.inventory || []
  } catch (e) {
    error.value = '加载失败'
  }
}

async function buy(itemId) {
  error.value = ''
  try {
    const res = await buyItem(itemId)
    gold.value = res.data?.gold || 0
    inventory.value = res.data?.inventory || []
  } catch (e) {
    error.value = e?.response?.data?.message || '金币不足'
  }
}
</script>

<style scoped lang="scss">
.shop-overlay {
  position: fixed; inset: 0; background: rgba(45, 80, 22, 0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; animation: fadeIn 0.2s ease;
}
.shop-panel {
  width: 480px; max-width: 95%; max-height: 85vh; overflow-y: auto;
  background: linear-gradient(180deg, #2d3a1a 0%, #1a2a0a 100%);
  border: 2px solid #8b6914; border-radius: 14px; padding: 20px;
  color: #f5edd6;
}
.shop-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
  h2 { color: #ffd700; margin: 0; font-size: 22px; }
}
.shop-gold {
  background: rgba(255,215,0,0.15); border: 1px solid rgba(255,215,0,0.3);
  border-radius: 8px; padding: 4px 12px; color: #ffd700; font-weight: bold;
  font-size: 16px; margin-left: auto;
}
.shop-close {
  background: #d45b3e; border: none; color: #fff; width: 28px; height: 28px;
  border-radius: 50%; cursor: pointer; font-size: 14px;
  &:hover { background: #e06b4e; }
}
.shop-error { color: #ff6666; margin-bottom: 12px; font-size: 13px; }
.shop-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.shop-item {
  display: flex; align-items: center; gap: 12px; padding: 12px;
  background: rgba(255,255,255,0.05); border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
}
.item-icon { font-size: 28px; flex-shrink: 0; }
.item-info { flex: 1; strong { color: #f5edd6; display: block; } span { color: #aab; font-size: 12px; } }
.item-buy {
  min-width: 80px; padding: 8px 14px; background: #5b8c3e; border: 2px solid #3a6b1e;
  color: #ffd700; font-weight: bold; border-radius: 8px; cursor: pointer;
  &:disabled { opacity: 0.35; cursor: not-allowed; }
  &:not(:disabled):hover { background: #6b9c4e; border-color: #ffc847; }
}
.shop-inventory {
  border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;
  h3 { color: #e8a33c; margin: 0 0 8px; font-size: 16px; }
}
.inv-list { display: flex; flex-wrap: wrap; gap: 8px; }
.inv-item {
  background: rgba(255,200,71,0.1); border: 1px solid rgba(255,200,71,0.2);
  border-radius: 6px; padding: 4px 10px; font-size: 13px; color: #ffc847;
}
.inv-hint { color: #8b8; font-size: 12px; margin-top: 10px; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
