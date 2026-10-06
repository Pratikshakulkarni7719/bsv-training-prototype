<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Download, BookPlus, Check, Smartphone, MessageCircleQuestion, Info, Undo2 } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import { store, toast, audit, can, formatStamp, formatPhone, timeAgo, employeeById } from '@/data/store'
import { downloadWorkbook } from '@/data/files'

const router = useRouter()
const canEdit = computed(() => can('queries'))
const canAddFaq = computed(() => can('content'))

const tabs = ['Not answered', 'Answered', 'Not registered', 'All']
const tab = ref('Not answered')
const search = ref('')
const showReviewed = ref(false)

const list = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.queries.filter(
    (x) =>
      (tab.value === 'All' || x.status === tab.value) &&
      (showReviewed.value || tab.value !== 'Not answered' || !x.reviewed) &&
      (!q || x.text.toLowerCase().includes(q) || x.name.toLowerCase().includes(q))
  )
})

const count = (t) => store.queries.filter((x) => (t === 'All' || x.status === t) && (t !== 'Not answered' || !x.reviewed)).length
const answeredRate = computed(() => {
  const asked = store.queries.filter((q) => q.status !== 'Not registered')
  return asked.length ? Math.round((asked.filter((q) => q.status === 'Answered').length / asked.length) * 100) : 0
})

function faqFor(id) {
  return store.faqs.find((f) => f.id === id)
}

function toggleReviewed(q) {
  q.reviewed = !q.reviewed
  audit(`${q.reviewed ? 'Marked' : 'Unmarked'} query as reviewed: "${q.text}"`)
  toast(q.reviewed ? 'Marked as reviewed.' : 'Moved back to the open list.')
}

function addToKb(q) {
  router.push({ name: 'knowledgeBase', query: { question: q.text, queryId: q.id } })
}

async function exportQueries() {
  await downloadWorkbook(`employee_queries_${new Date().toISOString().slice(0, 10)}.xlsx`, [
    {
      name: 'Queries',
      rows: list.value.map((q) => ({
        Date: q.at,
        Employee: q.name,
        'Employee ID': employeeById(q.employeeId)?.empId ?? '',
        Region: employeeById(q.employeeId)?.region ?? '',
        'WhatsApp number': formatPhone(q.phone),
        Question: q.text,
        Status: q.status,
        'Bot reply': q.reply,
        Reviewed: q.reviewed ? 'Yes' : 'No'
      }))
    }
  ])
}
</script>

<template>
  <PageHeader title="Employee queries" subtitle="Every question employees asked the WhatsApp bot, and what it replied.">
    <template #actions>
      <button type="button" class="btn-secondary" @click="exportQueries"><Download class="size-4" /> Export</button>
    </template>
  </PageHeader>

  <p class="mb-4 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
    <Info class="mt-0.5 size-4 shrink-0" />
    <span>
      The bot replies on its own. Nobody from the team chats with employees. When it can't answer, it tells them to contact their local compliance team or manager.
      Use the unanswered list to grow the knowledge base. The bot answered <b>{{ answeredRate }}%</b> of employee questions.
    </span>
  </p>

  <div class="card">
    <div class="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        <button
          v-for="t in tabs"
          :key="t"
          type="button"
          role="tab"
          :aria-selected="tab === t"
          :class="['whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-slate-800']"
          @click="tab = t"
        >
          {{ t }} <span class="text-xs text-slate-400">{{ count(t) }}</span>
        </button>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label v-if="tab === 'Not answered'" class="flex items-center gap-2 text-sm text-slate-600">
          <input v-model="showReviewed" type="checkbox" class="rounded border-slate-300 text-brand-600" /> Show reviewed
        </label>
        <div class="relative sm:w-64">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input v-model="search" type="search" placeholder="Search question or name" aria-label="Search queries" class="input pl-9" />
        </div>
      </div>
    </div>

    <ul v-if="list.length" class="divide-y divide-slate-100">
      <li v-for="q in list" :key="q.id" :class="['px-5 py-4', q.reviewed ? 'bg-slate-50/60' : '']">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-xs text-slate-500">
              <b class="text-slate-700">{{ q.name }}</b>
              <template v-if="employeeById(q.employeeId)"> · {{ employeeById(q.employeeId).region }}</template>
              · {{ formatPhone(q.phone) }} · <span :title="formatStamp(q.at)">{{ timeAgo(q.at) }}</span>
            </p>
            <p class="mt-1 font-medium text-slate-800">"{{ q.text }}"</p>
            <p class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-100">
              <span class="text-xs font-semibold uppercase text-slate-400">Bot replied</span><br />
              <span class="whitespace-pre-line">{{ q.reply }}</span>
            </p>
            <p v-if="q.faqId && faqFor(q.faqId)" class="mt-1 text-xs text-slate-500">Matched answer: "{{ faqFor(q.faqId).question }}"</p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex items-center gap-2">
              <span v-if="q.reviewed" class="text-xs text-slate-500">Reviewed</span>
              <StatusBadge :status="q.status" />
            </div>
            <div class="flex flex-wrap justify-end gap-1">
              <button v-if="canAddFaq && q.status === 'Not answered'" type="button" class="btn-secondary px-3 py-1.5" @click="addToKb(q)"><BookPlus class="size-4" /> Add answer</button>
              <button v-if="canEdit && q.status !== 'Answered'" type="button" class="btn-secondary px-3 py-1.5" @click="toggleReviewed(q)">
                <component :is="q.reviewed ? Undo2 : Check" class="size-4" /> {{ q.reviewed ? 'Reopen' : 'Mark reviewed' }}
              </button>
              <router-link :to="{ name: 'simulator', query: { phone: q.phone } }" class="btn-secondary px-3 py-1.5" title="See the full chat"><Smartphone class="size-4" /> Chat</router-link>
            </div>
          </div>
        </div>
      </li>
    </ul>
    <EmptyState
      v-else
      :icon="MessageCircleQuestion"
      :title="tab === 'Not answered' && !search ? 'Nothing to review' : 'No queries here'"
      :text="tab === 'Not answered' && !search ? 'Every question was answered by the bot or already reviewed.' : 'Try another tab or search.'"
    />
  </div>
</template>
