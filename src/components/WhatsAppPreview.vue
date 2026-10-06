<script setup>
import { computed } from 'vue'
import { ArrowLeft, Play, CheckCheck } from 'lucide-vue-next'
import { fillTemplate } from '@/data/store'
import BsvLogo from '@/components/BsvLogo.vue'

const props = defineProps({
  businessName: { type: String, default: 'BSV Compliance' },
  header: { type: String, default: 'None' },
  videoTitle: { type: String, default: '' },
  videoThumb: { type: String, default: 'from-emerald-400 to-teal-600' },
  body: { type: String, default: '' },
  content: { type: String, default: '' },
  buttons: { type: Array, default: () => [] },
  sampleName: { type: String, default: 'Ramesh Patil' },
  // Shows the employee tapping this option and the bot's reply
  tapped: { type: String, default: '' },
  reply: { type: String, default: '' }
})

const filledBody = computed(() => fillTemplate(props.body || 'Your message will appear here.', props.sampleName, props.content || '[your content]'))
</script>

<template>
  <div class="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-8 border-slate-800 bg-slate-800 shadow-xl">
    <div class="flex items-center gap-3 bg-wa-header px-3 py-3 text-white">
      <ArrowLeft class="size-4" />
      <BsvLogo variant="mark" :size="32" />
      <div>
        <p class="text-sm font-semibold leading-tight">{{ businessName }}</p>
        <p class="text-[11px] text-white/70">Business account</p>
      </div>
    </div>
    <div class="min-h-[380px] space-y-2 bg-wa-chat p-3">
      <div class="max-w-[90%] rounded-lg rounded-tl-none bg-white p-1.5 shadow-sm">
        <div v-if="header === 'Video'" :class="['relative flex h-32 items-center justify-center rounded-md bg-linear-to-br', videoThumb]">
          <span class="flex size-10 items-center justify-center rounded-full bg-black/40">
            <Play class="size-5 fill-white text-white" />
          </span>
          <span class="absolute bottom-1 left-2 text-[11px] font-medium text-white drop-shadow">{{ videoTitle || 'Choose a video' }}</span>
        </div>
        <p class="whitespace-pre-line break-words px-1.5 pt-1.5 text-[13px] leading-snug text-slate-800">{{ filledBody }}</p>
        <p class="px-1.5 pb-0.5 text-right text-[10px] text-slate-400">10:00</p>
        <div v-if="buttons.length" class="mt-1 divide-y divide-slate-100 border-t border-slate-100">
          <p v-for="b in buttons" :key="b" class="py-1.5 text-center text-[13px] font-medium text-sky-600">{{ b }}</p>
        </div>
      </div>
      <template v-if="tapped">
        <div class="ml-auto w-fit max-w-[80%] rounded-lg rounded-tr-none bg-wa-bubble px-3 py-2 shadow-sm">
          <p class="text-[13px] text-slate-800">{{ tapped }}</p>
          <p class="flex items-center justify-end gap-1 text-[10px] text-slate-400">10:02 <CheckCheck class="size-3 text-sky-500" /></p>
        </div>
        <div v-if="reply" class="max-w-[90%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
          <p class="whitespace-pre-line text-[13px] text-slate-800">{{ reply }}</p>
          <p class="text-right text-[10px] text-slate-400">10:02</p>
        </div>
      </template>
    </div>
  </div>
</template>
