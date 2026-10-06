<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Plus, Upload, Download, Search, Pencil, Trash2, Send, Users, FileSpreadsheet, CircleAlert, UserX, UserCheck,
  Eye, ChevronLeft, ChevronRight, Loader2, Smartphone, CircleCheck, Info
} from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  store, toast, audit, can, normalizePhone, formatPhone, formatStamp, timeAgo, REGIONS, LANGUAGES, DESIGNATIONS,
  addEmployee, updateEmployee, deactivateEmployee, reactivateEmployee, deleteEmployee, requestConsent,
  validateImport, applyImport, CAMPAIGN_TYPES
  // groupName // Phase 2: groups (disabled)
} from '@/data/store'
import { checkSpreadsheet, readSpreadsheet, downloadWorkbook, downloadSampleEmployeeFile, sampleImportRows } from '@/data/files'

const route = useRoute()
const canEdit = computed(() => can('employees'))

/* Filters ------------------------------------------------------------ */
const search = ref('')
const statusFilter = ref('Active')
const consentFilter = ref(typeof route.query.consent === 'string' ? route.query.consent : '')
const regionFilter = ref('')
const languageFilter = ref('')
// const groupFilter = ref('') // Phase 2: groups (disabled)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  return store.employees.filter((e) => {
    const matchesSearch =
      !q || e.name.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q) || (qDigits.length >= 3 && e.phone.includes(qDigits))
    // const matchesGroup = !groupFilter.value || e.groupIds.includes(Number(groupFilter.value)) // Phase 2: groups (disabled)
    return (
      matchesSearch &&
      (!statusFilter.value || e.status === statusFilter.value) &&
      (!consentFilter.value || e.consent === consentFilter.value) &&
      (!regionFilter.value || e.region === regionFilter.value) &&
      (!languageFilter.value || e.language === languageFilter.value)
    )
  })
})

const counts = computed(() => {
  const c = { Active: 0, Inactive: 0, Consented: 0, Pending: 0, Declined: 0 }
  store.employees.forEach((e) => {
    c[e.status]++
    if (e.status === 'Active') c[e.consent]++
  })
  return c
})

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  consentFilter.value = ''
  regionFilter.value = ''
  languageFilter.value = ''
}

/* Pagination --------------------------------------------------------- */
const PAGE_SIZE = 10
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([search, statusFilter, consentFilter, regionFilter, languageFilter], () => {
  page.value = 1
  selected.value = []
})
watch(pageCount, (n) => {
  if (page.value > n) page.value = n
})

/* Selection + bulk actions ------------------------------------------ */
const selected = ref([])
const allOnPageSelected = computed(() => pageRows.value.length > 0 && pageRows.value.every((e) => selected.value.includes(e.id)))
function toggleAll() {
  if (allOnPageSelected.value) selected.value = selected.value.filter((id) => !pageRows.value.some((e) => e.id === id))
  else selected.value = [...new Set([...selected.value, ...pageRows.value.map((e) => e.id)])]
}
const selectedEmployees = computed(() => store.employees.filter((e) => selected.value.includes(e.id)))

function bulkConsent() {
  let sent = 0
  let skipped = 0
  selectedEmployees.value.forEach((e) => {
    if (e.status !== 'Active' || e.consent !== 'Pending') return skipped++
    requestConsent(e)
    sent++
  })
  if (sent) audit(`Sent consent request to ${sent} employees`)
  toast(sent ? `Consent request sent to ${sent} employee(s).${skipped ? ` ${skipped} skipped (already consented, opted out or inactive).` : ''}` : 'None of the selected employees are waiting for consent.', sent ? 'success' : 'error')
  selected.value = []
}

function bulkStatus(active) {
  const list = selectedEmployees.value.filter((e) => (active ? e.status === 'Inactive' : e.status === 'Active'))
  list.forEach((e) => (active ? reactivateEmployee(e) : deactivateEmployee(e)))
  if (list.length) audit(`${active ? 'Reactivated' : 'Deactivated'} ${list.length} employees`)
  toast(list.length ? `${list.length} employee(s) ${active ? 'reactivated' : 'deactivated'}.` : 'Nothing to change for the selected employees.', list.length ? 'success' : 'error')
  selected.value = []
}

const bulkDeleteOpen = ref(false)
function confirmBulkDelete() {
  const n = selectedEmployees.value.length
  selectedEmployees.value.forEach(deleteEmployee)
  audit(`Deleted ${n} employees permanently`)
  toast(`${n} employee(s) deleted.`)
  selected.value = []
  bulkDeleteOpen.value = false
}

/* Add / edit --------------------------------------------------------- */
const formOpen = ref(false)
const editing = ref(null)
const form = reactive({ empId: '', name: '', phone: '', region: '', designation: '', manager: '', language: 'English' })
const errors = reactive({})

function openAdd() {
  editing.value = null
  Object.assign(form, { empId: '', name: '', phone: '+91 ', region: '', designation: DESIGNATIONS[0], manager: '', language: 'English' })
  Object.keys(errors).forEach((k) => delete errors[k])
  formOpen.value = true
}

function openEdit(e) {
  editing.value = e
  Object.assign(form, { empId: e.empId, name: e.name, phone: formatPhone(e.phone), region: e.region, designation: e.designation, manager: e.manager, language: e.language })
  Object.keys(errors).forEach((k) => delete errors[k])
  formOpen.value = true
}

const phoneWillChange = computed(() => editing.value && normalizePhone(form.phone) && normalizePhone(form.phone) !== editing.value.phone)

function save() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const empId = form.empId.trim().toUpperCase()
  const phone = normalizePhone(form.phone)
  if (!empId) errors.empId = 'Employee ID is required.'
  else if (store.employees.some((e) => e.empId === empId && e.id !== editing.value?.id)) errors.empId = 'Another employee already has this ID.'
  if (!form.name.trim()) errors.name = 'Name is required.'
  if (!phone) errors.phone = 'Enter a valid mobile number, e.g. +91 98220 11001.'
  else {
    const owner = store.employees.find((e) => e.phone === phone && e.id !== editing.value?.id)
    if (owner) errors.phone = `This number already belongs to ${owner.name} (${owner.empId}).`
  }
  if (Object.keys(errors).length) return

  const data = { empId, name: form.name.trim().replace(/\s+/g, ' '), phone, region: form.region, designation: form.designation, manager: form.manager.trim(), language: form.language }
  if (editing.value) {
    const changedPhone = updateEmployee(editing.value, data)
    audit(`Updated employee ${data.name} (${empId})`)
    toast(changedPhone ? 'Employee updated. A new consent request was sent to the new number.' : 'Employee updated.')
  } else {
    addEmployee(data)
    audit(`Added employee ${data.name} (${empId})`)
    toast(store.settings.autoConsent ? 'Employee added. A consent request was sent on WhatsApp.' : 'Employee added.')
  }
  formOpen.value = false
}

/* Deactivate / reactivate / delete ----------------------------------- */
const deactivating = ref(null)
const deactivateReason = ref('Left the organisation')
function openDeactivate(e) {
  deactivating.value = e
  deactivateReason.value = 'Left the organisation'
}
function confirmDeactivate() {
  deactivateEmployee(deactivating.value, deactivateReason.value)
  audit(`Deactivated ${deactivating.value.name}: ${deactivateReason.value}`)
  toast(`${deactivating.value.name} will no longer receive messages.`)
  deactivating.value = null
}

function reactivate(e) {
  reactivateEmployee(e)
  audit(`Reactivated ${e.name}`)
  toast(`${e.name} is active again.`)
}

const deleting = ref(null)
function confirmDelete() {
  deleteEmployee(deleting.value)
  audit(`Deleted employee ${deleting.value.name} (${deleting.value.empId}) permanently`)
  toast(`${deleting.value.name} was deleted.`)
  if (viewing.value?.id === deleting.value.id) viewing.value = null
  deleting.value = null
}

function resendConsent(e) {
  if (requestConsent(e)) {
    audit(`Sent consent request to ${e.name}`)
    toast(`Consent request sent to ${e.name}.`)
  } else toast(`${e.name} opted out. WhatsApp rules don't allow messaging them until they reply START.`, 'error')
}

/* Detail ------------------------------------------------------------- */
const viewing = ref(null)
const history = computed(() => {
  if (!viewing.value) return []
  return store.campaigns
    .filter((c) => c.status === 'Sent')
    .map((c) => ({ c, r: c.recipients.find((r) => r.employeeId === viewing.value.id) }))
    .filter((x) => x.r)
})
const viewingQueries = computed(() => store.queries.filter((q) => q.employeeId === viewing.value?.id))

/* Import ------------------------------------------------------------- */
const importOpen = ref(false)
const importStep = ref('upload')
const importFileName = ref('')
const importError = ref('')
const importLoading = ref(false)
const preview = ref(null)
const previewTab = ref('all')
const deactivateMissing = ref(false)
const importResult = ref(null)
const fileInput = ref(null)

function openImport() {
  importStep.value = 'upload'
  importFileName.value = ''
  importError.value = ''
  preview.value = null
  previewTab.value = 'all'
  deactivateMissing.value = false
  importResult.value = null
  importOpen.value = true
}

async function onFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  importError.value = checkSpreadsheet(file)
  if (importError.value) return
  importLoading.value = true
  try {
    const rows = await readSpreadsheet(file)
    buildPreview(rows, file.name)
  } catch {
    importError.value = 'This file could not be read. Make sure it is a valid Excel or CSV file.'
  } finally {
    importLoading.value = false
  }
}

function useSampleFile() {
  buildPreview(sampleImportRows(store.employees), 'hr_master_october.xlsx (sample)')
}

function buildPreview(rows, name) {
  const result = validateImport(rows)
  if (result.error) {
    importError.value = result.error
    return
  }
  importFileName.value = name
  preview.value = result
  importStep.value = 'preview'
}

const previewCounts = computed(() => {
  const c = { add: 0, update: 0, reactivate: 0, unchanged: 0, error: 0 }
  preview.value?.items.forEach((i) => c[i.action]++)
  return c
})
const previewRows = computed(() => preview.value?.items.filter((i) => previewTab.value === 'all' || i.action === previewTab.value) ?? [])
const importable = computed(() => previewCounts.value.add + previewCounts.value.update + previewCounts.value.reactivate + (deactivateMissing.value ? preview.value?.missing.length ?? 0 : 0))

const actionLabel = { add: 'New', update: 'Update', reactivate: 'Rejoined', unchanged: 'No change', error: 'Error' }
const actionClass = {
  add: 'bg-emerald-50 text-emerald-700',
  update: 'bg-sky-50 text-sky-700',
  reactivate: 'bg-violet-50 text-violet-700',
  unchanged: 'bg-slate-100 text-slate-600',
  error: 'bg-red-50 text-red-700'
}

function finishImport() {
  const result = applyImport(preview.value, { deactivateMissing: deactivateMissing.value })
  audit(`Imported ${importFileName.value}: ${result.added} added, ${result.updated} updated, ${result.reactivated} reactivated, ${result.deactivated} deactivated, ${result.skipped} skipped`)
  importResult.value = result
  importStep.value = 'done'
}

async function downloadErrors() {
  await downloadWorkbook('import_errors.xlsx', [
    {
      name: 'Errors',
      rows: preview.value.items.filter((i) => i.action === 'error').map((i) => ({ Row: i.row, 'Employee ID': i.data.empId, Name: i.data.name, 'WhatsApp number': i.rawPhone, Problem: i.errors.join('; ') }))
    }
  ])
}

async function exportList() {
  await downloadWorkbook(`bsv_employees_${new Date().toISOString().slice(0, 10)}.xlsx`, [
    {
      name: 'Employees',
      rows: filtered.value.map((e) => ({
        'Employee ID': e.empId,
        Name: e.name,
        'WhatsApp number': formatPhone(e.phone),
        Region: e.region,
        Designation: e.designation,
        Manager: e.manager,
        Language: e.language,
        Status: e.status,
        Consent: e.consent,
        'Last active': e.lastActive ?? ''
      }))
    }
  ])
  toast(`Exported ${filtered.value.length} employees.`)
}
</script>

<template>
  <PageHeader title="Employees" subtitle="The field-force list from HR. Everyone active and consented receives campaigns. No sign-up needed.">
    <template #actions>
      <button type="button" class="btn-secondary" @click="exportList"><Download class="size-4" /> Export</button>
      <template v-if="canEdit">
        <button type="button" class="btn-secondary" @click="openImport"><Upload class="size-4" /> Import HR list</button>
        <button type="button" class="btn-primary" @click="openAdd"><Plus class="size-4" /> Add employee</button>
      </template>
    </template>
  </PageHeader>

  <!-- Summary chips double as quick filters -->
  <div class="mb-4 flex flex-wrap gap-2 text-sm">
    <button type="button" class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50" @click="clearFilters(); statusFilter = 'Active'">
      <b>{{ counts.Active }}</b> active
    </button>
    <button type="button" class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50" @click="clearFilters(); statusFilter = 'Active'; consentFilter = 'Consented'">
      <b class="text-emerald-700">{{ counts.Consented }}</b> consented
    </button>
    <button type="button" class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50" @click="clearFilters(); statusFilter = 'Active'; consentFilter = 'Pending'">
      <b class="text-amber-700">{{ counts.Pending }}</b> waiting for consent
    </button>
    <button type="button" class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50" @click="clearFilters(); statusFilter = 'Active'; consentFilter = 'Declined'">
      <b class="text-red-700">{{ counts.Declined }}</b> opted out
    </button>
    <button type="button" class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50" @click="clearFilters(); statusFilter = 'Inactive'">
      <b class="text-slate-600">{{ counts.Inactive }}</b> inactive (left)
    </button>
  </div>

  <div class="card">
    <div class="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row">
      <div class="relative flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input v-model="search" type="search" placeholder="Search name, employee ID or number" aria-label="Search employees" class="input pl-9" />
      </div>
      <select v-model="statusFilter" class="input lg:w-36" aria-label="Filter by status">
        <option value="">Any status</option>
        <option>Active</option>
        <option>Inactive</option>
      </select>
      <select v-model="consentFilter" class="input lg:w-40" aria-label="Filter by consent">
        <option value="">Any consent</option>
        <option>Consented</option>
        <option>Pending</option>
        <option>Declined</option>
      </select>
      <select v-model="regionFilter" class="input lg:w-36" aria-label="Filter by region">
        <option value="">All regions</option>
        <option v-for="r in REGIONS" :key="r">{{ r }}</option>
      </select>
      <select v-model="languageFilter" class="input lg:w-36" aria-label="Filter by language">
        <option value="">All languages</option>
        <option v-for="l in LANGUAGES" :key="l">{{ l }}</option>
      </select>
      <!-- Phase 2: groups (disabled)
      <select v-model="groupFilter" class="input md:w-48" aria-label="Filter by group">
        <option value="">All groups</option>
        <option v-for="g in store.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      -->
    </div>

    <!-- Bulk action bar -->
    <div v-if="selected.length && canEdit" class="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-brand-50/60 px-4 py-2.5 text-sm">
      <span class="mr-2 font-medium text-slate-700">{{ selected.length }} selected</span>
      <button type="button" class="btn-secondary px-3 py-1.5" @click="bulkConsent"><Send class="size-4" /> Request consent</button>
      <button type="button" class="btn-secondary px-3 py-1.5" @click="bulkStatus(false)"><UserX class="size-4" /> Deactivate</button>
      <button type="button" class="btn-secondary px-3 py-1.5" @click="bulkStatus(true)"><UserCheck class="size-4" /> Reactivate</button>
      <button type="button" class="btn-secondary px-3 py-1.5 text-red-600" @click="bulkDeleteOpen = true"><Trash2 class="size-4" /> Delete</button>
      <button type="button" class="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700" @click="selected = []">Clear selection</button>
    </div>

    <div v-if="filtered.length" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th v-if="canEdit" class="w-10 px-4 py-3">
              <input type="checkbox" class="rounded border-slate-300 text-brand-600" :checked="allOnPageSelected" aria-label="Select all on this page" @change="toggleAll" />
            </th>
            <th class="px-4 py-3">Employee</th>
            <th class="px-4 py-3">WhatsApp</th>
            <th class="px-4 py-3">Region</th>
            <!-- <th class="px-4 py-3">Groups</th> Phase 2: groups (disabled) -->
            <th class="px-4 py-3">Language</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Consent</th>
            <th class="px-4 py-3">Last active</th>
            <th class="px-4 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="e in pageRows" :key="e.id" :class="['hover:bg-slate-50', e.status === 'Inactive' ? 'text-slate-400' : '']">
            <td v-if="canEdit" class="px-4 py-3">
              <input v-model="selected" type="checkbox" :value="e.id" class="rounded border-slate-300 text-brand-600" :aria-label="`Select ${e.name}`" />
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <button type="button" class="text-left" @click="viewing = e">
                <p class="font-medium text-slate-800 hover:text-brand-700">{{ e.name }}</p>
                <p class="text-xs text-slate-500">{{ e.empId }} · {{ e.designation || '—' }}</p>
              </button>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">
              {{ formatPhone(e.phone) }}
              <p v-if="!e.onWhatsApp" class="text-xs text-red-600">Not on WhatsApp</p>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ e.region || '—' }}</td>
            <!-- Phase 2: groups (disabled)
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span v-for="g in e.groupIds" :key="g" class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{{ groupName(g) }}</span>
                <span v-if="!e.groupIds.length" class="text-xs text-slate-400">No group</span>
              </div>
            </td>
            -->
            <td class="px-4 py-3 text-slate-600">{{ e.language }}</td>
            <td class="px-4 py-3"><StatusBadge :status="e.status" /></td>
            <td class="px-4 py-3"><StatusBadge :status="e.consent" /></td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ timeAgo(e.lastActive) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="View details" :aria-label="`View ${e.name}`" @click="viewing = e">
                <Eye class="size-4" />
              </button>
              <template v-if="canEdit">
                <button
                  v-if="e.status === 'Active' && e.consent === 'Pending'"
                  type="button"
                  class="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                  title="Resend consent request"
                  :aria-label="`Resend consent request to ${e.name}`"
                  @click="resendConsent(e)"
                >
                  <Send class="size-4" />
                </button>
                <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit" :aria-label="`Edit ${e.name}`" @click="openEdit(e)">
                  <Pencil class="size-4" />
                </button>
                <button
                  v-if="e.status === 'Active'"
                  type="button"
                  class="rounded p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                  title="Deactivate (left / on leave)"
                  :aria-label="`Deactivate ${e.name}`"
                  @click="openDeactivate(e)"
                >
                  <UserX class="size-4" />
                </button>
                <button v-else type="button" class="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" title="Reactivate" :aria-label="`Reactivate ${e.name}`" @click="reactivate(e)">
                  <UserCheck class="size-4" />
                </button>
                <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete permanently" :aria-label="`Delete ${e.name}`" @click="deleting = e">
                  <Trash2 class="size-4" />
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else-if="store.employees.length" :icon="Users" title="No employees match" text="Try a different search or filter.">
      <button type="button" class="btn-secondary" @click="clearFilters">Clear filters</button>
    </EmptyState>
    <EmptyState v-else :icon="Users" title="No employees yet" text="Import the employee list you got from HR to get started.">
      <button v-if="canEdit" type="button" class="btn-primary" @click="openImport"><Upload class="size-4" /> Import HR list</button>
    </EmptyState>

    <div class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <p>Showing {{ filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0 }}–{{ Math.min(page * PAGE_SIZE, filtered.length) }} of {{ filtered.length }} ({{ store.employees.length }} total)</p>
      <div v-if="pageCount > 1" class="flex items-center gap-1">
        <button type="button" class="rounded p-1 hover:bg-slate-100 disabled:opacity-40" :disabled="page === 1" aria-label="Previous page" @click="page--"><ChevronLeft class="size-4" /></button>
        <span class="px-2">Page {{ page }} of {{ pageCount }}</span>
        <button type="button" class="rounded p-1 hover:bg-slate-100 disabled:opacity-40" :disabled="page === pageCount" aria-label="Next page" @click="page++"><ChevronRight class="size-4" /></button>
      </div>
    </div>
  </div>

  <!-- Add / edit -->
  <BaseModal :open="formOpen" :title="editing ? 'Edit employee' : 'Add employee'" @close="formOpen = false">
    <form id="emp-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2" novalidate @submit.prevent="save">
      <div>
        <label for="emp-id" class="label">Employee ID</label>
        <input id="emp-id" v-model="form.empId" class="input uppercase" placeholder="BSV1234" />
        <p v-if="errors.empId" class="error-text">{{ errors.empId }}</p>
      </div>
      <div>
        <label for="emp-name" class="label">Full name</label>
        <input id="emp-name" v-model="form.name" class="input" />
        <p v-if="errors.name" class="error-text">{{ errors.name }}</p>
      </div>
      <div class="sm:col-span-2">
        <label for="emp-phone" class="label">WhatsApp number</label>
        <input id="emp-phone" v-model="form.phone" class="input" placeholder="+91 98220 11001" inputmode="tel" />
        <p v-if="errors.phone" class="error-text">{{ errors.phone }}</p>
        <p v-else-if="phoneWillChange" class="mt-1 text-xs text-amber-700">The number is changing. The employee must give consent again on the new number.</p>
      </div>
      <div>
        <label for="emp-region" class="label">Region</label>
        <select id="emp-region" v-model="form.region" class="input">
          <option value="">Not set</option>
          <option v-for="r in REGIONS" :key="r">{{ r }}</option>
        </select>
      </div>
      <div>
        <label for="emp-lang" class="label">Preferred language</label>
        <select id="emp-lang" v-model="form.language" class="input">
          <option v-for="l in LANGUAGES" :key="l">{{ l }}</option>
        </select>
      </div>
      <div>
        <label for="emp-desig" class="label">Designation</label>
        <select id="emp-desig" v-model="form.designation" class="input">
          <option value="">Not set</option>
          <option v-for="d in DESIGNATIONS" :key="d">{{ d }}</option>
        </select>
      </div>
      <div>
        <label for="emp-mgr" class="label">Manager</label>
        <input id="emp-mgr" v-model="form.manager" class="input" />
      </div>
      <!-- Phase 2: groups (disabled)
      <fieldset class="sm:col-span-2">
        <legend class="label">Groups</legend>
        <div class="grid grid-cols-2 gap-2">
          <label v-for="g in store.groups" :key="g.id" class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="form.groupIds" type="checkbox" :value="g.id" class="rounded border-slate-300 text-brand-600" />
            {{ g.name }}
          </label>
        </div>
      </fieldset>
      -->
      <p v-if="!editing && store.settings.autoConsent" class="rounded-lg bg-sky-50 p-3 text-xs text-sky-800 sm:col-span-2">
        No sign-up needed. The employee gets a one-tap consent message on WhatsApp (required by WhatsApp rules) and starts receiving campaigns after tapping Agree.
      </p>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="formOpen = false">Cancel</button>
      <button type="submit" form="emp-form" class="btn-primary">{{ editing ? 'Save changes' : 'Add employee' }}</button>
    </template>
  </BaseModal>

  <!-- Deactivate -->
  <BaseModal :open="!!deactivating" title="Deactivate employee" size="sm" @close="deactivating = null">
    <p class="text-sm text-slate-600">
      <b>{{ deactivating?.name }}</b> will stop receiving campaigns and the bot will stop answering their messages. Their past responses stay in reports.
    </p>
    <label for="deact-reason" class="label mt-4">Reason</label>
    <select id="deact-reason" v-model="deactivateReason" class="input">
      <option>Left the organisation</option>
      <option>Long leave</option>
      <option>Moved out of the field force</option>
      <option>Other</option>
    </select>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deactivating = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDeactivate">Deactivate</button>
    </template>
  </BaseModal>

  <!-- Delete one -->
  <BaseModal :open="!!deleting" title="Delete employee permanently" size="sm" @close="deleting = null">
    <p class="text-sm text-slate-600">
      Delete <b>{{ deleting?.name }}</b> and their WhatsApp chat history? Past campaign results keep their name. If they just left the company,
      <b>Deactivate</b> is usually better.
    </p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deleting = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDelete">Delete permanently</button>
    </template>
  </BaseModal>

  <!-- Delete many -->
  <BaseModal :open="bulkDeleteOpen" title="Delete employees permanently" size="sm" @close="bulkDeleteOpen = false">
    <p class="text-sm text-slate-600">Delete <b>{{ selected.length }}</b> employee(s) and their chat history? This can't be undone.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="bulkDeleteOpen = false">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmBulkDelete">Delete {{ selected.length }}</button>
    </template>
  </BaseModal>

  <!-- Detail -->
  <BaseModal :open="!!viewing" :title="viewing?.name ?? ''" size="lg" @close="viewing = null">
    <template v-if="viewing">
      <div class="flex flex-wrap gap-2">
        <StatusBadge :status="viewing.status" />
        <StatusBadge :status="viewing.consent" />
        <span v-if="!viewing.onWhatsApp" class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Not on WhatsApp</span>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div><dt class="text-slate-500">Employee ID</dt><dd class="font-medium">{{ viewing.empId }}</dd></div>
        <div><dt class="text-slate-500">WhatsApp</dt><dd class="font-medium">{{ formatPhone(viewing.phone) }}</dd></div>
        <div><dt class="text-slate-500">Region</dt><dd class="font-medium">{{ viewing.region || '—' }}</dd></div>
        <div><dt class="text-slate-500">Designation</dt><dd class="font-medium">{{ viewing.designation || '—' }}</dd></div>
        <div><dt class="text-slate-500">Manager</dt><dd class="font-medium">{{ viewing.manager || '—' }}</dd></div>
        <div><dt class="text-slate-500">Language</dt><dd class="font-medium">{{ viewing.language }}</dd></div>
        <div><dt class="text-slate-500">Added</dt><dd class="font-medium">{{ formatStamp(viewing.addedAt, false) }}</dd></div>
        <div><dt class="text-slate-500">Last active</dt><dd class="font-medium">{{ timeAgo(viewing.lastActive) }}</dd></div>
        <div v-if="viewing.status === 'Inactive'"><dt class="text-slate-500">Inactive since</dt><dd class="font-medium">{{ formatStamp(viewing.leftAt, false) }}</dd></div>
      </dl>

      <h3 class="mt-6 text-sm font-semibold text-ink">Campaign responses</h3>
      <ul class="mt-2 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        <li v-for="{ c, r } in history" :key="c.id" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div class="min-w-0">
            <router-link :to="{ name: 'campaignDetail', params: { id: c.id } }" class="font-medium text-slate-800 hover:text-brand-700" @click="viewing = null">{{ c.name }}</router-link>
            <p class="text-xs text-slate-500">{{ CAMPAIGN_TYPES[c.type]?.short }} · {{ formatStamp(c.sentAt, false) }}</p>
          </div>
          <span v-if="r.status === 'Failed'" class="text-xs text-red-600">{{ r.reason }}</span>
          <span v-else-if="r.response" :class="['text-xs font-medium', c.correctOption ? (r.response === c.correctOption ? 'text-emerald-700' : 'text-orange-600') : 'text-slate-700']">
            {{ r.response }}<template v-if="c.correctOption">{{ r.response === c.correctOption ? ' ✓' : ' ✗' }}</template>
          </span>
          <span v-else class="text-xs text-slate-400">No response</span>
        </li>
        <li v-if="!history.length" class="px-3 py-4 text-center text-sm text-slate-500">No campaigns sent to this employee yet.</li>
      </ul>

      <h3 class="mt-6 text-sm font-semibold text-ink">Questions asked</h3>
      <ul class="mt-2 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        <li v-for="q in viewingQueries" :key="q.id" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span class="text-slate-700">"{{ q.text }}"</span>
          <StatusBadge :status="q.status" />
        </li>
        <li v-if="!viewingQueries.length" class="px-3 py-4 text-center text-sm text-slate-500">No questions yet.</li>
      </ul>

      <h3 class="mt-6 text-sm font-semibold text-ink">Consent history</h3>
      <ul class="mt-2 space-y-1 text-sm text-slate-600">
        <li v-for="(h, i) in viewing.consentHistory" :key="i">{{ formatStamp(h.at) }} · {{ { requested: 'Consent requested', agreed: 'Agreed', declined: 'Opted out (STOP)' }[h.action] }}</li>
        <li v-if="!viewing.consentHistory.length" class="text-slate-500">No consent request sent yet.</li>
      </ul>
    </template>
    <template #footer>
      <router-link v-if="viewing" :to="{ name: 'simulator', query: { phone: viewing.phone } }" class="btn-secondary"><Smartphone class="size-4" /> Open their WhatsApp chat</router-link>
      <button v-if="canEdit && viewing" type="button" class="btn-primary" @click="openEdit(viewing); viewing = null"><Pencil class="size-4" /> Edit</button>
    </template>
  </BaseModal>

  <!-- Import -->
  <BaseModal :open="importOpen" title="Import employee list from HR" size="lg" @close="importOpen = false">
    <div v-if="importStep === 'upload'" class="space-y-4">
      <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="sr-only" @change="onFile" />
      <button
        type="button"
        class="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-brand-500 hover:bg-brand-50/40"
        :disabled="importLoading"
        @click="fileInput.click()"
      >
        <Loader2 v-if="importLoading" class="size-10 animate-spin text-brand-600" />
        <FileSpreadsheet v-else class="size-10 text-slate-400" />
        <p class="mt-3 text-sm font-medium text-slate-700">{{ importLoading ? 'Reading file...' : 'Choose an Excel or CSV file' }}</p>
        <p class="mt-1 text-xs text-slate-500">Required columns: Employee ID, Name, WhatsApp number. Optional: Region, Designation, Manager, Language. Max 5 MB.</p>
      </button>
      <p v-if="importError" class="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><CircleAlert class="mt-0.5 size-4 shrink-0" /> {{ importError }}</p>
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" class="font-medium text-brand-700 hover:underline" @click="downloadSampleEmployeeFile"><Download class="mr-1 inline size-4" />Download sample file</button>
        <button type="button" class="btn-secondary px-3 py-1.5" @click="useSampleFile">Try with a sample HR file</button>
      </div>
      <p class="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <Info class="mt-0.5 size-3.5 shrink-0" />
        Employees are matched by Employee ID. Existing employees are updated, new ones are added, and people who left can be deactivated in one go.
        Numbers like 9822011001 are saved as +91 98220 11001.
      </p>
    </div>

    <div v-else-if="importStep === 'preview'">
      <p class="mb-3 text-sm text-slate-600"><b>{{ importFileName }}</b> · {{ preview.items.length }} rows</p>
      <div class="mb-3 flex flex-wrap gap-1">
        <button
          v-for="t in ['all', 'add', 'update', 'reactivate', 'unchanged', 'error']"
          :key="t"
          type="button"
          :class="['rounded-full px-3 py-1 text-xs font-medium', previewTab === t ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
          @click="previewTab = t"
        >
          {{ t === 'all' ? `All ${preview.items.length}` : `${actionLabel[t]} ${previewCounts[t]}` }}
        </button>
      </div>
      <div class="max-h-72 overflow-auto rounded-lg ring-1 ring-slate-200">
        <table class="min-w-full text-sm">
          <thead class="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2">Row</th>
              <th class="px-3 py-2">Employee</th>
              <th class="px-3 py-2">Number</th>
              <th class="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="r in previewRows" :key="r.row" :class="r.action === 'error' ? 'bg-red-50/50' : ''">
              <td class="px-3 py-2 text-slate-500">{{ r.row }}</td>
              <td class="px-3 py-2">
                <p class="font-medium text-slate-800">{{ r.data.name || '—' }}</p>
                <p class="text-xs text-slate-500">{{ r.data.empId || 'No ID' }}</p>
              </td>
              <td class="whitespace-nowrap px-3 py-2 text-slate-600">{{ r.data.phone ? formatPhone(r.data.phone) : r.rawPhone || '—' }}</td>
              <td class="px-3 py-2">
                <span :class="['rounded px-2 py-0.5 text-xs font-medium', actionClass[r.action]]">{{ actionLabel[r.action] }}</span>
                <p v-for="err in r.errors" :key="err" class="mt-1 text-xs text-red-700">{{ err }}</p>
                <p v-if="r.changes.length" class="mt-1 text-xs text-slate-500">Changes: {{ r.changes.join(', ') }}</p>
                <p v-for="w in r.warnings" :key="w" class="mt-1 text-xs text-amber-700">{{ w }}</p>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!previewRows.length" class="px-3 py-6 text-center text-sm text-slate-500">No rows in this category.</p>
      </div>
      <button v-if="previewCounts.error" type="button" class="mt-2 text-xs font-medium text-red-700 hover:underline" @click="downloadErrors">
        Download {{ previewCounts.error }} error row(s) to fix
      </button>

      <label v-if="preview.missing.length" class="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
        <input v-model="deactivateMissing" type="checkbox" class="mt-0.5 rounded border-amber-400 text-amber-600" />
        <span>
          <b>Full HR sync:</b> deactivate {{ preview.missing.length }} active employee(s) who are not in this file
          <span class="block text-xs text-amber-800">{{ preview.missing.slice(0, 6).map((e) => e.name).join(', ') }}{{ preview.missing.length > 6 ? ` and ${preview.missing.length - 6} more` : '' }}</span>
        </span>
      </label>
    </div>

    <div v-else class="py-4 text-center">
      <CircleCheck class="mx-auto size-12 text-brand-600" />
      <p class="mt-3 text-lg font-semibold text-ink">Import complete</p>
      <ul class="mx-auto mt-3 max-w-xs space-y-1 text-left text-sm text-slate-600">
        <li><b>{{ importResult.added }}</b> new employees added</li>
        <li><b>{{ importResult.updated }}</b> employees updated</li>
        <li v-if="importResult.reactivated"><b>{{ importResult.reactivated }}</b> rejoined employees reactivated</li>
        <li v-if="importResult.deactivated"><b>{{ importResult.deactivated }}</b> employees deactivated</li>
        <li v-if="importResult.skipped" class="text-red-700"><b>{{ importResult.skipped }}</b> rows skipped because of errors</li>
      </ul>
      <p v-if="importResult.added && store.settings.autoConsent" class="mt-4 text-xs text-slate-500">New employees were sent a one-tap consent message on WhatsApp.</p>
    </div>

    <template #footer>
      <template v-if="importStep === 'preview'">
        <button type="button" class="btn-secondary" @click="importStep = 'upload'">Choose another file</button>
        <button type="button" class="btn-primary" :disabled="!importable" @click="finishImport">
          {{ importable ? 'Import changes' : 'Nothing to import' }}
        </button>
      </template>
      <button v-else type="button" class="btn-secondary" @click="importOpen = false">{{ importStep === 'done' ? 'Close' : 'Cancel' }}</button>
    </template>
  </BaseModal>
</template>
