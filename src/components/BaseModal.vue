<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  size: { type: String, default: 'md' }
})
const emit = defineEmits(['close'])

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  }
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
        <div class="absolute inset-0 bg-slate-900/50" @click="emit('close')" />
        <div
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          :class="['relative w-full rounded-xl bg-white shadow-xl', widths[size]]"
        >
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-ink">{{ title }}</h2>
            <button
              type="button"
              class="rounded text-slate-400 hover:text-slate-600"
              aria-label="Close"
              @click="emit('close')"
            >
              <X class="size-5" />
            </button>
          </div>
          <div class="max-h-[70vh] overflow-y-auto px-6 py-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
