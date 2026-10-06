<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, X, Loader2, TriangleAlert } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import WhatsAppPreview from '@/components/WhatsAppPreview.vue'
import EmptyState from '@/components/EmptyState.vue'
import { store, nextId, toast, audit, stamp, LANGUAGES, TEMPLATE_TYPES } from '@/data/store'

const route = useRoute()
const router = useRouter()
const editing = computed(() => (route.params.id ? store.templates.find((t) => t.id === Number(route.params.id)) : null))
const notFound = computed(() => route.params.id && !editing.value)

const presets = {
  quiz: { body: 'Hi {{1}}, quick compliance check:\n\n{{2}}\n\nTap True or False.', buttons: ['True', 'False'] },
  video: { body: 'Hi {{1}}, watch this short scenario.\n\n{{2}}', buttons: ['Correct action', 'Wrong action'] },
  nugget: { body: 'Hi {{1}}, here is your compliance nugget:\n\n{{2}}', buttons: ['Understood', 'I have a question'] },
  announcement: { body: 'Hi {{1}}, {{2}}', buttons: ['Yes, completed', 'Not yet'] },
  consent: { body: 'Hi {{1}}, BSV Compliance will send you short compliance updates on WhatsApp. Tap Agree to continue or Stop to opt out.', buttons: ['Agree', 'Stop'] }
}

const form = reactive({ name: 'compliance_quiz_v2', type: 'quiz', category: 'Utility', language: 'English', body: presets.quiz.body, buttons: [...presets.quiz.buttons] })
const errors = reactive({ name: '', body: '', buttons: '' })
const submitting = ref(false)

if (editing.value) {
  const t = editing.value
  Object.assign(form, { name: t.name, type: t.type, category: t.category, language: t.language, body: t.body, buttons: [...t.buttons] })
}

const header = computed(() => (form.type === 'video' ? 'Video' : 'None'))

// Switching type loads a sensible starting message (only for new templates)
watch(
  () => form.type,
  (type) => {
    if (editing.value) return
    form.body = presets[type].body
    form.buttons = [...presets[type].buttons]
  }
)

function addButton() {
  if (form.buttons.length < 3) form.buttons.push('')
}

function validate() {
  errors.name = /^[a-z0-9_]{3,60}$/.test(form.name) ? '' : 'Use 3–60 lowercase letters, numbers and underscores.'
  if (!errors.name && store.templates.some((t) => t.id !== editing.value?.id && t.name === form.name && t.language === form.language)) {
    errors.name = 'A template with this name and language already exists.'
  }
  errors.body = ''
  if (form.body.trim().length < 10) errors.body = 'Write a message of at least 10 characters.'
  else if (form.body.length > 1024) errors.body = 'WhatsApp allows up to 1,024 characters.'
  else if (form.type !== 'consent' && !form.body.includes('{{2}}')) errors.body = 'Include {{2}} where the campaign content goes.'
  else if (/\{\{(?![12]\}\})/.test(form.body)) errors.body = 'Only {{1}} (first name) and {{2}} (content) are supported.'
  const labels = form.buttons.map((b) => b.trim())
  errors.buttons = ''
  if (!labels.length) errors.buttons = 'Add at least one button so employees can respond with one tap.'
  else if (labels.some((b) => !b)) errors.buttons = 'Fill in or remove empty buttons.'
  else if (labels.some((b) => b.length > 20)) errors.buttons = 'Button text can be up to 20 characters.'
  else if (new Set(labels.map((b) => b.toLowerCase())).size !== labels.length) errors.buttons = 'Each button must be different.'
  return !errors.name && !errors.body && !errors.buttons
}

function submit() {
  if (!validate()) return
  submitting.value = true
  setTimeout(() => {
    const data = { ...form, header: header.value, buttons: form.buttons.map((b) => b.trim()), status: 'Pending', rejectReason: '', updatedAt: stamp() }
    if (editing.value) {
      Object.assign(editing.value, data)
      audit(`Edited template ${form.name} and resubmitted it for approval`)
      toast('Changes submitted. The template is pending approval again.')
    } else {
      store.templates.unshift({ id: nextId(store.templates), ...data })
      audit(`Submitted template ${form.name} for approval`)
      toast('Template submitted to Meta for approval.')
    }
    router.push({ name: 'templates' })
  }, 600)
}
</script>

<template>
  <div v-if="notFound" class="card">
    <EmptyState title="Template not found">
      <router-link :to="{ name: 'templates' }" class="btn-primary">Back to templates</router-link>
    </EmptyState>
  </div>

  <template v-else>
    <PageHeader :title="editing ? `Edit ${editing.name}` : 'New template'" subtitle="Submitted to Meta for approval before it can be used.">
      <template #back>
        <router-link :to="{ name: 'templates' }" class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft class="size-4" /> Templates</router-link>
      </template>
    </PageHeader>

    <p v-if="editing?.status === 'Rejected'" class="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
      <TriangleAlert class="mt-0.5 size-4 shrink-0" /> Rejected by Meta: {{ editing.rejectReason }}
    </p>
    <p v-else-if="editing?.status === 'Approved'" class="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      <TriangleAlert class="mt-0.5 size-4 shrink-0" /> Saving changes sends this template for approval again. Campaigns can't use it until it's approved.
    </p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <form class="card space-y-5 p-6" novalidate @submit.prevent="submit">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label for="tpl-name" class="label">Template name</label>
            <input id="tpl-name" v-model.trim="form.name" class="input font-mono" />
            <p v-if="errors.name" class="error-text">{{ errors.name }}</p>
          </div>
          <div>
            <label for="tpl-type" class="label">Used for</label>
            <select id="tpl-type" v-model="form.type" class="input" :disabled="!!editing">
              <option v-for="(t, key) in TEMPLATE_TYPES" :key="key" :value="key">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label for="tpl-lang" class="label">Language</label>
            <select id="tpl-lang" v-model="form.language" class="input">
              <option v-for="l in LANGUAGES" :key="l">{{ l }}</option>
            </select>
          </div>
          <div>
            <label for="tpl-cat" class="label">Category</label>
            <select id="tpl-cat" v-model="form.category" class="input">
              <option>Utility</option>
              <option>Marketing</option>
            </select>
          </div>
          <div>
            <p class="label">Header</p>
            <p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">{{ header === 'Video' ? 'Video (chosen per campaign)' : 'None' }}</p>
          </div>
        </div>
        <p v-if="form.category === 'Marketing'" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Marketing messages cost more and are reviewed more strictly. Compliance content is Utility.
        </p>

        <div>
          <label for="tpl-body" class="label">Message</label>
          <textarea id="tpl-body" v-model="form.body" rows="6" class="input" maxlength="1024" />
          <div class="mt-1 flex justify-between text-xs text-slate-500">
            <span><code v-pre>{{1}}</code> = first name · <code v-pre>{{2}}</code> = campaign content</span>
            <span>{{ form.body.length }}/1024</span>
          </div>
          <p v-if="errors.body" class="error-text">{{ errors.body }}</p>
        </div>

        <div>
          <p class="label">Quick-reply buttons (1 to 3)</p>
          <div class="space-y-2">
            <div v-for="(b, i) in form.buttons" :key="i" class="flex gap-2">
              <input v-model="form.buttons[i]" class="input" :aria-label="`Button ${i + 1}`" maxlength="20" />
              <button type="button" class="rounded-lg px-2 text-slate-400 ring-1 ring-slate-200 hover:text-red-600" :aria-label="`Remove button ${i + 1}`" @click="form.buttons.splice(i, 1)">
                <X class="size-4" />
              </button>
            </div>
          </div>
          <p v-if="errors.buttons" class="error-text">{{ errors.buttons }}</p>
          <button v-if="form.buttons.length < 3" type="button" class="btn-secondary mt-2 px-3 py-1.5" @click="addButton"><Plus class="size-4" /> Add button</button>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-200 pt-5">
          <router-link :to="{ name: 'templates' }" class="btn-secondary">Cancel</router-link>
          <button type="submit" class="btn-primary" :disabled="submitting">
            <Loader2 v-if="submitting" class="size-4 animate-spin" /> {{ editing ? 'Save and resubmit' : 'Submit for approval' }}
          </button>
        </div>
      </form>

      <div class="lg:sticky lg:top-8 lg:self-start">
        <p class="mb-3 text-center text-sm font-medium text-slate-500">Live preview</p>
        <WhatsAppPreview
          :header="header"
          :body="form.body"
          :buttons="form.buttons.filter((b) => b.trim())"
          content="Confidential information can be discussed in a public place if you speak quietly."
          video-title="Gift offered to a doctor"
        />
      </div>
    </div>
  </template>
</template>
