<script setup>
import { CircleCheck, CircleAlert, X } from 'lucide-vue-next'
import { store } from '@/data/store'

function dismiss(id) {
  const i = store.toasts.findIndex((t) => t.id === id)
  if (i !== -1) store.toasts.splice(i, 1)
}
</script>

<template>
  <div
    aria-live="polite"
    class="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:right-6"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in store.toasts"
        :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-white p-4 shadow-lg ring-1 ring-slate-200"
      >
        <CircleCheck v-if="t.type === 'success'" class="size-5 shrink-0 text-brand-600" />
        <CircleAlert v-else class="size-5 shrink-0 text-red-600" />
        <p class="flex-1 text-sm text-slate-700">{{ t.message }}</p>
        <button
          type="button"
          class="rounded text-slate-400 hover:text-slate-600"
          aria-label="Dismiss"
          @click="dismiss(t.id)"
        >
          <X class="size-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
