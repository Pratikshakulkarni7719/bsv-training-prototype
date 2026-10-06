<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  text: { type: String, default: '' }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <component :is="icon" v-if="icon" class="size-10 text-slate-300" />
    <p class="mt-3 font-semibold text-slate-700">{{ title }}</p>
    <p v-if="text" class="mt-1 max-w-sm text-sm text-slate-500">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
