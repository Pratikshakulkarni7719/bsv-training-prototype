<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Search, Pencil, Trash2, BookOpenCheck, FileUp, FileText, Sparkles, Bot, Send, CircleAlert, Loader2 } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { store, nextId, toast, audit, can, stamp, formatStamp, matchFaq } from '@/data/store'

const route = useRoute()
const router = useRouter()
const canEdit = computed(() => can('content'))
const tabs = ['FAQ answers', 'Policy documents', 'Test the bot']
const tab = ref(tabs.includes(route.query.tab) ? route.query.tab : 'FAQ answers')

/* FAQ list ----------------------------------------------------------- */
const search = ref('')
const category = ref('')
const categories = computed(() => [...new Set(store.faqs.map((f) => f.category))].sort())
const list = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.faqs.filter(
    (f) =>
      (!category.value || f.category === category.value) &&
      (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.keywords.some((k) => k.toLowerCase().includes(q)))
  )
})

function toggleActive(f) {
  f.active = !f.active
  audit(`${f.active ? 'Enabled' : 'Disabled'} FAQ "${f.question}"`)
  toast(f.active ? 'The bot will use this answer again.' : 'The bot will stop using this answer.')
}

/* FAQ form ----------------------------------------------------------- */
const formOpen = ref(false)
const editing = ref(null)
const fromQueryId = ref(null)
const form = reactive({ question: '', category: '', keywords: '', answer: '', source: '' })
const errors = reactive({})

function openAdd(prefill = {}) {
  editing.value = null
  Object.assign(form, { question: '', category: '', keywords: '', answer: '', source: '' }, prefill)
  Object.keys(errors).forEach((k) => delete errors[k])
  formOpen.value = true
}

function openEdit(f) {
  editing.value = f
  fromQueryId.value = null
  Object.assign(form, { question: f.question, category: f.category, keywords: f.keywords.join(', '), answer: f.answer, source: f.source })
  Object.keys(errors).forEach((k) => delete errors[k])
  formOpen.value = true
}

// Suggest keywords from the question
function suggestKeywords() {
  const stop = new Set('can could should would what when where which who how does do did the and for with from into about your have this that there their are is am was were i my me to of in on at a an any it be or not need'.split(' '))
  const words = form.question.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !stop.has(w))
  form.keywords = [...new Set(words)].slice(0, 6).join(', ')
}

function save() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const keywords = form.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
  if (form.question.trim().length < 5) errors.question = 'Write the question the way an employee would ask it.'
  else if (store.faqs.some((f) => f.id !== editing.value?.id && f.question.toLowerCase() === form.question.trim().toLowerCase())) errors.question = 'This question already exists.'
  if (!form.category.trim()) errors.category = 'Choose or type a category.'
  if (!keywords.length) errors.keywords = 'Add at least one keyword, separated by commas.'
  if (form.answer.trim().length < 10) errors.answer = 'Write an answer of at least 10 characters.'
  else if (form.answer.length > 1000) errors.answer = 'Keep answers under 1,000 characters so they read well on a phone.'
  if (Object.keys(errors).length) return

  const data = { question: form.question.trim(), category: form.category.trim(), keywords, answer: form.answer.trim(), source: form.source.trim(), updatedAt: stamp() }
  if (editing.value) {
    Object.assign(editing.value, data)
    audit(`Updated FAQ "${data.question}"`)
    toast('Answer updated.')
  } else {
    store.faqs.unshift({ id: nextId(store.faqs), active: true, hits: 0, ...data })
    audit(`Added FAQ "${data.question}"`)
    toast('Answer added. The bot will use it from now on.')
  }
  if (fromQueryId.value) {
    const q = store.queries.find((x) => x.id === fromQueryId.value)
    if (q) q.reviewed = true
    fromQueryId.value = null
  }
  formOpen.value = false
}

const deleting = ref(null)
function confirmDelete() {
  store.faqs = store.faqs.filter((f) => f.id !== deleting.value.id)
  audit(`Deleted FAQ "${deleting.value.question}"`)
  toast('Answer deleted.')
  deleting.value = null
}

// Opened from Employee queries: "Add to knowledge base"
onMounted(() => {
  if (typeof route.query.question === 'string' && canEdit.value) {
    tab.value = 'FAQ answers'
    fromQueryId.value = Number(route.query.queryId) || null
    openAdd({ question: route.query.question })
    suggestKeywords()
    router.replace({ query: {} })
  }
})

/* Policy documents (Phase 2: AI answers) ---------------------------- */
const pdfInput = ref(null)
const pdfError = ref('')
function onPdf(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  pdfError.value = ''
  if (!file.name.toLowerCase().endsWith('.pdf')) return (pdfError.value = 'Upload policy documents as PDF.')
  if (file.size > 20 * 1048576) return (pdfError.value = 'The PDF is larger than 20 MB.')
  if (store.policies.some((p) => p.fileName === file.name)) return (pdfError.value = 'A document with this file name is already uploaded.')
  const doc = { id: nextId(store.policies), title: file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), fileName: file.name, pages: Math.max(1, Math.round(file.size / 60000)), uploadedAt: stamp(), status: 'Processing' }
  store.policies.unshift(doc)
  audit(`Uploaded policy document ${file.name}`)
  toast('Document uploaded. Reading it for the AI bot...')
  setTimeout(() => {
    const d = store.policies.find((p) => p.id === doc.id)
    if (d) d.status = 'Indexed'
  }, 3000)
}

const deletingDoc = ref(null)
function confirmDeleteDoc() {
  store.policies = store.policies.filter((p) => p.id !== deletingDoc.value.id)
  audit(`Deleted policy document ${deletingDoc.value.fileName}`)
  if (store.settings.botMode === 'ai' && !store.policies.some((p) => p.status === 'Indexed')) {
    store.settings.botMode = 'faq'
    toast('Document removed. No documents are left, so the bot switched back to FAQ only.')
  } else toast('Document removed.')
  deletingDoc.value = null
}

function setMode(mode) {
  if (mode === 'ai' && !store.policies.some((p) => p.status === 'Indexed')) return toast('Upload at least one policy document first.', 'error')
  store.settings.botMode = mode
  audit(`Bot answer mode changed to ${mode === 'ai' ? 'AI from policy documents' : 'FAQ only'}`)
  toast(mode === 'ai' ? 'AI answers turned on.' : 'The bot now answers from the FAQ list only.')
}

/* Test the bot ------------------------------------------------------- */
const testText = ref('')
const testResult = ref(null)
function runTest() {
  const text = testText.value.trim()
  if (!text) return
  const faq = matchFaq(text)
  testResult.value = { text, faq, reply: faq ? (store.settings.botMode === 'ai' ? `${faq.answer}\n\nSource: ${faq.source}` : faq.answer) : store.settings.messages.fallback }
}
const examples = ['Can I give a gift to a doctor?', 'can I share patient report on whatsapp', 'What is the deadline for the training?', 'How do I report a concern?']
</script>

<template>
  <PageHeader title="Knowledge base" subtitle="Answers the WhatsApp bot gives when employees ask policy questions. No human replies, so keep this list up to date.">
    <template #actions>
      <button v-if="canEdit && tab === 'FAQ answers'" type="button" class="btn-primary" @click="fromQueryId = null; openAdd()"><Plus class="size-4" /> Add answer</button>
    </template>
  </PageHeader>

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

  <!-- FAQ answers -->
  <div v-if="tab === 'FAQ answers'" class="card">
    <div class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
      <div class="relative flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input v-model="search" type="search" placeholder="Search questions, answers or keywords" aria-label="Search answers" class="input pl-9" />
      </div>
      <select v-model="category" class="input sm:w-56" aria-label="Filter by category">
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c">{{ c }}</option>
      </select>
    </div>
    <ul v-if="list.length" class="divide-y divide-slate-100">
      <li v-for="f in list" :key="f.id" :class="['flex gap-4 px-5 py-4', f.active ? '' : 'opacity-60']">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium text-slate-800">{{ f.question }}</p>
            <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{ f.category }}</span>
            <span v-if="!f.active" class="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Off</span>
          </div>
          <p class="mt-1 text-sm text-slate-600">{{ f.answer }}</p>
          <p class="mt-1 text-xs text-slate-400">
            Keywords: {{ f.keywords.join(', ') }}<template v-if="f.source"> · Source: {{ f.source }}</template> · Used {{ f.hits }} time{{ f.hits === 1 ? '' : 's' }}
          </p>
        </div>
        <div v-if="canEdit" class="flex shrink-0 items-start gap-1">
          <button
            type="button"
            role="switch"
            :aria-checked="f.active"
            :aria-label="`Use this answer: ${f.question}`"
            :class="['relative mt-1 h-5 w-9 rounded-full transition-colors', f.active ? 'bg-brand-600' : 'bg-slate-300']"
            @click="toggleActive(f)"
          >
            <span :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', f.active ? 'left-4.5' : 'left-0.5']" />
          </button>
          <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" :aria-label="`Edit ${f.question}`" @click="openEdit(f)"><Pencil class="size-4" /></button>
          <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" :aria-label="`Delete ${f.question}`" @click="deleting = f"><Trash2 class="size-4" /></button>
        </div>
      </li>
    </ul>
    <EmptyState v-else-if="store.faqs.length" :icon="Search" title="No answers match" text="Try a different search." />
    <EmptyState v-else :icon="BookOpenCheck" title="No answers yet" text="Without answers the bot replies to every question with the fallback message.">
      <button v-if="canEdit" type="button" class="btn-primary" @click="openAdd()"><Plus class="size-4" /> Add answer</button>
    </EmptyState>
  </div>

  <!-- Policy documents -->
  <div v-else-if="tab === 'Policy documents'" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card lg:col-span-2">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 class="font-semibold text-ink">Policy documents</h2>
          <p class="text-sm text-slate-500">The AI bot reads these to answer questions that aren't in the FAQ list.</p>
        </div>
        <template v-if="canEdit">
          <input ref="pdfInput" type="file" accept="application/pdf,.pdf" class="sr-only" @change="onPdf" />
          <button type="button" class="btn-secondary" @click="pdfInput.click()"><FileUp class="size-4" /> Upload PDF</button>
        </template>
      </div>
      <p v-if="pdfError" class="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><CircleAlert class="mt-0.5 size-4 shrink-0" /> {{ pdfError }}</p>
      <ul v-if="store.policies.length" class="divide-y divide-slate-100">
        <li v-for="p in store.policies" :key="p.id" class="flex items-center gap-3 px-5 py-3">
          <FileText class="size-8 shrink-0 text-red-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-800">{{ p.title }}</p>
            <p class="text-xs text-slate-500">{{ p.fileName }} · {{ p.pages }} pages · {{ formatStamp(p.uploadedAt, false) }}</p>
          </div>
          <span v-if="p.status === 'Processing'" class="inline-flex items-center gap-1 text-xs text-sky-700"><Loader2 class="size-3.5 animate-spin" /> Reading</span>
          <StatusBadge v-else :status="p.status" />
          <button v-if="canEdit" type="button" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" :aria-label="`Delete ${p.title}`" @click="deletingDoc = p"><Trash2 class="size-4" /></button>
        </li>
      </ul>
      <EmptyState v-else :icon="FileText" title="No documents" text="Upload BSV policy PDFs to let the AI bot answer from them." />
    </div>

    <div class="card self-start p-5">
      <h2 class="flex items-center gap-2 font-semibold text-ink"><Sparkles class="size-5 text-violet-600" /> How the bot answers</h2>
      <div class="mt-4 space-y-2">
        <label :class="['flex cursor-pointer gap-3 rounded-lg p-3 ring-1', store.settings.botMode === 'faq' ? 'bg-brand-50 ring-brand-500' : 'ring-slate-200']">
          <input type="radio" name="mode" :checked="store.settings.botMode === 'faq'" :disabled="!canEdit" class="mt-1 text-brand-600" @change="setMode('faq')" />
          <span class="text-sm"><b class="block text-slate-800">FAQ only (Phase 1)</b><span class="text-slate-500">Answers only questions that match the FAQ list. Predictable and fully controlled.</span></span>
        </label>
        <label :class="['flex cursor-pointer gap-3 rounded-lg p-3 ring-1', store.settings.botMode === 'ai' ? 'bg-violet-50 ring-violet-500' : 'ring-slate-200']">
          <input type="radio" name="mode" :checked="store.settings.botMode === 'ai'" :disabled="!canEdit" class="mt-1 text-violet-600" @change="setMode('ai')" />
          <span class="text-sm"><b class="block text-slate-800">AI from policy documents (Phase 2)</b><span class="text-slate-500">Understands differently worded questions and quotes the policy source.</span></span>
        </label>
      </div>
      <p class="mt-3 text-xs text-slate-500">In both modes, if the bot isn't confident it replies: "{{ store.settings.messages.fallback }}"</p>
    </div>
  </div>

  <!-- Test the bot -->
  <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="card p-5">
      <h2 class="flex items-center gap-2 font-semibold text-ink"><Bot class="size-5 text-brand-600" /> Ask a test question</h2>
      <p class="mt-1 text-sm text-slate-500">Nothing is logged or sent. Use this to check an answer before employees ask.</p>
      <form class="mt-4 flex gap-2" @submit.prevent="runTest">
        <label for="test-q" class="sr-only">Test question</label>
        <input id="test-q" v-model="testText" class="input" placeholder="Type a question like an employee would" />
        <button type="submit" class="btn-primary" :disabled="!testText.trim()" aria-label="Ask"><Send class="size-4" /></button>
      </form>
      <div class="mt-3 flex flex-wrap gap-2">
        <button v-for="e in examples" :key="e" type="button" class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200" @click="testText = e; runTest()">{{ e }}</button>
      </div>
    </div>
    <div class="card p-5">
      <h2 class="font-semibold text-ink">Result</h2>
      <div v-if="testResult" class="mt-4 space-y-3 rounded-lg bg-wa-chat p-4">
        <p class="ml-auto w-fit max-w-[85%] rounded-lg rounded-tr-none bg-wa-bubble px-3 py-2 text-sm">{{ testResult.text }}</p>
        <p class="w-fit max-w-[85%] whitespace-pre-line rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm">{{ testResult.reply }}</p>
      </div>
      <p v-if="testResult?.faq" class="mt-3 text-sm text-emerald-700">Matched: "{{ testResult.faq.question }}"</p>
      <div v-else-if="testResult" class="mt-3 text-sm text-amber-700">
        No confident match, so the fallback message is sent.
        <button v-if="canEdit" type="button" class="ml-1 font-medium underline" @click="tab = 'FAQ answers'; fromQueryId = null; openAdd({ question: testResult.text }); suggestKeywords()">Add an answer for this</button>
      </div>
      <p v-if="!testResult" class="mt-4 text-sm text-slate-500">Ask a question to see what the bot would reply.</p>
    </div>
  </div>

  <!-- FAQ form -->
  <BaseModal :open="formOpen" :title="editing ? 'Edit answer' : 'Add answer'" size="lg" @close="formOpen = false">
    <form id="faq-form" class="space-y-4" novalidate @submit.prevent="save">
      <div>
        <label for="faq-q" class="label">Question</label>
        <input id="faq-q" v-model="form.question" class="input" placeholder="Can I give a gift to a doctor?" />
        <p v-if="errors.question" class="error-text">{{ errors.question }}</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="faq-cat" class="label">Category</label>
          <input id="faq-cat" v-model="form.category" class="input" list="faq-categories" />
          <datalist id="faq-categories"><option v-for="c in categories" :key="c" :value="c" /></datalist>
          <p v-if="errors.category" class="error-text">{{ errors.category }}</p>
        </div>
        <div>
          <label for="faq-src" class="label">Policy source (optional)</label>
          <input id="faq-src" v-model="form.source" class="input" placeholder="Anti-Bribery Policy, section 4" />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label for="faq-kw" class="label">Keywords</label>
          <button type="button" class="mb-1.5 text-xs font-medium text-brand-700 hover:underline" @click="suggestKeywords">Suggest from question</button>
        </div>
        <input id="faq-kw" v-model="form.keywords" class="input" placeholder="gift, doctor, present" />
        <p v-if="errors.keywords" class="error-text">{{ errors.keywords }}</p>
        <p v-else class="mt-1 text-xs text-slate-500">Words employees are likely to use. Separate with commas. Phrases like "personal email" work too.</p>
      </div>
      <div>
        <label for="faq-a" class="label">Answer</label>
        <textarea id="faq-a" v-model="form.answer" rows="5" class="input" maxlength="1000" />
        <div class="mt-1 flex justify-between text-xs text-slate-500">
          <span>Short and clear. It is read on a phone.</span>
          <span>{{ form.answer.length }}/1000</span>
        </div>
        <p v-if="errors.answer" class="error-text">{{ errors.answer }}</p>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="formOpen = false">Cancel</button>
      <button type="submit" form="faq-form" class="btn-primary">{{ editing ? 'Save changes' : 'Add answer' }}</button>
    </template>
  </BaseModal>

  <BaseModal :open="!!deleting" title="Delete answer" size="sm" @close="deleting = null">
    <p class="text-sm text-slate-600">Delete "<b>{{ deleting?.question }}</b>"? The bot will no longer use it. To pause it instead, switch it off.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deleting = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
    </template>
  </BaseModal>

  <BaseModal :open="!!deletingDoc" title="Remove document" size="sm" @close="deletingDoc = null">
    <p class="text-sm text-slate-600">Remove <b>{{ deletingDoc?.fileName }}</b>? The AI bot will stop using it.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deletingDoc = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDeleteDoc">Remove</button>
    </template>
  </BaseModal>
</template>
