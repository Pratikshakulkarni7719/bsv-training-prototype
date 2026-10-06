<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0 sm:flex-1">
      <slot name="back" />
      <h1 class="text-2xl font-bold text-ink">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-2 sm:max-w-[65%] sm:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
