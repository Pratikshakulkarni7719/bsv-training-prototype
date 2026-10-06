<script setup>
import { computed, ref } from 'vue'
import { Download, Sparkles, TrendingUp, TrendingDown, Minus, Send, MessageSquareReply, Target, Bot, Trophy, UserX, Loader2, RefreshCw } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { store, percent, toast, parseStamp, formatPhone, timeAgo, REGIONS, CAMPAIGN_TYPES } from '@/data/store'
import { downloadWorkbook } from '@/data/files'

const range = ref('30')
const region = ref('')
const type = ref('')

const cutoff = computed(() => (range.value === 'all' ? null : Date.now() - Number(range.value) * 86400000))
const inRange = (s) => !cutoff.value || parseStamp(s)?.getTime() >= cutoff.value

const campaigns = computed(() => store.campaigns.filter((c) => c.status === 'Sent' && inRange(c.sentAt) && (!type.value || c.type === type.value)))

// Every delivered message in range, with its campaign, filtered by region
const rows = computed(() =>
  campaigns.value.flatMap((c) =>
    c.recipients.filter((r) => r.status !== 'Failed' && (!region.value || r.region === region.value)).map((r) => ({ c, r }))
  )
)

const totals = computed(() => {
  const responded = rows.value.filter(({ r }) => r.response)
  const graded = responded.filter(({ c }) => c.correctOption)
  return {
    sent: rows.value.length,
    responded: responded.length,
    graded: graded.length,
    correct: graded.filter(({ c, r }) => r.response === c.correctOption).length
  }
})

const queries = computed(() => store.queries.filter((q) => inRange(q.at) && q.status !== 'Not registered'))
const botRate = computed(() => percent(queries.value.filter((q) => q.status === 'Answered').length, queries.value.length))

/* Weekly trend -------------------------------------------------------- */
const weekly = computed(() => {
  const weeks = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now)
    end.setDate(end.getDate() - i * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    const inWeek = rows.value.filter(({ c }) => {
      const t = parseStamp(c.sentAt)
      return t > start && t <= end
    })
    weeks.push({
      label: end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      sent: inWeek.length,
      responded: inWeek.filter(({ r }) => r.response).length
    })
  }
  return weeks
})
const maxWeek = computed(() => Math.max(1, ...weekly.value.map((w) => w.sent)))

/* Topics -------------------------------------------------------------- */
const topics = computed(() => {
  const map = {}
  rows.value.forEach(({ c, r }) => {
    const key = c.theme || 'No theme'
    map[key] ??= { theme: key, campaigns: new Set(), sent: 0, responded: 0, graded: 0, correct: 0 }
    const t = map[key]
    t.campaigns.add(c.id)
    t.sent++
    if (r.response) {
      t.responded++
      if (c.correctOption) {
        t.graded++
        if (r.response === c.correctOption) t.correct++
      }
    }
  })
  return Object.values(map)
    .map((t) => ({ ...t, campaigns: t.campaigns.size, responseRate: percent(t.responded, t.sent), correctRate: t.graded ? percent(t.correct, t.graded) : null }))
    .sort((a, b) => (a.correctRate ?? 101) - (b.correctRate ?? 101))
})

/* Regions (replaces the Phase 2 "by group" table) --------------------- */
const regions = computed(() =>
  REGIONS.map((name) => {
    const list = rows.value.filter(({ r }) => r.region === name)
    const responded = list.filter(({ r }) => r.response)
    const graded = responded.filter(({ c }) => c.correctOption)
    return {
      name,
      sent: list.length,
      responseRate: percent(responded.length, list.length),
      correctRate: percent(graded.filter(({ c, r }) => r.response === c.correctOption).length, graded.length)
    }
  }).filter((r) => r.sent)
)

/* Leaderboard + non-responders --------------------------------------- */
const people = computed(() => {
  const map = {}
  rows.value.forEach(({ c, r }) => {
    map[r.employeeId] ??= { id: r.employeeId, name: r.name, phone: r.phone, region: r.region, received: 0, responded: 0, correct: 0 }
    const p = map[r.employeeId]
    p.received++
    if (r.response) {
      p.responded++
      if (c.correctOption && r.response === c.correctOption) p.correct++
    }
  })
  return Object.values(map).map((p) => ({ ...p, score: p.correct * 10 + p.responded * 5 }))
})
const leaders = computed(() => [...people.value].filter((p) => p.score).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 8))
const silent = computed(() =>
  people.value
    .filter((p) => p.received >= 2 && p.responded === 0)
    .map((p) => ({ ...p, lastActive: store.employees.find((e) => e.id === p.id)?.lastActive }))
)

/* Query categories ---------------------------------------------------- */
const queryCategories = computed(() => {
  const map = {}
  queries.value.forEach((q) => {
    const cat = store.faqs.find((f) => f.id === q.faqId)?.category ?? 'Not answered'
    map[cat] = (map[cat] ?? 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

/* Phase 2: AI insights (simulated) ----------------------------------- */
const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus }
const trendLabel = { up: 'Rising', down: 'Falling', flat: 'Steady' }
const maxMentions = computed(() => Math.max(1, ...store.insights.aiTopics.map((p) => p.mentions)))
const analysing = ref(false)
function refreshAi() {
  analysing.value = true
  setTimeout(() => {
    store.insights.aiTopics.forEach((t) => (t.mentions += Math.floor(Math.random() * 4)))
    store.insights.aiTopics.sort((a, b) => b.mentions - a.mentions)
    analysing.value = false
    toast('AI insights refreshed from the latest responses and questions.')
  }, 1500)
}

async function exportReport() {
  await downloadWorkbook(`bsv_compliance_report_${new Date().toISOString().slice(0, 10)}.xlsx`, [
    {
      name: 'Campaigns',
      rows: campaigns.value.map((c) => {
        const list = c.recipients.filter((r) => r.status !== 'Failed' && (!region.value || r.region === region.value))
        const responded = list.filter((r) => r.response)
        return {
          Campaign: c.name,
          Type: CAMPAIGN_TYPES[c.type]?.label,
          Theme: c.theme,
          'Sent at': c.sentAt,
          Sent: list.length,
          Responded: responded.length,
          'Response %': percent(responded.length, list.length),
          'Correct %': c.correctOption ? percent(responded.filter((r) => r.response === c.correctOption).length, responded.length) : ''
        }
      })
    },
    { name: 'Topics', rows: topics.value.map((t) => ({ Theme: t.theme, Campaigns: t.campaigns, Sent: t.sent, 'Response %': t.responseRate, 'Correct %': t.correctRate ?? '' })) },
    { name: 'Regions', rows: regions.value.map((r) => ({ Region: r.name, Sent: r.sent, 'Response %': r.responseRate, 'Correct %': r.correctRate })) },
    { name: 'Employees', rows: people.value.map((p) => ({ Employee: p.name, Region: p.region, Received: p.received, Responded: p.responded, Correct: p.correct, Score: p.score })) },
    { name: 'Queries', rows: queries.value.map((q) => ({ Date: q.at, Employee: q.name, Question: q.text, Status: q.status })) }
  ])
}
</script>

<template>
  <PageHeader title="Reports & insights" subtitle="Who responds, what they understand, and where training needs work.">
    <template #actions>
      <select v-model="range" class="input w-auto" aria-label="Date range">
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="all">All time</option>
      </select>
      <select v-model="region" class="input w-auto" aria-label="Region">
        <option value="">All regions</option>
        <option v-for="r in REGIONS" :key="r">{{ r }}</option>
      </select>
      <!-- Phase 2: groups (disabled)
      <select v-model="group" class="input w-auto" aria-label="Group">
        <option value="">All groups</option>
        <option v-for="g in store.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      -->
      <select v-model="type" class="input w-auto" aria-label="Campaign type">
        <option value="">All types</option>
        <option v-for="(t, key) in CAMPAIGN_TYPES" :key="key" :value="key">{{ t.short }}</option>
      </select>
      <button type="button" class="btn-secondary" @click="exportReport"><Download class="size-4" /> Export</button>
    </template>
  </PageHeader>

  <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
    <StatCard label="Messages delivered" :value="totals.sent" :hint="`${campaigns.length} campaigns`" :icon="Send" />
    <StatCard label="Response rate" :value="`${percent(totals.responded, totals.sent)}%`" :hint="`${totals.responded} responses`" :icon="MessageSquareReply" />
    <StatCard label="Correct answers" :value="`${percent(totals.correct, totals.graded)}%`" :hint="`${totals.correct} of ${totals.graded} graded`" :icon="Target" />
    <StatCard label="Bot answered" :value="`${botRate}%`" :hint="`${queries.length} employee questions`" :icon="Bot" />
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
    <!-- Weekly trend -->
    <div class="card p-5 xl:col-span-2">
      <h2 class="font-semibold text-ink">Weekly engagement</h2>
      <div class="mt-2 flex gap-4 text-xs text-slate-600">
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-slate-300" /> Delivered</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-brand-600" /> Responded</span>
      </div>
      <div class="mt-4 flex h-52 items-end gap-2 border-b border-slate-200 px-1 sm:gap-4">
        <div v-for="w in weekly" :key="w.label" class="flex h-full flex-1 items-end justify-center gap-0.5 sm:gap-1">
          <div class="w-1/3 rounded-t bg-slate-300" :style="{ height: `${percent(w.sent, maxWeek)}%` }" :title="`Week to ${w.label}: ${w.sent} delivered`" />
          <div class="w-1/3 rounded-t bg-brand-600" :style="{ height: `${percent(w.responded, maxWeek)}%` }" :title="`Week to ${w.label}: ${w.responded} responded`" />
        </div>
      </div>
      <div class="mt-2 flex gap-2 px-1 sm:gap-4">
        <p v-for="w in weekly" :key="w.label" class="flex-1 text-center text-[10px] text-slate-500 sm:text-xs">{{ w.label }}</p>
      </div>
    </div>

    <!-- Query categories -->
    <div class="card p-5">
      <h2 class="font-semibold text-ink">What employees ask about</h2>
      <ul class="mt-4 space-y-3">
        <li v-for="[cat, n] in queryCategories" :key="cat">
          <div class="flex justify-between text-sm">
            <span :class="cat === 'Not answered' ? 'text-amber-700' : 'text-slate-700'">{{ cat }}</span>
            <span class="font-medium text-slate-800">{{ n }}</span>
          </div>
          <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div :class="['h-full rounded-full', cat === 'Not answered' ? 'bg-amber-400' : 'bg-sky-500']" :style="{ width: `${percent(n, queries.length)}%` }" />
          </div>
        </li>
      </ul>
      <p v-if="!queryCategories.length" class="mt-4 text-sm text-slate-500">No questions in this period.</p>
    </div>
  </div>

  <!-- Topics -->
  <div class="card mt-6 overflow-x-auto">
    <div class="border-b border-slate-200 px-5 py-4">
      <h2 class="font-semibold text-ink">Topics, weakest first</h2>
      <p class="text-sm text-slate-500">Use this to plan next month's theme and refine training.</p>
    </div>
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-5 py-3">Theme</th>
          <th class="px-5 py-3">Campaigns</th>
          <th class="px-5 py-3">Response rate</th>
          <th class="px-5 py-3">Correct</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="t in topics" :key="t.theme">
          <td class="px-5 py-3 font-medium text-slate-800">{{ t.theme }}</td>
          <td class="px-5 py-3 text-slate-600">{{ t.campaigns }}</td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-3">
              <div class="h-2 w-28 overflow-hidden rounded-full bg-slate-100"><div class="h-full bg-brand-600" :style="{ width: `${t.responseRate}%` }" /></div>
              {{ t.responseRate }}%
            </div>
          </td>
          <td class="px-5 py-3">
            <span v-if="t.correctRate === null" class="text-slate-400">Not graded</span>
            <span v-else :class="t.correctRate < 70 ? 'font-semibold text-orange-600' : 'text-slate-700'">{{ t.correctRate }}%</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!topics.length" class="px-5 py-8 text-center text-sm text-slate-500">No campaigns sent in this period.</p>
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
    <!-- Regions -->
    <div class="card overflow-x-auto">
      <div class="border-b border-slate-200 px-5 py-4"><h2 class="font-semibold text-ink">By region</h2></div>
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-5 py-3">Region</th>
            <th class="px-5 py-3">Response rate</th>
            <th class="px-5 py-3">Correct</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="r in regions" :key="r.name">
            <td class="px-5 py-3 font-medium text-slate-800">{{ r.name }}</td>
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <div class="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div class="h-full bg-sky-500" :style="{ width: `${r.responseRate}%` }" /></div>
                {{ r.responseRate }}%
              </div>
            </td>
            <td :class="['px-5 py-3', r.correctRate < 70 ? 'font-semibold text-orange-600' : 'text-slate-700']">{{ r.correctRate }}%</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!regions.length" class="px-5 py-8 text-center text-sm text-slate-500">No data in this period.</p>
      <!-- Phase 2: groups (disabled). The old "By group" table used store.groups; region reporting replaces it. -->
    </div>

    <!-- Phase 2: leaderboard -->
    <div class="card">
      <div class="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Trophy class="size-5 text-amber-500" />
        <h2 class="font-semibold text-ink">Leaderboard</h2>
        <span class="ml-auto text-xs text-slate-500">10 pts per correct answer, 5 per response</span>
      </div>
      <ol class="divide-y divide-slate-100">
        <li v-for="(p, i) in leaders" :key="p.id" class="flex items-center gap-3 px-5 py-2.5 text-sm">
          <span :class="['flex size-7 items-center justify-center rounded-full text-xs font-bold', i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-600']">{{ i + 1 }}</span>
          <span class="flex-1 font-medium text-slate-800">{{ p.name }} <span class="text-xs font-normal text-slate-500">· {{ p.region }}</span></span>
          <span class="text-xs text-slate-500">{{ p.responded }}/{{ p.received }} answered</span>
          <span class="w-14 text-right font-semibold text-ink">{{ p.score }}</span>
        </li>
      </ol>
      <p v-if="!leaders.length" class="px-5 py-8 text-center text-sm text-slate-500">No responses in this period.</p>
    </div>
  </div>

  <!-- Non-responders -->
  <div class="card mt-6">
    <div class="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
      <UserX class="size-5 text-red-500" />
      <h2 class="font-semibold text-ink">Never responded</h2>
      <span class="ml-auto text-xs text-slate-500">Received 2+ campaigns in this period, answered none</span>
    </div>
    <ul class="divide-y divide-slate-100">
      <li v-for="p in silent" :key="p.id" class="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
        <span class="flex-1 font-medium text-slate-800">{{ p.name }} <span class="text-xs font-normal text-slate-500">· {{ p.region }} · {{ formatPhone(p.phone) }}</span></span>
        <span class="text-xs text-slate-500">Received {{ p.received }} · last active {{ timeAgo(p.lastActive) }}</span>
      </li>
    </ul>
    <p v-if="!silent.length" class="px-5 py-6 text-center text-sm text-slate-500">Everyone who received several campaigns responded at least once.</p>
  </div>

  <!-- Phase 2: AI insights -->
  <div class="card mt-6">
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-4">
      <Sparkles class="size-5 text-violet-600" />
      <h2 class="font-semibold text-ink">AI insights</h2>
      <span class="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">Phase 2 · simulated</span>
      <button type="button" class="btn-secondary ml-auto px-3 py-1.5" :disabled="analysing" @click="refreshAi">
        <Loader2 v-if="analysing" class="size-4 animate-spin" /><RefreshCw v-else class="size-4" /> Refresh
      </button>
    </div>
    <div class="grid grid-cols-1 gap-6 p-5 lg:grid-cols-3">
      <ul class="space-y-4 lg:col-span-2">
        <li v-for="(p, i) in store.insights.aiTopics" :key="p.theme" class="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto] md:items-center">
          <div>
            <p class="font-medium text-slate-800">{{ i + 1 }}. {{ p.theme }}</p>
            <p class="mt-0.5 text-sm italic text-slate-500">"{{ p.quote }}"</p>
          </div>
          <div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-violet-500" :style="{ width: `${percent(p.mentions, maxMentions)}%` }" /></div>
            <p class="mt-1 text-xs text-slate-500">{{ p.mentions }} mentions</p>
          </div>
          <span class="inline-flex items-center gap-1 text-xs font-medium text-slate-600"><component :is="trendIcon[p.trend]" class="size-4" /> {{ trendLabel[p.trend] }}</span>
        </li>
      </ul>
      <div>
        <p class="text-sm font-medium text-slate-700">Tone of free-text messages</p>
        <div class="mt-3 flex h-4 overflow-hidden rounded-full">
          <div class="bg-brand-500" :style="{ width: `${store.insights.sentiment.positive}%` }" />
          <div class="bg-slate-300" :style="{ width: `${store.insights.sentiment.neutral}%` }" />
          <div class="bg-orange-500" :style="{ width: `${store.insights.sentiment.negative}%` }" />
        </div>
        <ul class="mt-3 space-y-1.5 text-sm">
          <li class="flex justify-between"><span class="flex items-center gap-2"><span class="size-2.5 rounded-sm bg-brand-500" /> Positive</span><b>{{ store.insights.sentiment.positive }}%</b></li>
          <li class="flex justify-between"><span class="flex items-center gap-2"><span class="size-2.5 rounded-sm bg-slate-300" /> Neutral</span><b>{{ store.insights.sentiment.neutral }}%</b></li>
          <li class="flex justify-between"><span class="flex items-center gap-2"><span class="size-2.5 rounded-sm bg-orange-500" /> Negative</span><b>{{ store.insights.sentiment.negative }}%</b></li>
        </ul>
      </div>
    </div>
    <p class="border-t border-slate-200 bg-violet-50/50 px-5 py-3 text-sm text-violet-900">
      <b>Suggestion:</b> make next month's theme <b>{{ store.insights.aiTopics[0]?.theme.toLowerCase() }}</b>
      <template v-if="topics[0]?.correctRate !== null && topics[0]"> and re-run a check on <b>{{ topics[0].theme }}</b> ({{ topics[0].correctRate }}% correct)</template>.
    </p>
  </div>
</template>
