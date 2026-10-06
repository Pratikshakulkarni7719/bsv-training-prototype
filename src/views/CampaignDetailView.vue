<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, Send, CheckCheck, Eye, MessageSquareReply, CircleX, RefreshCw, Copy, Download, Target, BellRing, Pencil,
  Trash2, Search, TriangleAlert, Wand2, Repeat, MessageCircle
} from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import StatCard from '@/components/StatCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import BaseModal from '@/components/BaseModal.vue'
import WhatsAppPreview from '@/components/WhatsAppPreview.vue'
import {
  store, campaignStats, percent, toast, audit, can, nextId, stamp, currentUser, formatStamp, formatPhone, timeAgo,
  CAMPAIGN_TYPES, REGIONS, templateFor, videoFor, sendCampaign, campaignProblems, sendReminder, retryFailed,
  employeeById, tapButton
} from '@/data/store'
// import { groupName } from '@/data/store' // Phase 2: groups (disabled)
import { downloadWorkbook } from '@/data/files'

const route = useRoute()
const router = useRouter()
const canEdit = computed(() => can('campaigns'))

const campaign = computed(() => store.campaigns.find((c) => c.id === Number(route.params.id)))
const stats = computed(() => (campaign.value ? campaignStats(campaign.value) : null))
const template = computed(() => templateFor(campaign.value?.templateId))
const video = computed(() => videoFor(campaign.value?.videoId))
const buttons = computed(() => template.value?.buttons ?? Object.keys(campaign.value?.replies ?? {}))
const graded = computed(() => !!campaign.value?.correctOption)

/* Recipients --------------------------------------------------------- */
const filter = ref('All')
const filters = computed(() => (graded.value ? ['All', 'Responded', 'No response', 'Correct', 'Wrong', 'Failed'] : ['All', 'Responded', 'No response', 'Failed']))
const search = ref('')
const region = ref('')

const recipients = computed(() => {
  const q = search.value.trim().toLowerCase()
  const c = campaign.value
  return (c?.recipients ?? []).filter((r) => {
    const f = filter.value
    const okFilter =
      f === 'All' ||
      (f === 'Responded' && r.response) ||
      (f === 'No response' && !r.response && r.status !== 'Failed') ||
      (f === 'Correct' && r.response === c.correctOption) ||
      (f === 'Wrong' && r.response && r.response !== c.correctOption) ||
      (f === 'Failed' && r.status === 'Failed')
    return okFilter && (!region.value || r.region === region.value) && (!q || r.name.toLowerCase().includes(q))
  })
})

const answerSummary = computed(() => {
  const counts = Object.fromEntries(buttons.value.map((b) => [b, 0]))
  campaign.value?.recipients.forEach((r) => {
    if (r.response) counts[r.response] = (counts[r.response] ?? 0) + 1
  })
  return Object.entries(counts)
})

const byRegion = computed(() =>
  REGIONS.map((name) => {
    const list = (campaign.value?.recipients ?? []).filter((r) => r.region === name && r.status !== 'Failed')
    const responded = list.filter((r) => r.response)
    return {
      name,
      total: list.length,
      responseRate: percent(responded.length, list.length),
      correctRate: graded.value ? percent(responded.filter((r) => r.response === campaign.value.correctOption).length, responded.length) : null
    }
  }).filter((r) => r.total)
)

const failureReasons = computed(() => {
  const out = {}
  campaign.value?.recipients.forEach((r) => {
    if (r.status === 'Failed') out[r.reason] = (out[r.reason] ?? 0) + 1
  })
  return out
})

const fixableFailures = computed(
  () =>
    campaign.value?.recipients.filter((r) => {
      if (r.status !== 'Failed') return false
      const e = employeeById(r.employeeId)
      return e && e.status === 'Active' && e.onWhatsApp && e.consent === 'Consented'
    }).length ?? 0
)

/* Actions ------------------------------------------------------------ */
const problemsOpen = ref(false)
const problems = ref([])
const sending = ref(false)

function sendNow() {
  problems.value = campaignProblems(campaign.value)
  if (problems.value.length) {
    problemsOpen.value = true
    return
  }
  sending.value = true
  setTimeout(() => {
    const result = sendCampaign(campaign.value)
    sending.value = false
    if (result.ok) {
      campaign.value.lastError = ''
      toast(`Sending to ${result.stats.sent} employees on WhatsApp.`)
    } else {
      problems.value = result.problems
      problemsOpen.value = true
    }
  }, 600)
}

function cancelSchedule() {
  campaign.value.status = 'Draft'
  campaign.value.scheduledAt = null
  audit(`Cancelled schedule for "${campaign.value.name}"`)
  toast('Schedule cancelled. The campaign is a draft again.')
}

function remind() {
  const n = sendReminder(campaign.value)
  toast(n ? `Reminder sent to ${n} employees.` : 'Everyone has already responded.')
}

function retry() {
  const n = retryFailed(campaign.value)
  toast(n ? `Resent to ${n} employees who can now receive messages.` : 'None of the failed employees can receive messages yet.', n ? 'success' : 'error')
}

function duplicate() {
  const c = campaign.value
  let name = `${c.name} (copy)`
  let i = 2
  while (store.campaigns.some((x) => x.name === name)) name = `${c.name} (copy ${i++})`
  const copy = {
    ...JSON.parse(JSON.stringify(c)),
    id: nextId(store.campaigns),
    name,
    status: 'Draft',
    scheduledAt: null,
    sentAt: null,
    recipients: [],
    reminderLog: [],
    lastError: '',
    repeat: 'none',
    createdBy: currentUser.value?.name,
    createdAt: stamp()
  }
  store.campaigns.unshift(copy)
  audit(`Duplicated "${c.name}"`)
  toast('Copied as a new draft.')
  router.push({ name: 'campaignEdit', params: { id: copy.id } })
}

const deleteOpen = ref(false)
function confirmDelete() {
  const name = campaign.value.name
  store.campaigns = store.campaigns.filter((c) => c.id !== campaign.value.id)
  audit(`Deleted campaign "${name}"`)
  toast('Campaign deleted.')
  router.push({ name: 'campaigns' })
}

// Prototype helper: make some employees who read the message tap a button
function simulateResponses() {
  const c = campaign.value
  const open = c.recipients.filter((r) => r.status !== 'Failed' && !r.response)
  if (!open.length) return toast('Everyone has already responded.')
  const picks = open.filter(() => Math.random() < 0.6)
  ;(picks.length ? picks : [open[0]]).forEach((r) => {
    const option = c.correctOption ? (Math.random() < 0.7 ? c.correctOption : buttons.value.find((b) => b !== c.correctOption)) : Math.random() < 0.85 ? buttons.value[0] : buttons.value[1] ?? buttons.value[0]
    const msg = store.chats[r.phone]?.findLast((m) => m.campaignId === c.id && m.buttons)
    if (msg) tapButton(r.phone, msg, option)
  })
  toast(`${picks.length || 1} employee(s) responded (simulated).`)
}

async function exportReport() {
  const c = campaign.value
  const s = stats.value
  await downloadWorkbook(`${c.name.replace(/[^\w]+/g, '_')}_report.xlsx`, [
    {
      name: 'Summary',
      rows: [
        { Item: 'Campaign', Value: c.name },
        { Item: 'Type', Value: CAMPAIGN_TYPES[c.type]?.label },
        { Item: 'Theme', Value: c.theme },
        { Item: 'Sent at', Value: c.sentAt },
        { Item: 'Message', Value: c.content },
        { Item: 'Correct answer', Value: c.correctOption ?? '—' },
        { Item: 'Recipients', Value: s.total },
        { Item: 'Sent', Value: s.sent },
        { Item: 'Delivered', Value: s.delivered },
        { Item: 'Read', Value: s.read },
        { Item: 'Responded', Value: `${s.responded} (${percent(s.responded, s.sent)}%)` },
        { Item: 'Correct', Value: s.correct === null ? '—' : `${s.correct} (${percent(s.correct, s.responded)}%)` },
        { Item: 'Failed', Value: s.failed },
        { Item: 'Reminders sent', Value: c.reminderLog.reduce((a, l) => a + l.count, 0) }
      ]
    },
    {
      name: 'Recipients',
      rows: c.recipients.map((r) => ({
        Employee: r.name,
        'Employee ID': employeeById(r.employeeId)?.empId ?? '(deleted)',
        'WhatsApp number': formatPhone(r.phone),
        Region: r.region,
        'Delivery status': r.status,
        'Failure reason': r.reason,
        Response: r.response ?? '',
        Correct: c.correctOption ? (r.response ? (r.response === c.correctOption ? 'Yes' : 'No') : '') : '',
        'Responded at': r.respondedAt ?? '',
        Reminders: r.reminders
      }))
    }
  ])
  audit(`Exported report for "${c.name}"`)
}

function dateLine(c) {
  if (c.status === 'Sent') return `Sent ${formatStamp(c.sentAt)}`
  if (c.status === 'Scheduled') return `Scheduled for ${formatStamp(c.scheduledAt)}`
  return 'Draft, not scheduled'
}
</script>

<template>
  <div v-if="!campaign" class="card">
    <EmptyState :icon="Send" title="Campaign not found" text="It may have been deleted.">
      <router-link :to="{ name: 'campaigns' }" class="btn-primary">Back to campaigns</router-link>
    </EmptyState>
  </div>

  <template v-else>
    <!-- <PageHeader :subtitle="`${campaign.groupIds.map(groupName).join(', ')} · ...`"> Phase 2: groups (disabled) -->
    <PageHeader :title="campaign.name" :subtitle="`${CAMPAIGN_TYPES[campaign.type]?.label}${campaign.theme ? ` · ${campaign.theme}` : ''} · ${dateLine(campaign)}`">
      <template #back>
        <router-link :to="{ name: 'campaigns' }" class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft class="size-4" /> Campaigns</router-link>
      </template>
      <template #actions>
        <StatusBadge :status="campaign.status" class="self-center" />
        <template v-if="canEdit && campaign.status !== 'Sent'">
          <router-link :to="{ name: 'campaignEdit', params: { id: campaign.id } }" class="btn-secondary"><Pencil class="size-4" /> Edit</router-link>
          <button v-if="campaign.status === 'Scheduled'" type="button" class="btn-secondary" @click="cancelSchedule">Cancel schedule</button>
          <button type="button" class="btn-secondary text-red-600" @click="deleteOpen = true"><Trash2 class="size-4" /> Delete</button>
          <button type="button" class="btn-primary" :disabled="sending" @click="sendNow"><Send class="size-4" /> Send now</button>
        </template>
        <template v-if="campaign.status === 'Sent'">
          <button type="button" class="btn-secondary" @click="exportReport"><Download class="size-4" /> Export</button>
          <button v-if="canEdit && stats.pending" type="button" class="btn-secondary" @click="remind"><BellRing class="size-4" /> Remind {{ stats.pending }}</button>
        </template>
        <button v-if="canEdit" type="button" class="btn-secondary" @click="duplicate"><Copy class="size-4" /> Duplicate</button>
      </template>
    </PageHeader>

    <p v-if="campaign.lastError" class="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
      <TriangleAlert class="mt-0.5 size-4 shrink-0" /> The scheduled send failed: {{ campaign.lastError }} Fix the problem, then send or schedule again.
    </p>

    <!-- Sent -->
    <template v-if="campaign.status === 'Sent'">
      <div :class="['grid grid-cols-2 gap-4', graded ? 'lg:grid-cols-6' : 'lg:grid-cols-5']">
        <StatCard label="Sent" :value="stats.sent" :hint="`of ${stats.total} active`" :icon="Send" />
        <StatCard label="Delivered" :value="stats.delivered" :hint="`${percent(stats.delivered, stats.sent)}%`" :icon="CheckCheck" />
        <StatCard label="Read" :value="stats.read" :hint="`${percent(stats.read, stats.sent)}%`" :icon="Eye" />
        <StatCard label="Responded" :value="stats.responded" :hint="`${percent(stats.responded, stats.sent)}%`" :icon="MessageSquareReply" />
        <StatCard v-if="graded" label="Correct" :value="`${percent(stats.correct, stats.responded)}%`" :hint="`${stats.correct} of ${stats.responded}`" :icon="Target" />
        <StatCard label="Failed" :value="stats.failed" :hint="stats.failed ? 'See reasons' : 'None'" :icon="CircleX" />
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="card xl:col-span-2">
          <div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-semibold text-ink">Recipients</h2>
              <button type="button" class="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline" title="Prototype helper" @click="simulateResponses">
                <Wand2 class="size-3.5" /> Simulate responses
              </button>
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="f in filters"
                :key="f"
                type="button"
                :class="['rounded-full px-3 py-1 text-xs font-medium', filter === f ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
                @click="filter = f"
              >
                {{ f }}
              </button>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <div class="relative flex-1">
                <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input v-model="search" type="search" placeholder="Search employee" aria-label="Search recipients" class="input pl-9" />
              </div>
              <select v-model="region" class="input sm:w-40" aria-label="Filter by region">
                <option value="">All regions</option>
                <option v-for="r in REGIONS" :key="r">{{ r }}</option>
              </select>
            </div>
          </div>
          <div class="max-h-[560px] overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-3">Employee</th>
                  <th class="px-4 py-3">Delivery</th>
                  <th class="px-4 py-3">Response</th>
                  <th class="px-4 py-3"><span class="sr-only">Chat</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="r in recipients" :key="r.employeeId">
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-800">{{ r.name }}</p>
                    <p class="text-xs text-slate-500">{{ formatPhone(r.phone) }} · {{ r.region || '—' }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :status="r.status" />
                    <p v-if="r.reason" class="mt-1 text-xs text-red-600">{{ r.reason }}</p>
                    <p v-if="r.reminders" class="mt-1 text-xs text-slate-500">{{ r.reminders }} reminder{{ r.reminders > 1 ? 's' : '' }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <template v-if="r.response">
                      <span :class="['font-medium', graded ? (r.response === campaign.correctOption ? 'text-emerald-700' : 'text-orange-600') : 'text-slate-800']">
                        {{ r.response }}<template v-if="graded">{{ r.response === campaign.correctOption ? ' ✓' : ' ✗' }}</template>
                      </span>
                      <p class="text-xs text-slate-500">{{ timeAgo(r.respondedAt) }}</p>
                    </template>
                    <span v-else-if="r.status !== 'Failed'" class="text-slate-400">No response yet</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <router-link
                      v-if="employeeById(r.employeeId)"
                      :to="{ name: 'simulator', query: { phone: r.phone } }"
                      class="inline-flex rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Open WhatsApp chat"
                      :aria-label="`Open chat with ${r.name}`"
                    >
                      <MessageCircle class="size-4" />
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!recipients.length" class="px-4 py-8 text-center text-sm text-slate-500">No recipients match.</p>
          </div>
          <div v-if="stats.failed" class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-sm">
            <p class="text-slate-600">
              {{ stats.failed }} failed:
              <span v-for="(n, reason) in failureReasons" :key="reason" class="mr-2">{{ reason }} ({{ n }})</span>
            </p>
            <button v-if="canEdit" type="button" class="btn-secondary px-3 py-1.5" :disabled="!fixableFailures" :title="fixableFailures ? '' : 'Nobody who failed can receive messages yet'" @click="retry">
              <RefreshCw class="size-4" /> Retry {{ fixableFailures || '' }}
            </button>
          </div>
        </div>

        <div class="space-y-6">
          <div class="card p-5">
            <h2 class="font-semibold text-ink">Answers</h2>
            <p class="mt-1 text-sm text-slate-500">{{ campaign.content }}</p>
            <ul class="mt-4 space-y-3">
              <li v-for="[answer, count] in answerSummary" :key="answer">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-700">{{ answer }} <span v-if="answer === campaign.correctOption" class="text-xs font-medium text-emerald-700">(correct)</span></span>
                  <span class="font-medium text-slate-800">{{ count }} · {{ percent(count, stats.responded) }}%</span>
                </div>
                <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div :class="['h-full rounded-full', !graded ? 'bg-brand-500' : answer === campaign.correctOption ? 'bg-emerald-500' : 'bg-orange-400']" :style="{ width: `${percent(count, stats.responded)}%` }" />
                </div>
              </li>
            </ul>
            <p class="mt-4 text-xs text-slate-500">{{ stats.pending }} employee(s) haven't responded yet.</p>
          </div>

          <div v-if="byRegion.length" class="card p-5">
            <h2 class="font-semibold text-ink">By region</h2>
            <table class="mt-3 w-full text-sm">
              <thead class="text-left text-xs text-slate-500">
                <tr><th class="py-1 font-medium">Region</th><th class="py-1 font-medium">Responded</th><th v-if="graded" class="py-1 font-medium">Correct</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in byRegion" :key="r.name" class="border-t border-slate-100">
                  <td class="py-2 font-medium text-slate-800">{{ r.name }}</td>
                  <td class="py-2 text-slate-600">{{ r.responseRate }}%</td>
                  <td v-if="graded" :class="['py-2', r.correctRate < 70 ? 'font-medium text-orange-600' : 'text-slate-600']">{{ r.correctRate }}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card p-5 text-sm">
            <h2 class="font-semibold text-ink">Reminders</h2>
            <p class="mt-2 text-slate-600">
              <template v-if="campaign.reminder?.enabled">Automatic reminder {{ campaign.reminder.afterDays }} day(s) after sending.</template>
              <template v-else>No automatic reminder.</template>
            </p>
            <ul class="mt-2 space-y-1 text-xs text-slate-500">
              <li v-for="(l, i) in campaign.reminderLog" :key="i">{{ formatStamp(l.at) }} · {{ l.auto ? 'Automatic' : 'Manual' }} · {{ l.count }} employees</li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <!-- Draft / scheduled -->
    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div class="card p-6">
        <p class="text-sm text-slate-600">
          <template v-if="campaign.status === 'Scheduled'">
            Will be sent automatically on <b>{{ formatStamp(campaign.scheduledAt) }}</b> to all active employees who have given consent.
            <span v-if="campaign.repeat !== 'none'" class="inline-flex items-center gap-1"><Repeat class="size-3.5" /> Repeats {{ campaign.repeat }}.</span>
            Delivery and response numbers appear here after it is sent.
          </template>
          <template v-else>This campaign is a draft and hasn't been sent.</template>
        </p>
        <dl class="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div><dt class="text-slate-500">Type</dt><dd class="font-medium text-slate-800">{{ CAMPAIGN_TYPES[campaign.type]?.label }}</dd></div>
          <div><dt class="text-slate-500">Template</dt><dd class="font-mono text-slate-800">{{ template?.name ?? 'Deleted' }} <StatusBadge v-if="template" :status="template.status" /></dd></div>
          <div v-if="campaign.type === 'video'"><dt class="text-slate-500">Video</dt><dd class="font-medium text-slate-800">{{ video?.title ?? 'Deleted' }}</dd></div>
          <div v-if="campaign.correctOption"><dt class="text-slate-500">Correct answer</dt><dd class="font-medium text-emerald-700">{{ campaign.correctOption }}</dd></div>
          <div><dt class="text-slate-500">Reminder</dt><dd class="font-medium text-slate-800">{{ campaign.reminder?.enabled ? `After ${campaign.reminder.afterDays} day(s)` : 'Off' }}</dd></div>
          <div><dt class="text-slate-500">Created</dt><dd class="font-medium text-slate-800">{{ campaign.createdBy }} · {{ formatStamp(campaign.createdAt) }}</dd></div>
        </dl>
        <h3 class="mt-6 text-sm font-semibold text-ink">Bot replies</h3>
        <ul class="mt-2 space-y-2 text-sm">
          <li v-for="(text, option) in campaign.replies" :key="option" class="rounded-lg bg-slate-50 px-3 py-2">
            <b class="text-slate-800">{{ option }}</b> → <span class="text-slate-600">{{ text }}</span>
          </li>
        </ul>
      </div>
      <div>
        <p class="mb-3 text-center text-sm font-medium text-slate-500">Message preview</p>
        <WhatsAppPreview :header="template?.header" :body="template?.body" :content="campaign.content" :buttons="buttons" :video-title="video?.title" :video-thumb="video?.thumb" />
      </div>
    </div>

    <BaseModal :open="problemsOpen" title="Can't send yet" size="sm" @close="problemsOpen = false">
      <ul class="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li v-for="p in problems" :key="p">{{ p }}</li>
      </ul>
      <template #footer>
        <button type="button" class="btn-secondary" @click="problemsOpen = false">Close</button>
        <router-link :to="{ name: 'campaignEdit', params: { id: campaign.id } }" class="btn-primary">Edit campaign</router-link>
      </template>
    </BaseModal>

    <BaseModal :open="deleteOpen" title="Delete campaign" size="sm" @close="deleteOpen = false">
      <p class="text-sm text-slate-600">Delete <b>{{ campaign.name }}</b>? This can't be undone.</p>
      <template #footer>
        <button type="button" class="btn-secondary" @click="deleteOpen = false">Cancel</button>
        <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
      </template>
    </BaseModal>
  </template>
</template>
