<script setup>
import { computed } from 'vue'
import { Send, MessageSquareReply, Users, Plus, CircleCheck, Circle, ArrowRight, Target, MessageCircleQuestion, TriangleAlert, CalendarClock } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { store, campaignStats, percent, can, currentUser, firstName, formatStamp, timeAgo, CAMPAIGN_TYPES, audienceSummary } from '@/data/store'

const sentCampaigns = computed(() => store.campaigns.filter((c) => c.status === 'Sent'))

const totals = computed(() => {
  const all = sentCampaigns.value.map(campaignStats)
  const sum = (k) => all.reduce((a, s) => a + (s[k] ?? 0), 0)
  const graded = sentCampaigns.value.filter((c) => c.correctOption).map(campaignStats)
  return {
    sent: sum('sent'),
    responded: sum('responded'),
    gradedResponded: graded.reduce((a, s) => a + s.responded, 0),
    correct: graded.reduce((a, s) => a + s.correct, 0)
  }
})

const audience = computed(audienceSummary)
const recent = computed(() => store.campaigns.slice(0, 5))
const upcoming = computed(() =>
  store.campaigns.filter((c) => c.status === 'Scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 3)
)
const unanswered = computed(() => store.queries.filter((q) => q.status === 'Not answered' && !q.reviewed).slice(0, 4))

const weakTopics = computed(() =>
  sentCampaigns.value
    .filter((c) => c.correctOption)
    .map((c) => ({ c, s: campaignStats(c) }))
    .filter(({ s }) => s.responded)
    .map(({ c, s }) => ({ id: c.id, name: c.name, theme: c.theme, rate: percent(s.correct, s.responded) }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3)
)

const alerts = computed(() => {
  const list = []
  const pendingTemplates = store.templates.filter((t) => t.status === 'Pending').length
  if (audience.value.blocked['No consent yet']) list.push({ text: `${audience.value.blocked['No consent yet']} active employees haven't given consent yet, so they won't receive campaigns.`, to: { name: 'employees', query: { consent: 'Pending' } } })
  if (pendingTemplates) list.push({ text: `${pendingTemplates} template(s) waiting for Meta approval.`, to: { name: 'templates' } })
  if (store.campaigns.some((c) => c.status === 'Draft' && c.lastError)) list.push({ text: 'A scheduled campaign could not be sent and is back in drafts.', to: { name: 'campaigns', query: { tab: 'Draft' } } })
  if (store.settings.connection !== 'Connected') list.push({ text: 'The WhatsApp number is disconnected. Nothing can be sent.', to: { name: 'settings' } })
  return list
})

const checklist = computed(() => [
  { label: 'Connect the WhatsApp number', done: store.settings.connection === 'Connected', to: 'settings' },
  { label: 'Upload the employee list from HR', done: store.employees.length > 0, to: 'employees' },
  { label: 'Get a template approved by Meta', done: store.templates.some((t) => t.status === 'Approved' && t.type !== 'consent'), to: 'templates' },
  { label: 'Add answers to the knowledge base', done: store.faqs.some((f) => f.active), to: 'knowledgeBase' },
  { label: 'Send your first campaign', done: sentCampaigns.value.length > 0, to: 'campaigns' }
])

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})
</script>

<template>
  <PageHeader :title="`${greeting}, ${firstName(currentUser?.name)}`" subtitle="How your compliance communication on WhatsApp is going.">
    <template #actions>
      <router-link v-if="can('campaigns')" :to="{ name: 'campaignCreate' }" class="btn-primary"><Plus class="size-4" /> New campaign</router-link>
    </template>
  </PageHeader>

  <ul v-if="alerts.length" class="mb-6 space-y-2">
    <li v-for="a in alerts" :key="a.text">
      <router-link :to="a.to" class="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
        <TriangleAlert class="size-4 shrink-0" />
        <span class="flex-1">{{ a.text }}</span>
        <ArrowRight class="size-4 shrink-0" />
      </router-link>
    </li>
  </ul>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard label="Reachable employees" :value="`${audience.reachable}/${audience.active}`" hint="Active and consented" :icon="Users" />
    <StatCard label="Messages sent" :value="totals.sent" :hint="`${sentCampaigns.length} campaigns`" :icon="Send" />
    <StatCard label="Response rate" :value="`${percent(totals.responded, totals.sent)}%`" :hint="`${totals.responded} responses`" :icon="MessageSquareReply" />
    <StatCard label="Correct answers" :value="`${percent(totals.correct, totals.gradedResponded)}%`" hint="On True/False and video checks" :icon="Target" />
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
    <div class="card xl:col-span-2">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 class="font-semibold text-ink">Recent campaigns</h2>
        <router-link :to="{ name: 'campaigns' }" class="text-sm font-medium text-brand-700 hover:underline">View all</router-link>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="c in recent" :key="c.id">
          <router-link :to="{ name: 'campaignDetail', params: { id: c.id } }" class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-slate-800">{{ c.name }}</p>
              <p class="text-xs text-slate-500">
                {{ CAMPAIGN_TYPES[c.type]?.short }} ·
                {{ c.status === 'Sent' ? formatStamp(c.sentAt) : c.status === 'Scheduled' ? `Scheduled ${formatStamp(c.scheduledAt)}` : 'Not scheduled' }}
              </p>
            </div>
            <div v-if="c.status === 'Sent'" class="hidden text-right text-xs text-slate-500 sm:block">
              <p>{{ percent(campaignStats(c).responded, campaignStats(c).sent) }}% responded</p>
              <p v-if="c.correctOption">{{ percent(campaignStats(c).correct, campaignStats(c).responded) }}% correct</p>
            </div>
            <StatusBadge :status="c.status" />
          </router-link>
        </li>
      </ul>
      <p v-if="!recent.length" class="px-5 py-8 text-center text-sm text-slate-500">No campaigns yet.</p>
    </div>

    <div class="space-y-6">
      <div class="card p-5">
        <h2 class="font-semibold text-ink">Getting started</h2>
        <p class="mt-1 text-sm text-slate-500">{{ checklist.filter((c) => c.done).length }} of {{ checklist.length }} steps done</p>
        <ul class="mt-4 space-y-3">
          <li v-for="step in checklist" :key="step.label">
            <router-link :to="{ name: step.to }" class="flex items-center gap-3 text-sm hover:text-brand-700">
              <CircleCheck v-if="step.done" class="size-5 shrink-0 text-brand-600" />
              <Circle v-else class="size-5 shrink-0 text-slate-300" />
              <span :class="step.done ? 'text-slate-500 line-through' : 'text-slate-700'">{{ step.label }}</span>
            </router-link>
          </li>
        </ul>
      </div>

      <div class="card p-5">
        <h2 class="flex items-center gap-2 font-semibold text-ink"><CalendarClock class="size-5 text-brand-600" /> Coming up</h2>
        <ul class="mt-3 space-y-3 text-sm">
          <li v-for="c in upcoming" :key="c.id">
            <router-link :to="{ name: 'campaignDetail', params: { id: c.id } }" class="block hover:text-brand-700">
              <p class="font-medium text-slate-800">{{ c.name }}</p>
              <p class="text-xs text-slate-500">{{ formatStamp(c.scheduledAt) }}<template v-if="c.repeat !== 'none'"> · repeats {{ c.repeat }}</template></p>
            </router-link>
          </li>
        </ul>
        <p v-if="!upcoming.length" class="mt-3 text-sm text-slate-500">Nothing scheduled.</p>
      </div>
    </div>
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
    <div class="card">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 class="flex items-center gap-2 font-semibold text-ink"><Target class="size-5 text-orange-500" /> Weakest topics</h2>
        <router-link :to="{ name: 'insights' }" class="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">Reports <ArrowRight class="size-4" /></router-link>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="t in weakTopics" :key="t.id" class="px-5 py-3">
          <router-link :to="{ name: 'campaignDetail', params: { id: t.id } }" class="block">
            <div class="flex justify-between text-sm">
              <span class="font-medium text-slate-800">{{ t.name }}</span>
              <span class="font-semibold" :class="t.rate < 70 ? 'text-orange-600' : 'text-slate-700'">{{ t.rate }}% correct</span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full" :class="t.rate < 70 ? 'bg-orange-500' : 'bg-brand-500'" :style="{ width: `${t.rate}%` }" />
            </div>
          </router-link>
        </li>
      </ul>
      <p v-if="!weakTopics.length" class="px-5 py-8 text-center text-sm text-slate-500">No graded answers yet.</p>
    </div>

    <div class="card">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 class="flex items-center gap-2 font-semibold text-ink"><MessageCircleQuestion class="size-5 text-amber-500" /> Questions the bot couldn't answer</h2>
        <router-link :to="{ name: 'queries' }" class="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">All queries <ArrowRight class="size-4" /></router-link>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="q in unanswered" :key="q.id" class="px-5 py-3">
          <p class="text-sm text-slate-800">"{{ q.text }}"</p>
          <p class="mt-0.5 text-xs text-slate-500">{{ q.name }} · {{ timeAgo(q.at) }}</p>
        </li>
      </ul>
      <p v-if="!unanswered.length" class="px-5 py-8 text-center text-sm text-slate-500">All caught up. Every question was answered or reviewed.</p>
    </div>
  </div>
</template>
