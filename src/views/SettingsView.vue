<script setup>
import { computed, reactive, ref } from 'vue'
import { Smartphone, ShieldCheck, Copy, Plus, Trash2, UserX, Server, Moon, RotateCcw, Loader2, Download, Search, RefreshCw, Database } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import {
  store, toast, audit, currentUser, formatPhone, formatStamp, stamp, ROLES, resetDemoData, validateImport, applyImport
} from '@/data/store'
import { sampleImportRows, downloadWorkbook } from '@/data/files'

const tabs = ['WhatsApp', 'Bot messages', 'Team & roles', 'HR integration', 'Opt-outs', 'Audit log', 'Demo data']
const tab = ref('WhatsApp')
const s = store.settings

/* WhatsApp ----------------------------------------------------------- */
const usage = computed(() => Math.min(100, Math.round((s.usedToday / s.dailyLimit) * 100)))

function copyWebhook() {
  navigator.clipboard?.writeText(s.webhookUrl)
  toast('Webhook URL copied.')
}

const disconnectOpen = ref(false)
function toggleConnection() {
  if (s.connection === 'Connected') {
    disconnectOpen.value = true
    return
  }
  s.connection = 'Connected'
  audit('Reconnected the WhatsApp number')
  toast('WhatsApp number connected.')
}
function confirmDisconnect() {
  s.connection = 'Disconnected'
  audit('Disconnected the WhatsApp number')
  toast('Disconnected. Campaigns can\'t be sent until you reconnect.', 'error')
  disconnectOpen.value = false
}

function saveQuietHours() {
  if (s.quietHours.from === s.quietHours.to) return toast('Start and end of quiet hours must be different.', 'error')
  audit(`Quiet hours set to ${s.quietHours.enabled ? `${s.quietHours.from}–${s.quietHours.to}` : 'off'}`)
  toast('Quiet hours saved.')
}

function toggleAutoConsent() {
  s.autoConsent = !s.autoConsent
  audit(`Automatic consent request ${s.autoConsent ? 'on' : 'off'}`)
}

/* Bot messages ------------------------------------------------------- */
const messageFields = [
  { key: 'fallback', label: 'When the bot has no answer', hint: 'Agreed with BSV: point employees to their local compliance team or manager.' },
  { key: 'notRegistered', label: 'When an unknown number writes', hint: 'Numbers not in the active employee list.' },
  { key: 'greeting', label: 'When an employee says hi', hint: '{{1}} is replaced with their first name.' },
  { key: 'welcome', label: 'After the employee agrees (consent)', hint: '' },
  { key: 'optOut', label: 'After the employee replies STOP', hint: 'Must say how to subscribe again.' }
]
const msgForm = reactive({ ...s.messages })
const msgErrors = reactive({})
function saveMessages() {
  Object.keys(msgErrors).forEach((k) => delete msgErrors[k])
  messageFields.forEach(({ key }) => {
    const v = msgForm[key].trim()
    if (v.length < 10) msgErrors[key] = 'Write at least 10 characters.'
    else if (v.length > 600) msgErrors[key] = 'Keep it under 600 characters.'
  })
  if (!msgErrors.optOut && !/START/i.test(msgForm.optOut)) msgErrors.optOut = 'Tell employees to reply START to subscribe again.'
  if (Object.keys(msgErrors).length) return
  messageFields.forEach(({ key }) => (s.messages[key] = msgForm[key].trim()))
  audit('Updated bot messages')
  toast('Bot messages saved.')
}

/* Team --------------------------------------------------------------- */
const adminCount = computed(() => s.team.filter((m) => m.role === 'Admin').length)
const inviteOpen = ref(false)
const invite = reactive({ name: '', email: '', role: 'Campaign manager' })
const inviteError = ref('')

function sendInvite() {
  inviteError.value = ''
  if (!invite.name.trim()) inviteError.value = 'Enter a name.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) inviteError.value = 'Enter a valid email.'
  else if (s.team.some((m) => m.email.toLowerCase() === invite.email.toLowerCase())) inviteError.value = 'This person is already on the team.'
  if (inviteError.value) return
  s.team.push({ name: invite.name.trim(), email: invite.email.toLowerCase(), role: invite.role })
  audit(`Invited ${invite.email} as ${invite.role}`)
  toast(`Invite sent to ${invite.email}.`)
  Object.assign(invite, { name: '', email: '', role: 'Campaign manager' })
  inviteOpen.value = false
}

function changeRole(m, role) {
  if (m.role === 'Admin' && role !== 'Admin' && adminCount.value === 1) {
    toast('There must be at least one admin.', 'error')
    return
  }
  const old = m.role
  m.role = role
  audit(`Changed ${m.email} from ${old} to ${role}`)
  toast(m.email === currentUser.value?.email ? `Your role is now ${role}.` : `${m.name} is now ${role}.`)
}

const removing = ref(null)
function confirmRemove() {
  s.team = s.team.filter((x) => x !== removing.value)
  audit(`Removed ${removing.value.email} from the team`)
  toast(`${removing.value.name} removed. They can no longer log in.`)
  removing.value = null
}

/* HR integration (Phase 2) ------------------------------------------- */
const syncing = ref(false)
const lastResult = ref(null)
function toggleHrms() {
  s.hrms.enabled = !s.hrms.enabled
  audit(`HRMS sync ${s.hrms.enabled ? 'turned on' : 'turned off'}`)
}
function syncNow() {
  syncing.value = true
  setTimeout(() => {
    const preview = validateImport(sampleImportRows(store.employees))
    lastResult.value = applyImport(preview, { deactivateMissing: s.hrms.deactivateMissing })
    s.hrms.lastSync = stamp()
    audit(`HRMS sync from ${s.hrms.system}: ${lastResult.value.added} added, ${lastResult.value.updated} updated, ${lastResult.value.deactivated} deactivated, ${lastResult.value.skipped} skipped`)
    syncing.value = false
    toast('Employee list synced with HR.')
  }, 1500)
}

/* Opt-outs ----------------------------------------------------------- */
const optedOut = computed(() => store.employees.filter((x) => x.consent === 'Declined'))

/* Audit log ---------------------------------------------------------- */
const auditSearch = ref('')
const auditRows = computed(() => {
  const q = auditSearch.value.trim().toLowerCase()
  return store.auditLog.filter((l) => !q || l.action.toLowerCase().includes(q) || l.user.toLowerCase().includes(q)).slice(0, 200)
})
function exportAudit() {
  downloadWorkbook('audit_log.xlsx', [{ name: 'Audit log', rows: store.auditLog.map((l) => ({ Time: l.at, User: l.user, Action: l.action })) }])
}

/* Demo data ---------------------------------------------------------- */
const resetOpen = ref(false)
function confirmReset() {
  resetDemoData()
  // Reload so every page starts from the fresh sample
  window.location.reload()
}
const storageKb = computed(() => {
  try {
    return Math.round((localStorage.getItem('bsv_compliance_state')?.length ?? 0) / 1024)
  } catch {
    return 0
  }
})
</script>

<template>
  <PageHeader title="Settings" subtitle="WhatsApp connection, bot messages, team access and integrations." />

  <div class="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
    <button
      v-for="t in tabs"
      :key="t"
      type="button"
      role="tab"
      :aria-selected="tab === t"
      :class="['-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium', tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700']"
      @click="tab = t"
    >
      {{ t }}
    </button>
  </div>

  <!-- WhatsApp -->
  <div v-if="tab === 'WhatsApp'" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="card p-6">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-brand-50"><Smartphone class="size-5 text-brand-600" /></span>
        <div class="flex-1">
          <h2 class="font-semibold text-ink">WhatsApp number</h2>
          <p class="text-sm text-slate-500">Employees get messages from this number.</p>
        </div>
        <StatusBadge :status="s.connection" />
      </div>
      <dl class="mt-5 divide-y divide-slate-100 text-sm">
        <div class="flex justify-between py-2.5"><dt class="text-slate-500">Display name</dt><dd class="font-medium text-slate-800">{{ s.businessName }}</dd></div>
        <div class="flex justify-between py-2.5"><dt class="text-slate-500">Number</dt><dd class="font-medium text-slate-800">{{ s.number }}</dd></div>
        <div class="flex justify-between py-2.5"><dt class="text-slate-500">Provider</dt><dd class="font-medium text-slate-800">{{ s.provider }}</dd></div>
        <div class="flex items-center justify-between py-2.5"><dt class="text-slate-500">Quality rating</dt><dd><StatusBadge :status="s.quality" /></dd></div>
      </dl>
      <button type="button" :class="['mt-4', s.connection === 'Connected' ? 'btn-secondary' : 'btn-primary']" @click="toggleConnection">
        {{ s.connection === 'Connected' ? 'Disconnect' : 'Reconnect' }}
      </button>
    </div>

    <div class="card p-6">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-sky-50"><ShieldCheck class="size-5 text-sky-600" /></span>
        <div>
          <h2 class="font-semibold text-ink">Sending limit</h2>
          <p class="text-sm text-slate-500">Meta raises this as quality stays high.</p>
        </div>
      </div>
      <p class="mt-5 text-sm text-slate-600"><b class="text-2xl text-ink">{{ s.usedToday }}</b> of {{ s.dailyLimit.toLocaleString() }} messages used today</p>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div :class="['h-full rounded-full', usage > 90 ? 'bg-red-500' : 'bg-sky-500']" :style="{ width: `${usage}%` }" />
      </div>
      <div class="mt-6">
        <p class="label">Webhook URL</p>
        <div class="flex gap-2">
          <input :value="s.webhookUrl" readonly class="input font-mono text-xs" aria-label="Webhook URL" />
          <button type="button" class="btn-secondary px-3" aria-label="Copy webhook URL" @click="copyWebhook"><Copy class="size-4" /></button>
        </div>
        <p class="mt-1 text-xs text-slate-500">WhatsApp calls this address when a message is delivered, read or answered.</p>
      </div>
    </div>

    <div class="card p-6">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-indigo-50"><Moon class="size-5 text-indigo-600" /></span>
        <div>
          <h2 class="font-semibold text-ink">Quiet hours</h2>
          <p class="text-sm text-slate-500">Warns before you send or schedule late at night.</p>
        </div>
      </div>
      <label class="mt-5 flex items-center gap-3 text-sm text-slate-700">
        <input v-model="s.quietHours.enabled" type="checkbox" class="rounded border-slate-300 text-brand-600" /> Warn during quiet hours
      </label>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div><label for="qh-from" class="label">From</label><input id="qh-from" v-model="s.quietHours.from" type="time" class="input" :disabled="!s.quietHours.enabled" /></div>
        <div><label for="qh-to" class="label">To</label><input id="qh-to" v-model="s.quietHours.to" type="time" class="input" :disabled="!s.quietHours.enabled" /></div>
      </div>
      <button type="button" class="btn-secondary mt-4" @click="saveQuietHours">Save</button>
    </div>

    <div class="card p-6">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-slate-100"><Server class="size-5 text-slate-600" /></span>
        <div>
          <h2 class="font-semibold text-ink">Hosting and consent</h2>
          <p class="text-sm text-slate-500">Employee numbers are personal data.</p>
        </div>
      </div>
      <dl class="mt-5 divide-y divide-slate-100 text-sm">
        <div class="flex justify-between gap-4 py-2.5"><dt class="text-slate-500">Hosted on</dt><dd class="text-right font-medium text-slate-800">{{ s.hosting }}</dd></div>
        <div class="flex justify-between gap-4 py-2.5"><dt class="text-slate-500">Data leaves BSV</dt><dd class="text-right text-slate-800">Only to WhatsApp (Meta) to deliver messages</dd></div>
      </dl>
      <label class="mt-4 flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" :checked="s.autoConsent" class="mt-0.5 rounded border-slate-300 text-brand-600" @change="toggleAutoConsent" />
        <span>Send the one-tap consent message automatically when an employee is added<span class="block text-xs text-slate-500">WhatsApp requires consent before business messages. Employees don't sign up for anything.</span></span>
      </label>
    </div>
  </div>

  <!-- Bot messages -->
  <form v-else-if="tab === 'Bot messages'" class="card max-w-3xl space-y-5 p-6" novalidate @submit.prevent="saveMessages">
    <div v-for="f in messageFields" :key="f.key">
      <label :for="`msg-${f.key}`" class="label">{{ f.label }}</label>
      <textarea :id="`msg-${f.key}`" v-model="msgForm[f.key]" rows="2" class="input" maxlength="600" />
      <p v-if="msgErrors[f.key]" class="error-text">{{ msgErrors[f.key] }}</p>
      <p v-else-if="f.hint" class="mt-1 text-xs text-slate-500">{{ f.hint }}</p>
    </div>
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-5">
      <button type="button" class="btn-secondary" @click="Object.assign(msgForm, s.messages)">Discard changes</button>
      <button type="submit" class="btn-primary">Save messages</button>
    </div>
  </form>

  <!-- Team -->
  <div v-else-if="tab === 'Team & roles'" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card lg:col-span-2">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 class="font-semibold text-ink">Team</h2>
        <button type="button" class="btn-primary px-3 py-1.5" @click="inviteOpen = true"><Plus class="size-4" /> Invite</button>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="m in s.team" :key="m.email" class="flex flex-wrap items-center gap-3 px-5 py-3">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-slate-800">{{ m.name }} <span v-if="m.email === currentUser?.email" class="text-xs font-normal text-slate-500">(you)</span></p>
            <p class="text-xs text-slate-500">{{ m.email }}</p>
          </div>
          <select :value="m.role" class="input w-auto py-1 text-xs" :aria-label="`Role for ${m.name}`" @change="changeRole(m, $event.target.value); $event.target.value = m.role">
            <option v-for="r in ROLES" :key="r.name">{{ r.name }}</option>
          </select>
          <button
            type="button"
            class="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:invisible"
            :disabled="m.email === currentUser?.email || (m.role === 'Admin' && adminCount === 1)"
            :aria-label="`Remove ${m.name}`"
            @click="removing = m"
          >
            <Trash2 class="size-4" />
          </button>
        </li>
      </ul>
    </div>
    <div class="card self-start p-5">
      <h2 class="font-semibold text-ink">Roles</h2>
      <ul class="mt-4 space-y-4 text-sm">
        <li v-for="r in ROLES" :key="r.name">
          <p class="font-medium text-slate-800">{{ r.name }}</p>
          <p class="text-slate-500">{{ r.can }}</p>
        </li>
      </ul>
    </div>
  </div>

  <!-- HR integration (Phase 2) -->
  <div v-else-if="tab === 'HR integration'" class="card max-w-3xl p-6">
    <div class="flex items-start gap-3">
      <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50"><RefreshCw class="size-5 text-violet-600" /></span>
      <div class="flex-1">
        <h2 class="font-semibold text-ink">Automatic sync with the HR system <span class="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">Phase 2</span></h2>
        <p class="text-sm text-slate-500">Keeps the employee list in step with HR, so no one uploads files by hand. Phase 1 uses the manual import on the Employees page.</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="s.hrms.enabled"
        aria-label="Turn HRMS sync on or off"
        :class="['relative h-6 w-11 shrink-0 rounded-full transition-colors', s.hrms.enabled ? 'bg-brand-600' : 'bg-slate-300']"
        @click="toggleHrms"
      >
        <span :class="['absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', s.hrms.enabled ? 'left-5.5' : 'left-0.5']" />
      </button>
    </div>
    <div :class="['mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2', s.hrms.enabled ? '' : 'pointer-events-none opacity-50']">
      <div>
        <label for="hr-system" class="label">HR system</label>
        <select id="hr-system" v-model="s.hrms.system" class="input">
          <option>SAP SuccessFactors</option>
          <option>Workday</option>
          <option>Darwinbox</option>
          <option>Keka</option>
        </select>
      </div>
      <div>
        <label for="hr-freq" class="label">Sync</label>
        <select id="hr-freq" v-model="s.hrms.frequency" class="input">
          <option>Daily</option>
          <option>Weekly</option>
        </select>
      </div>
      <label class="flex items-start gap-3 text-sm text-slate-700 sm:col-span-2">
        <input v-model="s.hrms.deactivateMissing" type="checkbox" class="mt-0.5 rounded border-slate-300 text-brand-600" />
        Deactivate employees who are no longer in HR (resigned)
      </label>
      <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="button" class="btn-primary" :disabled="syncing" @click="syncNow">
          <Loader2 v-if="syncing" class="size-4 animate-spin" /><RefreshCw v-else class="size-4" /> Sync now
        </button>
        <span class="text-sm text-slate-500">Last sync: {{ s.hrms.lastSync ? formatStamp(s.hrms.lastSync) : 'Never' }}</span>
      </div>
      <p v-if="lastResult" class="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 sm:col-span-2">
        {{ lastResult.added }} added · {{ lastResult.updated }} updated · {{ lastResult.reactivated }} reactivated · {{ lastResult.deactivated }} deactivated ·
        <span :class="lastResult.skipped ? 'text-red-700' : ''">{{ lastResult.skipped }} skipped (errors in HR data)</span>
      </p>
    </div>
  </div>

  <!-- Opt-outs -->
  <div v-else-if="tab === 'Opt-outs'" class="card">
    <div class="border-b border-slate-200 px-5 py-4">
      <h2 class="font-semibold text-ink">Opted-out employees</h2>
      <p class="text-sm text-slate-500">These people replied STOP. WhatsApp rules say we must not message them until they reply START themselves.</p>
    </div>
    <ul v-if="optedOut.length" class="divide-y divide-slate-100">
      <li v-for="x in optedOut" :key="x.id" class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
        <span class="font-medium text-slate-800">{{ x.name }} <span class="font-normal text-slate-500">· {{ x.empId }} · {{ x.region }}</span></span>
        <span class="text-slate-500">{{ formatPhone(x.phone) }} · opted out {{ formatStamp(x.consentHistory.findLast((h) => h.action === 'declined')?.at, false) }}</span>
      </li>
    </ul>
    <div v-else class="flex flex-col items-center py-10 text-sm text-slate-500">
      <UserX class="size-8 text-slate-300" />
      <p class="mt-2">Nobody has opted out.</p>
    </div>
  </div>

  <!-- Audit log -->
  <div v-else-if="tab === 'Audit log'" class="card">
    <div class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative sm:w-80">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input v-model="auditSearch" type="search" placeholder="Search actions or people" aria-label="Search audit log" class="input pl-9" />
      </div>
      <button type="button" class="btn-secondary" @click="exportAudit"><Download class="size-4" /> Export</button>
    </div>
    <ul class="divide-y divide-slate-100">
      <li v-for="l in auditRows" :key="l.id" class="flex flex-col gap-0.5 px-5 py-3 text-sm sm:flex-row sm:gap-4">
        <span class="w-44 shrink-0 text-xs text-slate-500">{{ formatStamp(l.at) }}</span>
        <span class="w-36 shrink-0 font-medium text-slate-700">{{ l.user }}</span>
        <span class="text-slate-600">{{ l.action }}</span>
      </li>
    </ul>
    <p v-if="!auditRows.length" class="px-5 py-8 text-center text-sm text-slate-500">No matching entries.</p>
  </div>

  <!-- Demo data -->
  <div v-else class="card max-w-2xl p-6">
    <div class="flex items-center gap-3">
      <span class="flex size-10 items-center justify-center rounded-lg bg-slate-100"><Database class="size-5 text-slate-600" /></span>
      <div>
        <h2 class="font-semibold text-ink">Prototype data</h2>
        <p class="text-sm text-slate-500">This prototype has no server. Everything is saved in this browser ({{ storageKb }} KB).</p>
      </div>
    </div>
    <p class="mt-4 text-sm text-slate-600">Resetting restores the original sample employees, campaigns, questions and settings. Your login stays.</p>
    <button type="button" class="btn-danger mt-4" @click="resetOpen = true"><RotateCcw class="size-4" /> Reset demo data</button>
  </div>

  <!-- Modals -->
  <BaseModal :open="inviteOpen" title="Invite a team member" @close="inviteOpen = false">
    <form id="invite-form" class="space-y-4" novalidate @submit.prevent="sendInvite">
      <div><label for="inv-name" class="label">Name</label><input id="inv-name" v-model="invite.name" class="input" /></div>
      <div><label for="inv-email" class="label">Email</label><input id="inv-email" v-model.trim="invite.email" type="email" class="input" /></div>
      <div>
        <label for="inv-role" class="label">Role</label>
        <select id="inv-role" v-model="invite.role" class="input">
          <option v-for="r in ROLES" :key="r.name">{{ r.name }}</option>
        </select>
        <p class="mt-1 text-xs text-slate-500">{{ ROLES.find((r) => r.name === invite.role)?.can }}</p>
      </div>
      <p v-if="inviteError" class="error-text">{{ inviteError }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="inviteOpen = false">Cancel</button>
      <button type="submit" form="invite-form" class="btn-primary">Send invite</button>
    </template>
  </BaseModal>

  <BaseModal :open="!!removing" title="Remove team member" size="sm" @close="removing = null">
    <p class="text-sm text-slate-600">Remove <b>{{ removing?.name }}</b>? They will be logged out and can't log in again.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="removing = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmRemove">Remove</button>
    </template>
  </BaseModal>

  <BaseModal :open="disconnectOpen" title="Disconnect WhatsApp?" size="sm" @close="disconnectOpen = false">
    <p class="text-sm text-slate-600">No campaigns, reminders or bot replies can go out while the number is disconnected. Scheduled campaigns due in that time move to drafts.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="disconnectOpen = false">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDisconnect">Disconnect</button>
    </template>
  </BaseModal>

  <BaseModal :open="resetOpen" title="Reset demo data?" size="sm" @close="resetOpen = false">
    <p class="text-sm text-slate-600">All changes made in this browser will be lost. This can't be undone.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="resetOpen = false">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmReset">Reset</button>
    </template>
  </BaseModal>
</template>
