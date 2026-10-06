<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Search, Send, TriangleAlert, Repeat } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import { store, campaignStats, percent, can, formatStamp, CAMPAIGN_TYPES } from '@/data/store'
// import { groupName } from '@/data/store' // Phase 2: groups (disabled)

const route = useRoute()
const tabs = ['All', 'Sent', 'Scheduled', 'Draft']
const tab = ref(tabs.includes(route.query.tab) ? route.query.tab : 'All')
const search = ref('')
const type = ref('')

const filtered = computed(() =>
  store.campaigns.filter(
    (c) =>
      (tab.value === 'All' || c.status === tab.value) &&
      (!type.value || c.type === type.value) &&
      `${c.name} ${c.theme}`.toLowerCase().includes(search.value.trim().toLowerCase())
  )
)

const tabCount = (t) => (t === 'All' ? store.campaigns.length : store.campaigns.filter((c) => c.status === t).length)

function dateOf(c) {
  if (c.status === 'Sent') return formatStamp(c.sentAt)
  if (c.status === 'Scheduled') return formatStamp(c.scheduledAt)
  return '—'
}
</script>

<template>
  <PageHeader title="Campaigns" subtitle="Each campaign sends one personal WhatsApp message with reply buttons to every active employee.">
    <template #actions>
      <router-link v-if="can('campaigns')" :to="{ name: 'campaignCreate' }" class="btn-primary"><Plus class="size-4" /> New campaign</router-link>
    </template>
  </PageHeader>

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
          {{ t }} <span class="text-xs text-slate-400">{{ tabCount(t) }}</span>
        </button>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <select v-model="type" class="input sm:w-48" aria-label="Filter by type">
          <option value="">All types</option>
          <option v-for="(t, key) in CAMPAIGN_TYPES" :key="key" :value="key">{{ t.label }}</option>
        </select>
        <div class="relative sm:w-64">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input v-model="search" type="search" placeholder="Search name or theme" aria-label="Search campaigns" class="input pl-9" />
        </div>
      </div>
    </div>

    <div v-if="filtered.length" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Campaign</th>
            <th class="px-4 py-3">Audience</th>
            <!-- <th class="px-4 py-3">Groups</th> Phase 2: groups (disabled) -->
            <th class="px-4 py-3">Date</th>
            <th class="px-4 py-3">Responded</th>
            <th class="px-4 py-3">Correct</th>
            <th class="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="c in filtered" :key="c.id" class="hover:bg-slate-50">
            <td class="px-4 py-3">
              <router-link :to="{ name: 'campaignDetail', params: { id: c.id } }" class="font-medium text-slate-800 hover:text-brand-700">{{ c.name }}</router-link>
              <p class="text-xs text-slate-500">{{ CAMPAIGN_TYPES[c.type]?.short }}<template v-if="c.theme"> · {{ c.theme }}</template></p>
              <p v-if="c.lastError" class="mt-1 flex items-center gap-1 text-xs text-red-600"><TriangleAlert class="size-3.5" /> Not sent: {{ c.lastError }}</p>
            </td>
            <td class="px-4 py-3 text-slate-600">
              <template v-if="c.status === 'Sent'">{{ campaignStats(c).sent }} employees</template>
              <template v-else>All active employees</template>
            </td>
            <!-- Phase 2: groups (disabled)
            <td class="px-4 py-3 text-slate-600">{{ c.groupIds.map(groupName).join(', ') }}</td>
            -->
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">
              {{ dateOf(c) }}
              <span v-if="c.repeat !== 'none'" class="ml-1 inline-flex items-center gap-0.5 text-xs text-slate-500" :title="`Repeats ${c.repeat}`"><Repeat class="size-3" /> {{ c.repeat }}</span>
            </td>
            <td class="px-4 py-3 text-slate-600">
              <template v-if="c.status === 'Sent'">{{ percent(campaignStats(c).responded, campaignStats(c).sent) }}%</template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-3 text-slate-600">
              <template v-if="c.status === 'Sent' && c.correctOption">{{ percent(campaignStats(c).correct, campaignStats(c).responded) }}%</template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-3"><StatusBadge :status="c.status" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else :icon="Send" title="No campaigns here" :text="store.campaigns.length ? 'Try another tab, type or search.' : 'Create a campaign to send your first compliance message.'">
      <router-link v-if="can('campaigns') && !store.campaigns.length" :to="{ name: 'campaignCreate' }" class="btn-primary"><Plus class="size-4" /> New campaign</router-link>
    </EmptyState>
  </div>
</template>
