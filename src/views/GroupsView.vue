<script setup>
import { reactive, ref } from 'vue'
import { Plus, Pencil, Trash2, UsersRound } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import { store, nextId, toast } from '@/data/store'

const colors = ['bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500']

function members(groupId) {
  return store.staff.filter((s) => s.groupIds.includes(groupId))
}

const formOpen = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', description: '', memberIds: [] })
const error = ref('')

function openAdd() {
  editingId.value = null
  Object.assign(form, { name: '', description: '', memberIds: [] })
  error.value = ''
  formOpen.value = true
}

function openEdit(g) {
  editingId.value = g.id
  Object.assign(form, { name: g.name, description: g.description, memberIds: members(g.id).map((s) => s.id) })
  error.value = ''
  formOpen.value = true
}

function save() {
  error.value = form.name.trim() ? '' : 'Group name is required.'
  if (error.value) return
  let id = editingId.value
  if (id) {
    Object.assign(store.groups.find((g) => g.id === id), { name: form.name.trim(), description: form.description })
  } else {
    id = nextId(store.groups)
    store.groups.push({ id, name: form.name.trim(), description: form.description, color: colors[id % colors.length] })
  }
  // Sync membership
  store.staff.forEach((s) => {
    const inGroup = s.groupIds.includes(id)
    const selected = form.memberIds.includes(s.id)
    if (selected && !inGroup) s.groupIds.push(id)
    if (!selected && inGroup) s.groupIds = s.groupIds.filter((g) => g !== id)
  })
  toast(editingId.value ? 'Group updated.' : 'Group created.')
  formOpen.value = false
}

const deleting = ref(null)
function confirmDelete() {
  const id = deleting.value.id
  store.groups = store.groups.filter((g) => g.id !== id)
  store.staff.forEach((s) => (s.groupIds = s.groupIds.filter((g) => g !== id)))
  toast('Group deleted. Staff were kept.')
  deleting.value = null
}
</script>

<template>
  <PageHeader title="Groups" subtitle="Organise staff into teams so you can send a campaign to the right people.">
    <template #actions>
      <button type="button" class="btn-primary" @click="openAdd"><Plus class="size-4" /> New group</button>
    </template>
  </PageHeader>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div v-for="g in store.groups" :key="g.id" class="card flex flex-col p-5">
      <div class="flex items-start gap-3">
        <span :class="['flex size-10 shrink-0 items-center justify-center rounded-lg text-white', g.color]">
          <UsersRound class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="font-semibold text-ink">{{ g.name }}</h2>
          <p class="text-sm text-slate-500">{{ g.description || 'No description' }}</p>
        </div>
      </div>
      <div class="mt-4 flex -space-x-2">
        <span
          v-for="s in members(g.id).slice(0, 5)"
          :key="s.id"
          :title="s.name"
          class="flex size-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 ring-2 ring-white"
        >
          {{ s.name.split(' ').map((p) => p[0]).join('') }}
        </span>
        <span
          v-if="members(g.id).length > 5"
          class="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600 ring-2 ring-white"
        >
          +{{ members(g.id).length - 5 }}
        </span>
      </div>
      <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
        <p class="text-slate-600">
          <b>{{ members(g.id).length }}</b> members ·
          <b>{{ members(g.id).filter((s) => s.optIn === 'Opted in').length }}</b> opted in
        </p>
        <div class="flex gap-1">
          <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" :aria-label="`Edit ${g.name}`" @click="openEdit(g)">
            <Pencil class="size-4" />
          </button>
          <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" :aria-label="`Delete ${g.name}`" @click="deleting = g">
            <Trash2 class="size-4" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <BaseModal :open="formOpen" :title="editingId ? 'Edit group' : 'New group'" @close="formOpen = false">
    <form id="group-form" class="space-y-4" novalidate @submit.prevent="save">
      <div>
        <label for="group-name" class="label">Group name</label>
        <input id="group-name" v-model="form.name" class="input" placeholder="e.g. Pune Team" />
        <p v-if="error" class="error-text">{{ error }}</p>
      </div>
      <div>
        <label for="group-desc" class="label">Description (optional)</label>
        <input id="group-desc" v-model="form.description" class="input" />
      </div>
      <fieldset>
        <legend class="label">Members</legend>
        <div class="max-h-56 space-y-1 overflow-y-auto rounded-lg p-2 ring-1 ring-slate-200">
          <label v-for="s in store.staff" :key="s.id" class="flex items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
            <input v-model="form.memberIds" type="checkbox" :value="s.id" class="rounded border-slate-300 text-brand-600" />
            <span class="flex-1 text-slate-700">{{ s.name }}</span>
            <span class="text-xs text-slate-400">{{ s.phone }}</span>
          </label>
        </div>
        <p class="mt-1 text-xs text-slate-500">{{ form.memberIds.length }} selected</p>
      </fieldset>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="formOpen = false">Cancel</button>
      <button type="submit" form="group-form" class="btn-primary">{{ editingId ? 'Save changes' : 'Create group' }}</button>
    </template>
  </BaseModal>

  <BaseModal :open="!!deleting" title="Delete group" size="sm" @close="deleting = null">
    <p class="text-sm text-slate-600">
      Delete <b>{{ deleting?.name }}</b>? The staff in it are not deleted, only removed from this group.
    </p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deleting = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDelete">Delete group</button>
    </template>
  </BaseModal>
</template>
