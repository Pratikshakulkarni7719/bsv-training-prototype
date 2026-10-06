<script setup>
import { MessageCircle, Send, ChartColumn } from 'lucide-vue-next'
import BsvLogo from '@/components/BsvLogo.vue'
</script>

<template>
  <div class="flex min-h-screen">
    <div class="hidden w-1/2 flex-col justify-between bg-ink p-12 text-white lg:flex">
      <div class="flex items-center gap-4">
        <span class="rounded-xl bg-white px-3 py-2"><BsvLogo :size="48" /></span>
        <p class="text-lg font-bold">Compliance Connect</p>
      </div>
      <div>
        <h2 class="text-4xl font-bold leading-tight">Compliance, right inside<br />your team's WhatsApp.</h2>
        <ul class="mt-8 space-y-4 text-slate-300">
          <li class="flex items-center gap-3"><Send class="size-5 text-brand-500" /> Send quick checks, scenarios and nuggets to every employee</li>
          <li class="flex items-center gap-3"><MessageCircle class="size-5 text-brand-500" /> Employees ask policy questions and get instant answers</li>
          <li class="flex items-center gap-3"><ChartColumn class="size-5 text-brand-500" /> See who responded, who understood, and what is unclear</li>
        </ul>
      </div>
      <p class="text-sm text-slate-500">Static prototype · Phase 1 + Phase 2 scope</p>
    </div>
    <div class="flex w-full items-center justify-center bg-white px-4 py-12 lg:w-1/2">
      <div class="w-full max-w-sm">
        <BsvLogo :size="56" class="mb-8 lg:hidden" />
        <slot />
      </div>
    </div>
  </div>
</template>
