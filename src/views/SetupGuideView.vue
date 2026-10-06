<script setup>
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'

const phases = [
  {
    title: 'Phase 1: core',
    items: [
      'WhatsApp Business number connected (Meta Cloud API)',
      'Employee list from HR: upload, update, deactivate leavers. No sign-up.',
      'One-tap consent message (a WhatsApp rule)',
      'Four campaign types: True/False, video scenario, learning nugget, announcement',
      'Personal 1-to-1 messages to all active employees, now or scheduled',
      'Every button response recorded, with instant feedback to the employee',
      'FAQ bot for policy questions; fallback to "contact your local compliance team or manager"',
      'Campaign reports, query log and Excel export',
      'Hosted on BSV\'s own environment'
    ]
  },
  {
    title: 'Phase 2: enhancements (included in this prototype)',
    items: [
      'Admin roles: Admin, Campaign manager, Viewer',
      'AI answers from policy documents, with the source quoted',
      'AI themes and tone from employee messages',
      'Automatic reminders to non-responders; repeating campaigns',
      'Leaderboard, topic and region reports, never-responded list',
      'Automatic HR system sync',
      'Templates per language',
      'Groups / business-unit targeting: built but switched off until traction is proven'
    ]
  }
]

const steps = [
  { title: 'Create a Meta Business account', text: 'Use BSV\'s official name, email and website at business.facebook.com.' },
  { title: 'Verify the business', text: 'Upload company documents. Meta takes a few days to two weeks, so start early.' },
  { title: 'Register a dedicated WhatsApp number', text: 'Use a number that is not on personal WhatsApp, for example "BSV Compliance".' },
  { title: 'Deploy the app on BSV\'s environment', text: 'Employee numbers are personal data, so the portal, database and bot run on BSV servers.' },
  { title: 'Get the templates approved', text: 'One template per campaign type and language. After that, each campaign only fills in its content, with no new approval.' },
  { title: 'Fill the knowledge base', text: 'Add the top policy questions and answers. Optionally upload policy PDFs for AI answers.' },
  { title: 'Import the employee list from HR', text: 'Employees get a one-tap consent message. Nothing else is needed from them.' },
  { title: 'Send the first campaign', text: 'Start with a short True/False check. Then check responses and unanswered questions the next day.' }
]

const faqs = [
  { q: 'Do employees need to install or sign up for anything?', a: 'No. They only need WhatsApp. They get one consent message (a WhatsApp rule) and tap Agree.' },
  { q: 'Why can\'t we write a new message without approval each time?', a: 'WhatsApp needs an approved template to start a conversation. Our templates have a placeholder for content, so one approval covers many campaigns.' },
  { q: 'Does anyone from the team reply to employees?', a: 'No. The bot answers from the knowledge base. If it can\'t, it asks the employee to contact their local compliance team or manager. Unanswered questions appear in Employee queries so the knowledge base can be improved.' },
  { q: 'What happens when someone leaves the company?', a: 'Deactivate them on the Employees page, or re-import the HR list with "Full HR sync". They stop receiving messages and the bot stops answering them. Their past answers stay in reports.' },
  { q: 'Why did a message fail?', a: 'The usual reasons are no consent yet, the employee opted out (STOP), or the number is not on WhatsApp.' },
  { q: 'How big can a video be?', a: 'Up to 16 MB in MP4 format. A 30–60 second clip is usually well under this.' },
  { q: 'Who pays for WhatsApp messages?', a: 'Meta charges BSV per template message (about 1,000 employees × campaigns per month). Replies within 24 hours of an employee\'s message are free.' },
  { q: 'Why are groups switched off?', a: 'BSV asked to send to everyone first and add team or business-unit targeting once traction is proven. The feature is built and can be turned back on.' }
]
const openFaq = ref(null)
</script>

<template>
  <PageHeader title="Setup guide" subtitle="What the platform does, and how to get it live." />

  <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div v-for="p in phases" :key="p.title" class="card p-5">
      <h2 class="font-semibold text-ink">{{ p.title }}</h2>
      <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
        <li v-for="i in p.items" :key="i">{{ i }}</li>
      </ul>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
    <ol class="card divide-y divide-slate-100">
      <li v-for="(s, i) in steps" :key="s.title" class="flex gap-4 p-5">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{{ i + 1 }}</span>
        <div>
          <p class="font-semibold text-slate-800">{{ s.title }}</p>
          <p class="mt-1 text-sm text-slate-600">{{ s.text }}</p>
        </div>
      </li>
    </ol>

    <div class="card self-start">
      <h2 class="border-b border-slate-200 px-5 py-4 font-semibold text-ink">FAQs</h2>
      <ul class="divide-y divide-slate-100">
        <li v-for="(f, i) in faqs" :key="f.q">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-slate-800"
            :aria-expanded="openFaq === i"
            @click="openFaq = openFaq === i ? null : i"
          >
            {{ f.q }}
            <ChevronDown :class="['size-4 shrink-0 transition-transform', openFaq === i ? 'rotate-180' : '']" />
          </button>
          <p v-if="openFaq === i" class="px-5 pb-4 text-sm text-slate-600">{{ f.a }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>
