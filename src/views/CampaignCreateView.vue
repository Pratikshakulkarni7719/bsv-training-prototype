<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Check, Play, Loader2, TriangleAlert, CircleCheck, Users, Info, ListChecks, Clapperboard, Lightbulb, Megaphone } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import WhatsAppPreview from '@/components/WhatsAppPreview.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  store, nextId, toast, audit, stamp, currentUser, formatStamp, CAMPAIGN_TYPES, defaultReplies,
  audienceSummary, activeEmployees, campaignProblems, sendCampaign, inQuietHours, templateFor, videoFor
} from '@/data/store'

const route = useRoute()
const router = useRouter()
const typeIcons = { quiz: ListChecks, video: Clapperboard, nugget: Lightbulb, announcement: Megaphone }
const steps = ['Type', 'Content', 'Audience', 'Schedule & review']
const step = ref(0)
const busy = ref(false)

const existing = computed(() => (route.params.id ? store.campaigns.find((c) => c.id === Number(route.params.id)) : null))
const locked = computed(() => existing.value && existing.value.status === 'Sent')

function defaultDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const form = reactive({
  type: 'quiz',
  name: '',
  theme: '',
  templateId: null,
  videoId: null,
  content: '',
  correctOption: null,
  replies: {},
  // groupIds: [], // Phase 2: groups (disabled)
  when: 'now',
  date: defaultDate(),
  time: '10:00',
  repeat: 'none',
  reminderEnabled: true,
  reminderDays: 2
})
const errors = reactive({})

if (existing.value && !locked.value) {
  const c = existing.value
  Object.assign(form, {
    type: c.type,
    name: c.name,
    theme: c.theme,
    templateId: c.templateId,
    videoId: c.videoId,
    content: c.content,
    correctOption: c.correctOption,
    replies: { ...c.replies },
    when: c.status === 'Scheduled' ? 'later' : 'now',
    date: c.scheduledAt ? c.scheduledAt.slice(0, 10) : defaultDate(),
    time: c.scheduledAt ? c.scheduledAt.slice(11, 16) : '10:00',
    repeat: c.repeat,
    reminderEnabled: c.reminder?.enabled ?? false,
    reminderDays: c.reminder?.afterDays ?? 2
  })
}

const typeMeta = computed(() => CAMPAIGN_TYPES[form.type])
const templates = computed(() => store.templates.filter((t) => t.type === form.type && t.status === 'Approved'))
const otherTemplates = computed(() => store.templates.filter((t) => t.type === form.type && t.status !== 'Approved'))
const template = computed(() => templateFor(form.templateId))
const video = computed(() => videoFor(form.videoId))
const buttons = computed(() => template.value?.buttons ?? [])
const themes = computed(() => [...new Set([...store.faqs.map((f) => f.category), ...store.campaigns.map((c) => c.theme)].filter(Boolean))].sort())

// Pick the first approved template for the type, and keep replies in step with its buttons
watch(
  () => form.type,
  (type, old) => {
    if (old === undefined) return
    form.templateId = templates.value[0]?.id ?? null
    if (type !== 'video') form.videoId = null
  }
)
watch(
  () => form.templateId,
  (id, old) => {
    if (old === undefined && existing.value) return
    form.correctOption = typeMeta.value.graded ? buttons.value[1] ?? buttons.value[0] ?? null : null
    form.replies = defaultReplies(form.type, buttons.value, form.correctOption)
  },
  { immediate: !existing.value }
)
if (!existing.value && !form.templateId) form.templateId = templates.value[0]?.id ?? null

function setCorrect(option) {
  form.correctOption = option
  form.replies = defaultReplies(form.type, buttons.value, option)
}

const audience = computed(audienceSummary)
const languageMismatch = computed(() => (template.value ? activeEmployees().filter((e) => e.language !== template.value.language).length : 0))

const scheduledAt = computed(() => `${form.date} ${form.time}`)

function validate(upTo = step.value) {
  Object.keys(errors).forEach((k) => delete errors[k])
  if (upTo >= 0 && !form.name.trim()) errors.name = 'Give the campaign a name.'
  else if (upTo >= 0 && store.campaigns.some((c) => c.id !== existing.value?.id && c.name.toLowerCase() === form.name.trim().toLowerCase())) errors.name = 'Another campaign already has this name.'
  if (upTo >= 1) {
    if (!form.templateId) errors.templateId = 'Choose an approved template.'
    if (form.type === 'video' && !form.videoId) errors.videoId = 'Choose a video.'
    if (!form.content.trim()) errors.content = 'Write the message content.'
    else if (form.content.length > 700) errors.content = 'Keep it under 700 characters so it reads well on a phone.'
    if (typeMeta.value.graded && !form.correctOption) errors.correctOption = 'Choose the correct answer.'
    if (buttons.value.some((b) => !form.replies[b]?.trim())) errors.replies = 'Write a reply for every button.'
  }
  if (upTo >= 3 && form.when === 'later') {
    if (!form.date || !form.time) errors.schedule = 'Choose a date and time.'
    else if (new Date(`${form.date}T${form.time}`) <= new Date(Date.now() + 60000)) errors.schedule = 'Choose a time in the future.'
  }
  if (upTo >= 3 && form.reminderEnabled && !(form.reminderDays >= 1 && form.reminderDays <= 14)) errors.reminder = 'Reminder must be 1 to 14 days after sending.'
  return Object.keys(errors).length === 0
}

function next() {
  if (validate()) step.value++
}

function goTo(i) {
  if (i < step.value) step.value = i
  else if (validate(i - 1)) step.value = i
}

function buildFields() {
  return {
    name: form.name.trim(),
    type: form.type,
    theme: form.theme.trim(),
    templateId: form.templateId,
    videoId: form.type === 'video' ? form.videoId : null,
    content: form.content.trim(),
    correctOption: typeMeta.value.graded ? form.correctOption : null,
    replies: { ...form.replies },
    audience: 'all',
    // groupIds: [...form.groupIds], // Phase 2: groups (disabled)
    repeat: form.when === 'later' ? form.repeat : 'none',
    reminder: { enabled: form.reminderEnabled, afterDays: Number(form.reminderDays) },
    lastError: ''
  }
}

function upsert(status, extra = {}) {
  if (existing.value) {
    Object.assign(existing.value, buildFields(), { status }, extra)
    return existing.value
  }
  const c = {
    id: nextId(store.campaigns),
    ...buildFields(),
    status,
    scheduledAt: null,
    sentAt: null,
    reminderLog: [],
    recipients: [],
    createdBy: currentUser.value?.name,
    createdAt: stamp(),
    ...extra
  }
  store.campaigns.unshift(c)
  return c
}

function saveDraft() {
  if (!form.name.trim()) {
    step.value = 0
    errors.name = 'Give the campaign a name before saving.'
    return
  }
  const c = upsert('Draft', { scheduledAt: null })
  audit(`Saved campaign "${c.name}" as draft`)
  toast('Saved as a draft.')
  router.push({ name: 'campaignDetail', params: { id: c.id } })
}

const problems = computed(() => {
  if (step.value < 3) return []
  return campaignProblems({ ...buildFields(), templateId: form.templateId })
})

function finish() {
  if (!validate(3)) return
  if (form.when === 'later') {
    const c = upsert('Scheduled', { scheduledAt: scheduledAt.value })
    audit(`Scheduled campaign "${c.name}" for ${scheduledAt.value}`)
    toast(`Scheduled for ${formatStamp(scheduledAt.value)}.`)
    router.push({ name: 'campaignDetail', params: { id: c.id } })
    return
  }
  if (problems.value.length) return
  busy.value = true
  setTimeout(() => {
    const c = upsert('Draft')
    const result = sendCampaign(c)
    busy.value = false
    if (!result.ok) {
      toast(result.problems[0], 'error')
      return
    }
    toast(`Sending to ${result.stats.sent} employees on WhatsApp.`)
    router.push({ name: 'campaignDetail', params: { id: c.id } })
  }, 800)
}

const previewTap = ref('')
const contentPlaceholders = {
  quiz: 'e.g. Confidential information can be discussed in a public place if you speak quietly.',
  video: 'e.g. Did the representative act correctly in this video?',
  nugget: 'e.g. Before meeting an external vendor, always check that they are on the approved vendor list.',
  announcement: 'e.g. the new Anti-Bribery training module is now live on the BSV Learning portal. Have you completed it?'
}
</script>

<template>
  <div v-if="route.params.id && !existing" class="card">
    <EmptyState title="Campaign not found">
      <router-link :to="{ name: 'campaigns' }" class="btn-primary">Back to campaigns</router-link>
    </EmptyState>
  </div>

  <div v-else-if="locked" class="card">
    <EmptyState title="This campaign was already sent" text="Sent campaigns can't be changed. Duplicate it to send a new version.">
      <router-link :to="{ name: 'campaignDetail', params: { id: existing.id } }" class="btn-primary">Open campaign</router-link>
    </EmptyState>
  </div>

  <template v-else>
    <PageHeader :title="existing ? `Edit: ${existing.name}` : 'New campaign'">
      <template #back>
        <router-link :to="existing ? { name: 'campaignDetail', params: { id: existing.id } } : { name: 'campaigns' }" class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft class="size-4" /> {{ existing ? 'Back to campaign' : 'Campaigns' }}
        </router-link>
      </template>
      <template #actions>
        <button type="button" class="btn-secondary" @click="saveDraft">Save as draft</button>
      </template>
    </PageHeader>

    <!-- Stepper -->
    <ol class="mb-6 flex flex-wrap gap-2">
      <li v-for="(s, i) in steps" :key="s" class="flex items-center gap-2">
        <button type="button" class="flex items-center gap-2" @click="goTo(i)">
          <span :class="['flex size-7 items-center justify-center rounded-full text-xs font-semibold', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-ink text-white' : 'bg-slate-200 text-slate-600']">
            <Check v-if="i < step" class="size-4" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span :class="['text-sm font-medium', i === step ? 'text-ink' : 'text-slate-500']">{{ s }}</span>
        </button>
        <span v-if="i < steps.length - 1" class="mx-1 hidden h-px w-8 bg-slate-300 sm:block" />
      </li>
    </ol>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div class="card p-6">
        <!-- Step 1: type -->
        <div v-if="step === 0" class="space-y-5">
          <fieldset>
            <legend class="label">What do you want to send?</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                v-for="(t, key) in CAMPAIGN_TYPES"
                :key="key"
                :class="['flex cursor-pointer gap-3 rounded-lg p-3 ring-1', form.type === key ? 'bg-brand-50 ring-brand-500' : 'ring-slate-200 hover:bg-slate-50']"
              >
                <input v-model="form.type" type="radio" :value="key" class="sr-only" />
                <component :is="typeIcons[key]" class="mt-0.5 size-5 shrink-0 text-brand-600" />
                <span>
                  <span class="block text-sm font-semibold text-slate-800">{{ t.label }}</span>
                  <span class="text-xs text-slate-500">{{ t.hint }}</span>
                </span>
              </label>
            </div>
          </fieldset>
          <div>
            <label for="c-name" class="label">Campaign name</label>
            <input id="c-name" v-model="form.name" class="input" maxlength="80" placeholder="e.g. Privacy basics: public places" />
            <p v-if="errors.name" class="error-text">{{ errors.name }}</p>
            <p v-else class="mt-1 text-xs text-slate-500">Only admins see this name. Employees see the message.</p>
          </div>
          <div>
            <label for="c-theme" class="label">Theme (optional)</label>
            <input id="c-theme" v-model="form.theme" class="input" list="themes" placeholder="e.g. Data privacy" />
            <datalist id="themes"><option v-for="t in themes" :key="t" :value="t" /></datalist>
            <p class="mt-1 text-xs text-slate-500">Used in reports to see which topics are understood best.</p>
          </div>
        </div>

        <!-- Step 2: content -->
        <div v-else-if="step === 1" class="space-y-5">
          <div>
            <label for="c-template" class="label">Message template</label>
            <select id="c-template" v-model="form.templateId" class="input">
              <option :value="null" disabled>Choose an approved template</option>
              <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }} ({{ t.language }})</option>
            </select>
            <p v-if="errors.templateId" class="error-text">{{ errors.templateId }}</p>
            <p v-if="!templates.length" class="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              No approved {{ typeMeta.label.toLowerCase() }} template yet.
              <router-link :to="{ name: 'templateCreate' }" class="font-semibold underline">Create one</router-link>
              <template v-if="otherTemplates.length"> or wait for {{ otherTemplates.map((t) => t.name).join(', ') }} to be approved.</template>
            </p>
          </div>

          <fieldset v-if="form.type === 'video'">
            <legend class="label">Video</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                v-for="v in store.videos"
                :key="v.id"
                :class="['flex cursor-pointer items-center gap-3 rounded-lg p-2 ring-1', form.videoId === v.id ? 'bg-brand-50 ring-brand-500' : 'ring-slate-200 hover:bg-slate-50']"
              >
                <input v-model="form.videoId" type="radio" :value="v.id" class="sr-only" />
                <span :class="['flex h-12 w-16 shrink-0 items-center justify-center rounded bg-linear-to-br', v.thumb]"><Play class="size-4 fill-white text-white" /></span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-slate-800">{{ v.title }}</span>
                  <span class="text-xs text-slate-500">{{ v.duration }} · {{ v.sizeMb }} MB</span>
                </span>
              </label>
            </div>
            <p v-if="!store.videos.length" class="text-sm text-slate-500">No videos yet. <router-link :to="{ name: 'videos' }" class="font-medium text-brand-700 underline">Upload one</router-link>.</p>
            <p v-if="errors.videoId" class="error-text">{{ errors.videoId }}</p>
          </fieldset>

          <div>
            <label for="c-content" class="label">{{ form.type === 'quiz' ? 'Statement' : form.type === 'video' ? 'Question about the video' : 'Message' }}</label>
            <textarea id="c-content" v-model="form.content" rows="3" class="input" maxlength="700" :placeholder="contentPlaceholders[form.type]" />
            <div class="mt-1 flex justify-between text-xs text-slate-500">
              <span>Fills <code v-pre>{{2}}</code> in the template.</span>
              <span>{{ form.content.length }}/700</span>
            </div>
            <p v-if="errors.content" class="error-text">{{ errors.content }}</p>
          </div>

          <fieldset v-if="typeMeta.graded && buttons.length">
            <legend class="label">Correct answer</legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="b in buttons"
                :key="b"
                type="button"
                :class="['inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1', form.correctOption === b ? 'bg-emerald-50 text-emerald-800 ring-emerald-500' : 'text-slate-700 ring-slate-300 hover:bg-slate-50']"
                @click="setCorrect(b)"
              >
                <CircleCheck v-if="form.correctOption === b" class="size-4" /> {{ b }}
              </button>
            </div>
            <p v-if="errors.correctOption" class="error-text">{{ errors.correctOption }}</p>
          </fieldset>

          <fieldset v-if="buttons.length">
            <legend class="label">Bot reply after each button</legend>
            <div class="space-y-3">
              <div v-for="b in buttons" :key="b">
                <label :for="`reply-${b}`" class="mb-1 block text-xs font-medium text-slate-600">
                  When they tap "{{ b }}"
                  <span v-if="typeMeta.graded && form.correctOption" :class="b === form.correctOption ? 'text-emerald-700' : 'text-orange-600'">({{ b === form.correctOption ? 'correct' : 'wrong' }})</span>
                </label>
                <input :id="`reply-${b}`" v-model="form.replies[b]" class="input" maxlength="300" @focus="previewTap = b" />
              </div>
            </div>
            <p v-if="errors.replies" class="error-text">{{ errors.replies }}</p>
          </fieldset>
        </div>

        <!-- Step 3: audience -->
        <div v-else-if="step === 2" class="space-y-4">
          <div class="flex items-start gap-3 rounded-lg bg-brand-50 p-4 ring-1 ring-brand-200">
            <Users class="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div class="text-sm">
              <p class="font-semibold text-slate-800">All active employees</p>
              <p class="mt-0.5 text-slate-600">Phase 1 sends every campaign to the whole field force, one personal message each. No WhatsApp groups are used.</p>
            </div>
          </div>
          <dl class="divide-y divide-slate-100 rounded-lg text-sm ring-1 ring-slate-200">
            <div class="flex justify-between px-4 py-3"><dt class="text-slate-600">Active employees</dt><dd class="font-semibold text-slate-800">{{ audience.active }}</dd></div>
            <div class="flex justify-between px-4 py-3"><dt class="text-slate-600">Will receive it</dt><dd class="font-semibold text-emerald-700">{{ audience.reachable }}</dd></div>
            <div v-for="(n, reason) in audience.blocked" :key="reason" class="flex justify-between px-4 py-3">
              <dt class="text-slate-600">Can't receive: {{ reason }}</dt>
              <dd class="font-semibold text-red-600">{{ n }}</dd>
            </div>
          </dl>
          <p v-if="audience.blocked['No consent yet']" class="flex items-start gap-2 text-sm text-amber-800">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" />
            <span>{{ audience.blocked['No consent yet'] }} employees haven't tapped Agree yet. <router-link :to="{ name: 'employees', query: { consent: 'Pending' } }" class="font-medium underline">Resend consent requests</router-link>.</span>
          </p>
          <p v-if="languageMismatch" class="flex items-start gap-2 text-sm text-sky-800">
            <Info class="mt-0.5 size-4 shrink-0" />
            {{ languageMismatch }} employees prefer a language other than {{ template?.language }}. They will get the {{ template?.language }} version.
          </p>

          <!-- Phase 2: groups (team / business-unit targeting). Disabled for Phase 1.
          <fieldset>
            <legend class="label">Send to groups</legend>
            <div class="space-y-2">
              <label v-for="g in store.groups" :key="g.id" class="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-50">
                <input v-model="form.groupIds" type="checkbox" :value="g.id" class="rounded border-slate-300 text-brand-600" />
                <span class="flex-1 text-sm font-medium text-slate-700">{{ g.name }}</span>
                <span class="text-xs text-slate-500">{{ store.employees.filter((s) => s.groupIds.includes(g.id)).length }} staff</span>
              </label>
            </div>
            <p v-if="errors.groupIds" class="error-text">{{ errors.groupIds }}</p>
          </fieldset>
          -->
        </div>

        <!-- Step 4: schedule & review -->
        <div v-else class="space-y-5">
          <fieldset>
            <legend class="label">When</legend>
            <div class="flex flex-wrap gap-4 text-sm text-slate-700">
              <label class="flex items-center gap-2"><input v-model="form.when" type="radio" value="now" class="text-brand-600" /> Send now</label>
              <label class="flex items-center gap-2"><input v-model="form.when" type="radio" value="later" class="text-brand-600" /> Schedule</label>
            </div>
          </fieldset>
          <div v-if="form.when === 'later'" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label for="c-date" class="label">Date</label>
              <input id="c-date" v-model="form.date" type="date" class="input" :min="new Date().toISOString().slice(0, 10)" />
            </div>
            <div>
              <label for="c-time" class="label">Time</label>
              <input id="c-time" v-model="form.time" type="time" class="input" />
            </div>
            <div>
              <label for="c-repeat" class="label">Repeat</label>
              <select id="c-repeat" v-model="form.repeat" class="input">
                <option value="none">Don't repeat</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
            <p v-if="errors.schedule" class="error-text sm:col-span-3">{{ errors.schedule }}</p>
            <p v-else-if="inQuietHours(scheduledAt)" class="flex items-start gap-2 text-sm text-amber-800 sm:col-span-3">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              This is inside quiet hours ({{ store.settings.quietHours.from }}–{{ store.settings.quietHours.to }}). Employees may ignore late messages.
            </p>
          </div>
          <p v-else-if="inQuietHours(stamp())" class="flex items-start gap-2 text-sm text-amber-800">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" /> It's quiet hours now ({{ store.settings.quietHours.from }}–{{ store.settings.quietHours.to }}). Consider scheduling for the morning.
          </p>

          <div class="rounded-lg p-4 ring-1 ring-slate-200">
            <label class="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input v-model="form.reminderEnabled" type="checkbox" class="rounded border-slate-300 text-brand-600" />
              Remind employees who haven't responded
            </label>
            <div v-if="form.reminderEnabled" class="mt-3 flex items-center gap-2 text-sm text-slate-600">
              after
              <input v-model.number="form.reminderDays" type="number" min="1" max="14" class="input w-20" aria-label="Days before reminder" />
              day(s), once
            </div>
            <p v-if="errors.reminder" class="error-text">{{ errors.reminder }}</p>
          </div>

          <dl class="divide-y divide-slate-100 rounded-lg text-sm ring-1 ring-slate-200">
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">Campaign</dt><dd class="text-right font-medium text-slate-800">{{ form.name }}</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">Type</dt><dd class="font-medium text-slate-800">{{ typeMeta.label }}</dd></div>
            <div v-if="video" class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">Video</dt><dd class="text-right font-medium text-slate-800">{{ video.title }}</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">Template</dt><dd class="font-mono text-slate-800">{{ template?.name }}</dd></div>
            <div v-if="form.correctOption" class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">Correct answer</dt><dd class="font-medium text-emerald-700">{{ form.correctOption }}</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">Recipients</dt><dd class="font-medium text-slate-800">{{ audience.reachable }} of {{ audience.active }} active employees</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3">
              <dt class="text-slate-500">When</dt>
              <dd class="text-right font-medium text-slate-800">{{ form.when === 'now' ? 'Immediately' : formatStamp(scheduledAt) }}<template v-if="form.when === 'later' && form.repeat !== 'none'">, then {{ form.repeat }}</template></dd>
            </div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-slate-500">WhatsApp messages used</dt><dd class="font-medium text-slate-800">{{ audience.reachable }} (limit {{ store.settings.dailyLimit - store.settings.usedToday }} left today)</dd></div>
          </dl>

          <div v-if="form.when === 'now' && problems.length" class="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            <p class="font-semibold">This campaign can't be sent yet:</p>
            <ul class="mt-1 list-disc pl-5">
              <li v-for="p in problems" :key="p">{{ p }}</li>
            </ul>
          </div>
        </div>

        <div class="mt-8 flex justify-between border-t border-slate-200 pt-5">
          <button v-if="step > 0" type="button" class="btn-secondary" @click="step--"><ArrowLeft class="size-4" /> Back</button>
          <span v-else />
          <button v-if="step < steps.length - 1" type="button" class="btn-primary" @click="next">Next <ArrowRight class="size-4" /></button>
          <button v-else type="button" class="btn-primary" :disabled="busy || (form.when === 'now' && problems.length > 0)" @click="finish">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            {{ form.when === 'now' ? `Send to ${audience.reachable} employees` : existing?.status === 'Scheduled' ? 'Update schedule' : 'Schedule campaign' }}
          </button>
        </div>
      </div>

      <div class="lg:sticky lg:top-8 lg:self-start">
        <p class="mb-3 text-center text-sm font-medium text-slate-500">What employees will see</p>
        <WhatsAppPreview
          :header="template?.header ?? (form.type === 'video' ? 'Video' : 'None')"
          :body="template?.body ?? 'Choose a template to see the message.'"
          :content="form.content"
          :buttons="buttons"
          :video-title="video?.title ?? ''"
          :video-thumb="video?.thumb"
          :tapped="previewTap && buttons.includes(previewTap) ? previewTap : ''"
          :reply="form.replies[previewTap] ?? ''"
        />
        <div v-if="buttons.length" class="mt-3 flex flex-wrap justify-center gap-1">
          <span class="w-full text-center text-xs text-slate-500">Preview a tap:</span>
          <button
            v-for="b in buttons"
            :key="b"
            type="button"
            :class="['rounded-full px-3 py-1 text-xs font-medium', previewTap === b ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
            @click="previewTap = previewTap === b ? '' : b"
          >
            {{ b }}
          </button>
        </div>
      </div>
    </div>
  </template>
</template>
