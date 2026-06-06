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
        <div v-for="item in items" :key="item.id" class="shop-item" :class="{ ripple: ripplingId === item.id }">
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
const ripplingId = ref(null)

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
  ripplingId.value = itemId
  try {
    const res = await buyItem(itemId)
    gold.value = res.data?.gold || 0
    inventory.value = res.data?.inventory || []
  } catch (e) {
    error.value = e?.response?.data?.message || '金币不足'
  } finally {
    setTimeout(() => { ripplingId.value = null }, 400)
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
  background: linear-gradient(160deg, rgba(30,40,20,0.96) 0%, rgba(20,28,10,0.98) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,200,71,0.2); border-radius: 18px; padding: 24px;
  color: #f5edd6; box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,105,20,0.1);
}
.shop-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  h2 { color: #ffd700; margin: 0; font-size: 24px; text-shadow: 0 0 20px rgba(255,215,0,0.3); }
}
.shop-gold {
  background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,180,0,0.1));
  border: 1px solid rgba(255,215,0,0.35); border-radius: 10px;
  padding: 6px 14px; color: #ffd700; font-weight: bold; font-size: 16px;
  margin-left: auto; box-shadow: 0 0 12px rgba(255,215,0,0.15);
}
.shop-close {
  background: rgba(212,91,62,0.6); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
  font-size: 16px; transition: all 0.2s;
  &:hover { background: #e06b4e; transform: rotate(90deg); }
}
.shop-error { color: #ff8888; margin-bottom: 12px; font-size: 13px; padding: 8px 12px; background: rgba(255,0,0,0.08); border-radius: 8px; }
.shop-items { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.shop-item {
  display: flex; align-items: center; gap: 14px; padding: 16px;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
  border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease; position: relative; overflow: hidden;
  &::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, transparent 40%, rgba(255,200,71,0.08) 100%);
    opacity: 0; transition: opacity 0.3s;
  }
  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255,200,71,0.3);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(255,200,71,0.1);
    &::before { opacity: 1; }
  }
  &.ripple { animation: buyRipple 0.4s ease; }
}
.item-icon { font-size: 32px; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.item-info { flex: 1; strong { color: #fff; display: block; font-size: 15px; } span { color: #aab; font-size: 12px; } }
.item-buy {
  min-width: 85px; padding: 10px 16px;
  background: linear-gradient(135deg, #5b8c3e, #4a7a2e);
  border: 2px solid rgba(255,200,71,0.25); color: #ffd700;
  font-weight: bold; border-radius: 10px; cursor: pointer;
  transition: all 0.2s; font-size: 14px; position: relative; overflow: hidden;
  &:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(0.5); }
  &:not(:disabled):hover {
    background: linear-gradient(135deg, #6b9c4e, #5a8a3e);
    border-color: #ffc847; box-shadow: 0 0 16px rgba(255,200,71,0.3); transform: scale(1.03);
  }
  &:not(:disabled):active { transform: scale(0.96); }
}
.shop-inventory {
  border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;
  h3 { color: #e8a33c; margin: 0 0 10px; font-size: 16px; }
}
.inv-list { display: flex; flex-wrap: wrap; gap: 8px; }
.inv-item {
  background: linear-gradient(135deg, rgba(255,200,71,0.12), rgba(255,180,0,0.06));
  border: 1px solid rgba(255,200,71,0.2); border-radius: 8px;
  padding: 6px 12px; font-size: 13px; color: #ffc847; transition: transform 0.2s;
  &:hover { transform: scale(1.05); }
}
.inv-hint { color: #888; font-size: 12px; margin-top: 12px; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes buyRipple { 0% { box-shadow: 0 0 0 0 rgba(255,200,71,0.4); } 100% { box-shadow: 0 0 0 20px rgba(255,200,71,0); } }
</style>
