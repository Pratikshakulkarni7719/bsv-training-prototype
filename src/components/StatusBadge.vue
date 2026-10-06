<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true }
})

const green = 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
const amber = 'bg-amber-50 text-amber-800 ring-amber-600/20'
const red = 'bg-red-50 text-red-700 ring-red-600/20'
const sky = 'bg-sky-50 text-sky-700 ring-sky-600/20'
const grey = 'bg-slate-100 text-slate-700 ring-slate-500/20'

const styles = {
  Approved: green,
  Active: green,
  Consented: green,
  Sent: green,
  Answered: green,
  Connected: green,
  High: green,
  Indexed: green,
  Read: sky,
  Sending: sky,
  Processing: sky,
  Delivered: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  Pending: amber,
  Scheduled: amber,
  'Not answered': amber,
  Medium: amber,
  Draft: grey,
  Inactive: grey,
  'Not registered': grey,
  Rejected: red,
  Failed: red,
  Declined: red,
  Disconnected: red,
  Low: red
}

const cls = computed(() => styles[props.status] ?? grey)
</script>

<template>
  <span :class="['inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', cls]">
    {{ status }}
  </span>
</template>
