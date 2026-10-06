<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: '' },
  icon: { type: [Object, Function], default: null }
})
</script>

<template>
  <div class="card p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-slate-500">{{ label }}</p>
      <component :is="icon" v-if="icon" class="size-5 text-brand-600" />
    </div>
    <p class="mt-2 text-3xl font-bold text-ink">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
