<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Play, Send, Search, CheckCheck, Info, UserRoundX } from 'lucide-vue-next'
import StatusBadge from '@/components/StatusBadge.vue'
import BsvLogo from '@/components/BsvLogo.vue'
import { store, formatPhone, initials, incomingMessage, tapButton, normalizePhone, parseStamp } from '@/data/store'

// Shows exactly what an employee sees on WhatsApp and lets you act as them:
// tap buttons, type questions, reply STOP / START, or message from an unknown number.

const route = useRoute()
const search = ref('')
const unknownNumber = ref('+91 99000 12345')
const unknownError = ref('')
const selectedPhone = ref(typeof route.query.phone === 'string' ? route.query.phone : store.employees.find((e) => e.status === 'Active' && e.consent === 'Consented')?.phone ?? null)
const draft = ref('')
const thread = ref(null)
const mobileShowChat = ref(!!route.query.phone)

const contacts = computed(() => {
  const q = search.value.trim().toLowerCase()
  const known = store.employees
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q))
    .map((e) => ({ phone: e.phone, name: e.name, sub: `${e.empId} · ${e.region || '—'}`, employee: e }))
  // Numbers that messaged the bot but are not employees
  const unknown = Object.keys(store.chats)
    .filter((p) => !store.employees.some((e) => e.phone === p))
    .filter((p) => !q || p.includes(q.replace(/\D/g, '')))
    .map((p) => ({ phone: p, name: formatPhone(p), sub: 'Not an employee', employee: null }))
  return [...known, ...unknown]
    .map((c) => ({ ...c, last: byTime(store.chats[c.phone]).at(-1) }))
    .sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? '') || a.name.localeCompare(b.name))
})

const current = computed(() => contacts.value.find((c) => c.phone === selectedPhone.value) ?? (selectedPhone.value ? { phone: selectedPhone.value, name: formatPhone(selectedPhone.value), sub: 'Not an employee', employee: null } : null))
// Sorted by time, so seeded history and new messages always read in order
const byTime = (list = []) => [...list].sort((a, b) => a.at.localeCompare(b.at))
const messages = computed(() => byTime(store.chats[selectedPhone.value]))

// Campaign buttons stay tappable (a second tap is politely refused); consent buttons only while consent is pending
function canTap(m) {
  if (!m.buttons?.length) return false
  if (m.kind === 'consent') return current.value?.employee?.consent === 'Pending' && m === messages.value.findLast((x) => x.kind === 'consent')
  return true
}

function open(phone) {
  selectedPhone.value = phone
  mobileShowChat.value = true
}

function scrollDown(smooth = false) {
  nextTick(() => thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))
}
watch(selectedPhone, () => scrollDown(), { immediate: true })
watch(() => messages.value.length, () => scrollDown(true))

const offline = computed(() => store.settings.connection !== 'Connected')

function send() {
  const text = draft.value.trim()
  if (!text || !selectedPhone.value || offline.value) return
  incomingMessage(selectedPhone.value, text)
  draft.value = ''
}

function tap(m, option) {
  if (offline.value) return
  tapButton(selectedPhone.value, m, option)
}

function openUnknown() {
  const p = normalizePhone(unknownNumber.value)
  if (!p) return (unknownError.value = 'Enter a valid mobile number.')
  unknownError.value = ''
  open(p)
}

function time(s) {
  return parseStamp(s)?.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const quickTexts = ['Hi', 'Can I give a gift to a doctor?', 'What is the deadline for the training?', 'HELP', 'STOP', 'START']
</script>

<template>
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-ink">WhatsApp simulator</h1>
    <p class="mt-1 text-sm text-slate-500">See each employee's real chat and act as them: tap buttons, ask questions, opt out. Everything you do here updates reports, as a real reply would.</p>
  </div>

  <div class="card flex h-[calc(100vh-12rem)] min-h-[560px] overflow-hidden">
    <!-- Contacts -->
    <div :class="['w-full flex-col border-r border-slate-200 md:flex md:w-80', mobileShowChat ? 'hidden' : 'flex']">
      <div class="space-y-2 border-b border-slate-200 p-3">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input v-model="search" type="search" placeholder="Search employee" aria-label="Search employees" class="input pl-9" />
        </div>
        <form class="flex gap-2" @submit.prevent="openUnknown">
          <label for="unknown" class="sr-only">Message from any number</label>
          <input id="unknown" v-model="unknownNumber" class="input text-xs" placeholder="Any number" />
          <button type="submit" class="btn-secondary shrink-0 px-2.5 text-xs" title="Test as a number that is not in the employee list"><UserRoundX class="size-4" /> Test</button>
        </form>
        <p v-if="unknownError" class="error-text">{{ unknownError }}</p>
      </div>
      <ul class="flex-1 divide-y divide-slate-100 overflow-y-auto">
        <li v-for="c in contacts" :key="c.phone">
          <button type="button" :class="['flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', selectedPhone === c.phone ? 'bg-brand-50/60' : '']" @click="open(c.phone)">
            <span :class="['flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold', c.employee ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-700']">
              {{ c.employee ? initials(c.name) : '?' }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2">
                <span :class="['truncate text-sm font-semibold', c.employee?.status === 'Inactive' ? 'text-slate-400' : 'text-slate-800']">{{ c.name }}</span>
                <span v-if="c.last" class="shrink-0 text-[11px] text-slate-400">{{ c.last.at.slice(5, 10) }}</span>
              </span>
              <span class="block truncate text-xs text-slate-500">{{ c.sub }}</span>
              <span class="block truncate text-xs text-slate-600">{{ c.last ? `${c.last.from === 'user' ? 'You: ' : ''}${c.last.text}` : 'No messages yet' }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- Phone -->
    <div :class="['flex-1 flex-col md:flex', mobileShowChat ? 'flex' : 'hidden']">
      <template v-if="current">
        <div class="flex items-center gap-3 bg-wa-header px-4 py-3 text-white">
          <button type="button" class="md:hidden" aria-label="Back to list" @click="mobileShowChat = false"><ArrowLeft class="size-5" /></button>
          <BsvLogo variant="mark" :size="36" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold leading-tight">{{ store.settings.businessName }}</p>
            <p class="truncate text-xs text-white/70">Viewing as {{ current.name }} · {{ formatPhone(current.phone) }}</p>
          </div>
          <div v-if="current.employee" class="hidden gap-1 sm:flex">
            <StatusBadge :status="current.employee.status" />
            <StatusBadge :status="current.employee.consent" />
          </div>
        </div>

        <div ref="thread" class="flex-1 space-y-2 overflow-y-auto bg-wa-chat p-4">
          <p v-if="offline" class="mx-auto w-fit max-w-sm rounded-lg bg-red-100 px-3 py-2 text-center text-xs text-red-800">
            The WhatsApp number is disconnected (Settings), so nothing is delivered and the bot can't reply.
          </p>
          <p v-if="!current.employee" class="mx-auto w-fit max-w-sm rounded-lg bg-amber-100 px-3 py-2 text-center text-xs text-amber-900">
            This number is not in the employee list. Type a message to see how the bot handles unknown numbers.
          </p>
          <p v-else-if="current.employee.status === 'Inactive'" class="mx-auto w-fit max-w-sm rounded-lg bg-slate-200 px-3 py-2 text-center text-xs text-slate-700">
            This employee is inactive, so the bot treats them like an unknown number.
          </p>
          <p v-if="!messages.length" class="mx-auto w-fit rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-600">No messages yet.</p>
          <div v-for="m in messages" :key="m.id" :class="['flex', m.from === 'user' ? 'justify-end' : 'justify-start']">
            <div :class="['max-w-[80%] rounded-lg text-sm shadow-sm', m.from === 'user' ? 'rounded-tr-none bg-wa-bubble px-3 py-2' : 'rounded-tl-none bg-white p-1.5']">
              <div v-if="m.video" :class="['mb-1 flex h-28 w-56 max-w-full items-center justify-center rounded bg-linear-to-br', m.video.thumb]">
                <span class="flex size-9 items-center justify-center rounded-full bg-black/40"><Play class="size-4 fill-white text-white" /></span>
              </div>
              <p v-if="m.kind === 'reminder'" class="px-1.5 pt-1 text-[11px] font-semibold uppercase text-amber-600">Reminder</p>
              <p :class="['whitespace-pre-line break-words text-slate-800', m.from === 'user' ? '' : 'px-1.5 pt-1']">{{ m.text }}</p>
              <p :class="['mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400', m.from === 'user' ? '' : 'px-1.5']">
                {{ time(m.at) }} <CheckCheck v-if="m.from === 'user'" class="size-3 text-sky-500" />
              </p>
              <div v-if="m.buttons?.length" class="mt-1 divide-y divide-slate-100 border-t border-slate-100">
                <button
                  v-for="b in m.buttons"
                  :key="b"
                  type="button"
                  class="block w-full py-1.5 text-center text-[13px] font-medium text-sky-600 hover:bg-sky-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent"
                  :disabled="!canTap(m)"
                  @click="tap(m, b)"
                >
                  {{ b }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-slate-200 bg-slate-50 px-3 pt-2">
          <div class="flex gap-1 overflow-x-auto pb-1">
            <button v-for="q in quickTexts" :key="q" type="button" class="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100" @click="draft = q; send()">{{ q }}</button>
          </div>
        </div>
        <form class="flex gap-2 bg-slate-50 p-3 pt-1" @submit.prevent="send">
          <label for="sim-msg" class="sr-only">Message</label>
          <input id="sim-msg" v-model="draft" class="input" :placeholder="`Type as ${current.employee ? current.name.split(' ')[0] : 'this number'}...`" maxlength="500" />
          <button type="submit" class="btn-primary" :disabled="!draft.trim()" aria-label="Send"><Send class="size-4" /></button>
        </form>
      </template>
      <div v-else class="m-auto flex max-w-xs flex-col items-center text-center text-sm text-slate-500">
        <Info class="size-8 text-slate-300" />
        <p class="mt-2">Choose an employee to see their WhatsApp chat.</p>
      </div>
    </div>
  </div>
</template>
