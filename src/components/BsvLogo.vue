<script setup>
import { computed } from 'vue'
import logo from '@/assets/bsv-logo.png'

// variant 'full' = the whole logo (transparent PNG; on dark backgrounds put it on a white card for contrast)
// variant 'mark' = only the round icon, cropped from the same image, for avatars
const props = defineProps({
  variant: { type: String, default: 'full' },
  size: { type: Number, default: 36 } // full: logo height in px · mark: circle size in px
})

// The round icon inside the 803 × 311 logo (as fractions of the image)
const ICON = { x0: 0, y0: 0, x1: 0.31, y1: 0.74 }

const markImg = computed(() => {
  // Icon fills about 80% of the circle, centred
  const iconW = props.size * 0.8
  const w = iconW / (ICON.x1 - ICON.x0)
  const h = w / (803 / 311)
  const iconH = (ICON.y1 - ICON.y0) * h
  return {
    width: `${w}px`,
    height: `${h}px`,
    left: `${(props.size - iconW) / 2 - ICON.x0 * w}px`,
    top: `${(props.size - iconH) / 2 - ICON.y0 * h}px`
  }
})
</script>

<template>
  <span
    v-if="variant === 'mark'"
    class="relative inline-block shrink-0 overflow-hidden rounded-full bg-white"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img :src="logo" alt="BSV" class="absolute max-w-none" :style="markImg" />
  </span>
  <img v-else :src="logo" alt="BSV - bringing life to life" class="inline-block w-auto align-middle" :style="{ height: `${size}px` }" />
</template>
