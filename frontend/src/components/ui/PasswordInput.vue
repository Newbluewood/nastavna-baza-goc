<script setup>
import { ref } from 'vue'
import { useLangStore } from '../../stores/lang'

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '••••••••' },
  autocomplete: { type: String, default: 'current-password' },
  id: { type: String, default: undefined }
})

const emit = defineEmits(['update:modelValue', 'enter'])

const langStore = useLangStore()
const visible = ref(false)

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const onEnter = () => {
  emit('enter')
}
</script>

<template>
  <div class="password-wrap">
    <input
      :id="id"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      class="password-input"
      @input="onInput"
      @keyup.enter="onEnter"
    />
    <button
      type="button"
      class="toggle-btn"
      :aria-label="visible ? langStore.t('guest.hidePassword') : langStore.t('guest.showPassword')"
      :title="visible ? langStore.t('guest.hidePassword') : langStore.t('guest.showPassword')"
      @click="visible = !visible"
    >
      <!-- eye open -->
      <svg v-if="!visible" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <!-- eye off -->
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.password-wrap {
  position: relative;
  display: block;
}

.password-input {
  width: 100%;
  padding: 11px 44px 11px 14px;
  border: 1px solid #ddd;
  background: #fafafa;
  font-size: 0.95rem;
  color: #332317;
  outline: none;
  border-radius: 0;
  box-sizing: border-box;
  transition: border-color 0.2s, background 0.2s;
}

.password-input:focus {
  border-color: #cdac91;
  background: #fff;
}

.toggle-btn {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
}

.toggle-btn:hover {
  color: #332317;
}
</style>
