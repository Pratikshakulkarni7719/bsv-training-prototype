<script setup>
import { computed, ref } from 'vue'
import { Plus, Eye, Info, RefreshCw, Pencil, Trash2, FileText } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import WhatsAppPreview from '@/components/WhatsAppPreview.vue'
import { store, toast, audit, can, stamp, formatStamp, templateUsage, TEMPLATE_TYPES } from '@/data/store'

const canEdit = computed(() => can('content'))
const typeFilter = ref('')
const statusFilter = ref('')
const previewing = ref(null)
const deleting = ref(null)

const list = computed(() =>
  store.templates.filter((t) => (!typeFilter.value || t.type === typeFilter.value) && (!statusFilter.value || t.status === statusFilter.value))
)

// Prototype: pretend Meta reviewed the pending templates
function refreshStatus() {
  const pending = store.templates.filter((t) => t.status === 'Pending')
  if (!pending.length) return toast('All template statuses are up to date.')
  pending.forEach((t) => {
    t.status = 'Approved'
    t.updatedAt = stamp()
  })
  audit(`Meta approved ${pending.length} template(s)`)
  toast(`${pending.length} template(s) approved by Meta.`)
}

function blockedReason(t) {
  if (t.type === 'consent') return 'The consent template is required by the system.'
  const active = store.campaigns.filter((c) => c.templateId === t.id && c.status !== 'Sent').length
  if (active) return `Used by ${active} draft or scheduled campaign(s).`
  return ''
}

function confirmDelete() {
  store.templates = store.templates.filter((t) => t.id !== deleting.value.id)
  audit(`Deleted template ${deleting.value.name}`)
  toast('Template deleted.')
  deleting.value = null
}
</script>

<template>
  <PageHeader title="Templates" subtitle="Message formats Meta approves once. Each campaign fills in its own content, so you don't wait for approval every time.">
    <template #actions>
      <button type="button" class="btn-secondary" @click="refreshStatus"><RefreshCw class="size-4" /> Check status</button>
      <router-link v-if="canEdit" :to="{ name: 'templateCreate' }" class="btn-primary"><Plus class="size-4" /> New template</router-link>
    </template>
  </PageHeader>

  <p class="mb-4 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
    <Info class="mt-0.5 size-4 shrink-0" />
    <span>
      WhatsApp only lets a business start a conversation with an approved template. <code v-pre>{{1}}</code> is the employee's first name and
      <code v-pre>{{2}}</code> is the campaign content. Approval takes from a few minutes to a day, and each language needs its own template.
    </span>
  </p>

  <div class="card">
    <div class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
      <select v-model="typeFilter" class="input sm:w-56" aria-label="Filter by type">
        <option value="">All types</option>
        <option v-for="(t, key) in TEMPLATE_TYPES" :key="key" :value="key">{{ t.label }}</option>
      </select>
      <select v-model="statusFilter" class="input sm:w-44" aria-label="Filter by status">
        <option value="">Any status</option>
        <option>Approved</option>
        <option>Pending</option>
        <option>Rejected</option>
      </select>
    </div>
    <div v-if="list.length" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Type</th>
            <th class="px-4 py-3">Language</th>
            <th class="px-4 py-3">Buttons</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Used</th>
            <th class="px-4 py-3">Updated</th>
            <th class="px-4 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="t in list" :key="t.id" class="hover:bg-slate-50">
            <td class="px-4 py-3">
              <p class="font-mono text-slate-800">{{ t.name }}</p>
              <p v-if="t.status === 'Rejected'" class="mt-0.5 max-w-xs text-xs text-red-600">{{ t.rejectReason }}</p>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ TEMPLATE_TYPES[t.type]?.short }}</td>
            <td class="px-4 py-3 text-slate-600">{{ t.language }}</td>
            <td class="px-4 py-3 text-xs text-slate-600">{{ t.buttons.join(' · ') || '—' }}</td>
            <td class="px-4 py-3"><StatusBadge :status="t.status" /></td>
            <td class="px-4 py-3 text-slate-600">{{ templateUsage(t.id) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ formatStamp(t.updatedAt, false) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Preview" :aria-label="`Preview ${t.name}`" @click="previewing = t"><Eye class="size-4" /></button>
              <template v-if="canEdit">
                <router-link :to="{ name: 'templateEdit', params: { id: t.id } }" class="inline-flex rounded p-1.5 text-slate-500 hover:bg-slate-100" :title="t.status === 'Rejected' ? 'Fix and resubmit' : 'Edit'" :aria-label="`Edit ${t.name}`">
                  <Pencil class="size-4" />
                </router-link>
                <button
                  type="button"
                  class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="!!blockedReason(t)"
                  :title="blockedReason(t) || 'Delete'"
                  :aria-label="`Delete ${t.name}`"
                  @click="deleting = t"
                >
                  <Trash2 class="size-4" />
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else :icon="FileText" title="No templates match" text="Try a different filter or create a template." />
  </div>

  <BaseModal :open="!!previewing" :title="previewing?.name ?? ''" @close="previewing = null">
    <WhatsAppPreview
      v-if="previewing"
      :header="previewing.header"
      :body="previewing.body"
      :buttons="previewing.buttons"
      content="Confidential information can be discussed in a public place if you speak quietly."
      video-title="Gift offered to a doctor"
    />
  </BaseModal>

  <BaseModal :open="!!deleting" title="Delete template" size="sm" @close="deleting = null">
    <p class="text-sm text-slate-600">Delete <b class="font-mono">{{ deleting?.name }}</b>? Sent campaigns keep their results.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deleting = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
    </template>
  </BaseModal>
</template>
