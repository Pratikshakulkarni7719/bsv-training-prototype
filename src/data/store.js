import { computed, reactive, watch } from 'vue'
import { authEmail } from '@/data/auth'

// Static prototype "backend". Everything lives in the browser and is saved to localStorage,
// so changes survive a refresh. Settings > Demo data resets it.

const STORAGE_KEY = 'bsv_compliance_state'
const VERSION = 3

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const CAMPAIGN_TYPES = {
  quiz: {
    label: 'True / False check',
    short: 'True / False',
    graded: true,
    hint: 'A statement employees mark True or False. Shows who understood the rule.'
  },
  video: {
    label: 'Video scenario',
    short: 'Video scenario',
    graded: true,
    hint: 'A short clip of an interaction. Employees judge if the action was correct.'
  },
  nugget: {
    label: 'Learning nugget',
    short: 'Nugget',
    graded: false,
    hint: 'A short tip or rule employees acknowledge with "Understood".'
  },
  announcement: {
    label: 'Announcement',
    short: 'Announcement',
    graded: false,
    hint: 'News such as a new training going live, with a status reply.'
  }
}

export const TEMPLATE_TYPES = { ...CAMPAIGN_TYPES, consent: { label: 'Consent request', short: 'Consent', graded: false } }

export const REGIONS = ['West', 'North', 'South', 'East']
export const LANGUAGES = ['English', 'Hindi', 'Marathi']
export const DESIGNATIONS = ['Medical Representative', 'Area Manager', 'Regional Manager']
export const MAX_VIDEO_MB = 16

const ROLE_PERMISSIONS = {
  Admin: ['employees', 'content', 'campaigns', 'queries', 'settings'],
  'Campaign manager': ['content', 'campaigns', 'queries'],
  Viewer: []
}

export const ROLES = [
  { name: 'Admin', can: 'Everything: employees, content, campaigns, settings and team.' },
  { name: 'Campaign manager', can: 'Create content and campaigns, manage the knowledge base and queries.' },
  { name: 'Viewer', can: 'View campaigns, queries and reports only.' }
]

const STOP_WORDS = new Set(
  'the a an is are am was can could i to do does did my of for in on at what how with me it we be should would or and any there this that you your about when where who which please tell need want know if not'.split(' ')
)

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0')

// Timestamps are stored as "YYYY-MM-DD HH:mm" in local time
export function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseStamp(s) {
  if (!s) return null
  const [date, time = '00:00'] = s.split(' ')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

export function addTime(s, { days = 0, minutes = 0 } = {}) {
  const d = parseStamp(s)
  d.setDate(d.getDate() + days)
  d.setMinutes(d.getMinutes() + minutes)
  return stamp(d)
}

function daysFromNow(days, time = '10:00') {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const [hh, mm] = time.split(':').map(Number)
  d.setHours(hh, mm, 0, 0)
  return stamp(d)
}

export function formatStamp(s, withTime = true) {
  const d = parseStamp(s)
  if (!d) return '—'
  const opts = { day: 'numeric', month: 'short', year: 'numeric' }
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('en-IN', opts)
}

export function timeAgo(s) {
  const d = parseStamp(s)
  if (!d) return 'Never'
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatStamp(s, false)
}

export function isPast(s) {
  return parseStamp(s) <= new Date()
}

// Returns a "+91XXXXXXXXXX" style number, or null when the number is invalid
export function normalizePhone(raw) {
  let p = String(raw ?? '').trim().replace(/[\s\-().]/g, '')
  if (!p) return null
  if (p.startsWith('00')) p = `+${p.slice(2)}`
  if (!p.startsWith('+')) {
    if (/^\d{10}$/.test(p)) p = `+91${p}`
    else if (/^91\d{10}$/.test(p)) p = `+${p}`
    else if (/^0\d{10}$/.test(p)) p = `+91${p.slice(1)}`
    else return null
  }
  const digits = p.slice(1)
  if (!/^\d{11,15}$/.test(digits)) return null
  if (digits.startsWith('91') && (digits.length !== 12 || !/^[6-9]/.test(digits[2]))) return null
  return p
}

export function formatPhone(p) {
  if (!p) return ''
  if (p.startsWith('+91') && p.length === 13) return `+91 ${p.slice(3, 8)} ${p.slice(8)}`
  return p
}

export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

export function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || 'there'
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function fillTemplate(body, name, content) {
  return (body || '').replaceAll('{{1}}', firstName(name)).replaceAll('{{2}}', content || '…')
}

function stem(word) {
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word
}

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stem)
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function defaultReplies(type, buttons, correct) {
  const replies = {}
  buttons.forEach((b) => {
    if (CAMPAIGN_TYPES[type]?.graded && correct) {
      replies[b] = b === correct ? 'Correct! Well done.' : `Not quite. The right answer is "${correct}".`
    } else if (/question|doubt/i.test(b)) {
      replies[b] = 'Sure. Type your question here and I will try to help.'
    } else if (/not yet|^no$/i.test(b)) {
      replies[b] = 'Thanks for letting us know. Please complete it as soon as you can.'
    } else {
      replies[b] = 'Thank you, your response has been recorded.'
    }
  })
  return replies
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

// empId, name, mobile, region, designation, manager, language, status, consent, last active (days ago)
const EMPLOYEE_SEED = [
  ['BSV1001', 'Ramesh Patil', '9822011001', 'West', 'Medical Representative', 'Sunil Wagh', 'Marathi', 'Active', 'Consented', 1],
  ['BSV1002', 'Priya Deshmukh', '9822011002', 'West', 'Medical Representative', 'Sunil Wagh', 'English', 'Active', 'Consented', 0],
  ['BSV1003', 'Amit Kulkarni', '9822011003', 'West', 'Area Manager', 'Rekha Iyer', 'English', 'Active', 'Consented', 2],
  ['BSV1004', 'Sneha Joshi', '9822011004', 'West', 'Medical Representative', 'Amit Kulkarni', 'Marathi', 'Active', 'Consented', 0],
  ['BSV1005', 'Rahul Shinde', '9822011005', 'West', 'Medical Representative', 'Amit Kulkarni', 'Marathi', 'Active', 'Pending', null],
  ['BSV1006', 'Kavita Pawar', '9822011006', 'West', 'Medical Representative', 'Amit Kulkarni', 'English', 'Active', 'Consented', 3],
  ['BSV1007', 'Sachin More', '9822011007', 'West', 'Medical Representative', 'Sunil Wagh', 'Marathi', 'Active', 'Consented', 1],
  ['BSV1008', 'Neha Gaikwad', '9822011008', 'West', 'Medical Representative', 'Sunil Wagh', 'English', 'Inactive', 'Declined', 40],
  ['BSV1009', 'Vikas Jadhav', '9822011009', 'West', 'Medical Representative', 'Amit Kulkarni', 'English', 'Active', 'Consented', 0],
  ['BSV1010', 'Pooja Bhosale', '9822011010', 'West', 'Medical Representative', 'Sunil Wagh', 'Marathi', 'Active', 'Pending', null],
  ['BSV2001', 'Arjun Mehta', '9811022001', 'North', 'Area Manager', 'Rekha Iyer', 'Hindi', 'Active', 'Consented', 1],
  ['BSV2002', 'Karan Singh', '9811022002', 'North', 'Medical Representative', 'Arjun Mehta', 'Hindi', 'Active', 'Consented', null],
  ['BSV2003', 'Rohit Verma', '9811022003', 'North', 'Medical Representative', 'Arjun Mehta', 'Hindi', 'Active', 'Consented', 2],
  ['BSV2004', 'Anjali Gupta', '9811022004', 'North', 'Medical Representative', 'Arjun Mehta', 'English', 'Active', 'Consented', 0],
  ['BSV2005', 'Manoj Tiwari', '9811022005', 'North', 'Medical Representative', 'Arjun Mehta', 'Hindi', 'Active', 'Declined', 15],
  ['BSV3001', 'Divya Nair', '9845033001', 'South', 'Area Manager', 'Rekha Iyer', 'English', 'Active', 'Consented', 0],
  ['BSV3002', 'Suresh Reddy', '9845033002', 'South', 'Medical Representative', 'Divya Nair', 'English', 'Active', 'Consented', 1],
  ['BSV3003', 'Lakshmi Rao', '9845033003', 'South', 'Medical Representative', 'Divya Nair', 'English', 'Active', 'Consented', 4],
  ['BSV3004', 'Meera Iyer', '9845033004', 'South', 'Medical Representative', 'Divya Nair', 'English', 'Active', 'Consented', 0],
  ['BSV3005', 'Farah Khan', '9845033005', 'South', 'Medical Representative', 'Divya Nair', 'English', 'Inactive', 'Consented', 30],
  ['BSV4001', 'Deepak Das', '9830044001', 'East', 'Area Manager', 'Rekha Iyer', 'English', 'Active', 'Consented', 2],
  ['BSV4002', 'Ritu Sharma', '9830044002', 'East', 'Medical Representative', 'Deepak Das', 'Hindi', 'Active', 'Consented', 1],
  ['BSV4003', 'Sourav Ghosh', '9830044003', 'East', 'Medical Representative', 'Deepak Das', 'English', 'Active', 'Pending', null],
  ['BSV4004', 'Ananya Bose', '9830044004', 'East', 'Medical Representative', 'Deepak Das', 'English', 'Active', 'Consented', 0]
]

// Phase 2: groups (team / business-unit targeting). Disabled for Phase 1, which always sends to all
// active employees. Kept here so it can be switched back on.
// const groups = [
//   { id: 1, name: 'Pune Team', description: 'Field sales, Pune region', color: 'bg-emerald-500' },
//   { id: 2, name: 'Mumbai Team', description: 'Field sales, Mumbai region', color: 'bg-sky-500' },
//   { id: 3, name: 'Nashik Team', description: 'Collections and support', color: 'bg-amber-500' },
//   { id: 4, name: 'New Joiners', description: 'Staff in their first 90 days', color: 'bg-violet-500' }
// ]

function seedEmployees() {
  return EMPLOYEE_SEED.map((r, i) => {
    const [empId, name, mobile, region, designation, manager, language, status, consent, lastDays] = r
    const addedAt = daysFromNow(-60, '09:00')
    const consentHistory = [{ at: daysFromNow(-60, '09:05'), action: 'requested' }]
    if (consent === 'Consented') consentHistory.push({ at: daysFromNow(-59, '10:15'), action: 'agreed' })
    if (consent === 'Declined') consentHistory.push({ at: daysFromNow(-50, '18:20'), action: 'declined' })
    return {
      id: i + 1,
      empId,
      name,
      phone: `+91${mobile}`,
      region,
      designation,
      manager,
      language,
      status,
      consent,
      consentHistory,
      onWhatsApp: empId !== 'BSV2002',
      addedAt,
      leftAt: status === 'Inactive' ? daysFromNow(-(lastDays ?? 20) + 1, '18:00') : null,
      lastActive: lastDays === null ? null : daysFromNow(-lastDays, '11:20')
      // groupIds: [] // Phase 2: groups (disabled)
    }
  })
}

const VIDEO_SEED = [
  { id: 1, title: 'Gift offered to a doctor', duration: '0:52', sizeMb: 8.1, thumb: 'from-emerald-400 to-teal-600', daysAgo: 20 },
  { id: 2, title: 'Sharing patient data on a call', duration: '0:47', sizeMb: 6.9, thumb: 'from-sky-400 to-indigo-600', daysAgo: 15 },
  { id: 3, title: 'Vendor meeting without approval', duration: '0:58', sizeMb: 9.2, thumb: 'from-amber-400 to-orange-600', daysAgo: 10 },
  { id: 4, title: 'Recording a sample handover', duration: '0:40', sizeMb: 5.6, thumb: 'from-rose-400 to-pink-600', daysAgo: 4 }
]

const TEMPLATE_SEED = [
  {
    id: 1,
    name: 'compliance_true_false',
    type: 'quiz',
    category: 'Utility',
    language: 'English',
    status: 'Approved',
    header: 'None',
    body: 'Hi {{1}}, quick compliance check:\n\n{{2}}\n\nTap True or False.',
    buttons: ['True', 'False']
  },
  {
    id: 2,
    name: 'compliance_video_scenario',
    type: 'video',
    category: 'Utility',
    language: 'English',
    status: 'Approved',
    header: 'Video',
    body: 'Hi {{1}}, watch this short scenario.\n\n{{2}}',
    buttons: ['Correct action', 'Wrong action']
  },
  {
    id: 3,
    name: 'compliance_nugget',
    type: 'nugget',
    category: 'Utility',
    language: 'English',
    status: 'Approved',
    header: 'None',
    body: 'Hi {{1}}, here is your compliance nugget:\n\n{{2}}',
    buttons: ['Understood', 'I have a question']
  },
  {
    id: 4,
    name: 'compliance_announcement',
    type: 'announcement',
    category: 'Utility',
    language: 'English',
    status: 'Approved',
    header: 'None',
    body: 'Hi {{1}}, {{2}}',
    buttons: ['Yes, completed', 'Not yet']
  },
  {
    id: 5,
    name: 'consent_request',
    type: 'consent',
    category: 'Utility',
    language: 'English',
    status: 'Approved',
    header: 'None',
    body: 'Hi {{1}}, BSV Compliance will send you short compliance updates and quick checks on WhatsApp. You can also ask policy questions here. Tap Agree to continue or Stop to opt out.',
    buttons: ['Agree', 'Stop']
  },
  {
    id: 6,
    name: 'compliance_true_false_hi',
    type: 'quiz',
    category: 'Utility',
    language: 'Hindi',
    status: 'Pending',
    header: 'None',
    body: 'नमस्ते {{1}}, आज का अनुपालन प्रश्न:\n\n{{2}}',
    buttons: ['सही', 'गलत']
  },
  {
    id: 7,
    name: 'festive_offer',
    type: 'announcement',
    category: 'Marketing',
    language: 'English',
    status: 'Rejected',
    rejectReason: 'Promotional content must use the Marketing category and include opt-out text.',
    header: 'None',
    body: 'Big festive offer! Share with every doctor today.',
    buttons: []
  }
]

const FAQ_SEED = [
  {
    category: 'Gifts & hospitality',
    question: 'Can I give a gift to a doctor?',
    keywords: ['gift', 'present', 'doctor', 'hcp'],
    answer: 'No. Gifts, cash or personal benefits to healthcare professionals are not allowed. Only approved educational material may be given, with prior approval from Compliance.',
    source: 'Anti-Bribery & Corruption Policy, section 4'
  },
  {
    category: 'Gifts & hospitality',
    question: 'Can I sponsor a doctor to attend a conference?',
    keywords: ['sponsor', 'conference', 'travel', 'cme'],
    answer: 'Only through the formal sponsorship process. The request must be approved by Compliance before any commitment is made to the doctor.',
    source: 'HCP Interaction Code, section 6'
  },
  {
    category: 'Gifts & hospitality',
    question: 'Can I accept a gift or dinner from a distributor or vendor?',
    keywords: ['accept', 'dinner', 'distributor', 'vendor gift', 'hospitality'],
    answer: 'Do not accept gifts or hospitality that could influence a business decision. Small token items must be declared to your manager within 7 days.',
    source: 'Anti-Bribery & Corruption Policy, section 5'
  },
  {
    category: 'Data privacy',
    question: 'Can I share patient details on WhatsApp?',
    keywords: ['patient', 'share', 'whatsapp', 'details', 'medical record'],
    answer: 'No. Never share patient names, reports or any identifying details on WhatsApp, email or personal apps.',
    source: 'Data Privacy Policy, section 3'
  },
  {
    category: 'Data privacy',
    question: 'What counts as confidential information?',
    keywords: ['confidential', 'information', 'secret', 'pricing', 'data'],
    answer: 'Confidential information includes patient data, pricing, tender details, doctor lists and internal reports. Never discuss it in public places or on personal devices.',
    source: 'Data Privacy Policy, section 2'
  },
  {
    category: 'Data privacy',
    question: 'Can I use my personal email to send reports?',
    keywords: ['personal email', 'gmail', 'email', 'personal device'],
    answer: 'No. Use only your BSV email and approved apps for any work documents.',
    source: 'Data Privacy Policy, section 5'
  },
  {
    category: 'Vendors',
    question: 'Do I need approval before meeting a new vendor?',
    keywords: ['vendor', 'approval', 'supplier', 'meeting', 'new vendor'],
    answer: 'Yes. Check that the vendor is on the approved vendor list. If not, raise a request with Procurement and Compliance before the meeting.',
    source: 'Vendor Management SOP, step 2'
  },
  {
    category: 'Samples',
    question: 'How do I record samples given to a doctor?',
    keywords: ['sample', 'samples', 'record', 'handover'],
    answer: 'Record every sample in the field app on the same day, with the doctor\'s signature. Unrecorded samples are treated as a compliance breach.',
    source: 'HCP Interaction Code, section 8'
  },
  {
    category: 'Speak up',
    question: 'How do I report a compliance concern?',
    keywords: ['report', 'concern', 'complaint', 'whistle', 'speak', 'violation'],
    answer: 'Use the Speak-Up channel on the intranet, or email compliance@bsv.example. Reports can be anonymous and retaliation is not tolerated.',
    source: 'Speak-Up Policy'
  },
  {
    category: 'Training',
    question: 'Where do I find the compliance training?',
    keywords: ['training', 'module', 'course', 'lms', 'learning'],
    answer: 'All compliance training modules are on the BSV Learning portal under "Compliance". Use your employee ID to log in.',
    source: 'Compliance Training Plan'
  }
]

const POLICY_SEED = [
  { title: 'Anti-Bribery & Corruption Policy', fileName: 'ABC_Policy_v4.pdf', pages: 18, daysAgo: 45 },
  { title: 'Data Privacy Policy', fileName: 'Data_Privacy_Policy_2026.pdf', pages: 12, daysAgo: 30 },
  { title: 'HCP Interaction Code', fileName: 'HCP_Interaction_Code.pdf', pages: 24, daysAgo: 60 },
  { title: 'Vendor Management SOP', fileName: 'Vendor_SOP_v2.pdf', pages: 9, daysAgo: 20 }
]

function createSeedState() {
  const rng = mulberry32(2026)
  const employees = seedEmployees()
  const s = {
    version: VERSION,
    employees,
    // groups, // Phase 2: groups (disabled)
    videos: VIDEO_SEED.map(({ daysAgo, ...v }) => ({ ...v, uploadedAt: daysFromNow(-daysAgo, '15:00') })),
    templates: TEMPLATE_SEED.map((t, i) => ({ ...t, updatedAt: daysFromNow(-(30 - i * 3), '12:00') })),
    faqs: FAQ_SEED.map((f, i) => ({ ...f, id: i + 1, active: true, hits: 0, updatedAt: daysFromNow(-25, '16:00') })),
    policies: POLICY_SEED.map(({ daysAgo, ...p }, i) => ({ ...p, id: i + 1, uploadedAt: daysFromNow(-daysAgo, '14:00'), status: 'Indexed' })),
    campaigns: [],
    queries: [],
    chats: {},
    auditLog: [],
    insights: {
      // Phase 2: themes an AI model finds in employee questions and replies (simulated)
      aiTopics: [
        { theme: 'Gifts and hospitality for doctors', mentions: 34, trend: 'up', quote: 'Can I give a diwali gift box to a doctor?' },
        { theme: 'Training deadlines', mentions: 21, trend: 'up', quote: 'What is the deadline for the anti-bribery training?' },
        { theme: 'Personal devices and email', mentions: 13, trend: 'flat', quote: 'Can I send the doctor list from my gmail?' },
        { theme: 'Vendor approval process', mentions: 8, trend: 'down', quote: 'How long does vendor approval take?' }
      ],
      sentiment: { positive: 64, neutral: 25, negative: 11 }
    },
    settings: {
      businessName: 'BSV Compliance',
      number: '+91 20 4000 1234',
      provider: 'Meta WhatsApp Cloud API',
      connection: 'Connected',
      quality: 'High',
      dailyLimit: 1000,
      usedToday: 0,
      usageDate: stamp().slice(0, 10),
      webhookUrl: 'https://compliance.bsv.example/api/whatsapp/webhook',
      hosting: 'BSV private cloud (Mumbai)',
      botMode: 'faq',
      autoConsent: true,
      quietHours: { enabled: true, from: '20:00', to: '08:00' },
      messages: {
        fallback: 'I could not find an answer to that. Please connect with your local compliance team or your manager.',
        notRegistered: 'Sorry, this service is only for BSV field employees. If you work at BSV, please ask your manager to check your number with HR.',
        welcome: 'Thank you! You will now receive short compliance updates here. You can also ask any policy question, for example "Can I give a gift to a doctor?"',
        optOut: 'You have been unsubscribed and will not get compliance messages here. Reply START any time to subscribe again.',
        greeting: 'Hi {{1}}! Ask me any question about BSV compliance policies, for example "Can I give a gift to a doctor?" Type HELP to see topics.'
      },
      hrms: { enabled: false, system: 'SAP SuccessFactors', frequency: 'Daily', lastSync: null, deactivateMissing: true },
      team: [
        { name: 'Pranita Mantha', email: 'pranita@bsv.example', role: 'Admin' },
        { name: 'Harsha Menon', email: 'harsha@bsv.example', role: 'Admin' },
        { name: 'Compliance Desk', email: 'desk@bsv.example', role: 'Campaign manager' },
        { name: 'Regional Head', email: 'region@bsv.example', role: 'Viewer' }
      ]
    }
  }

  // Consent messages in each employee's chat
  employees.forEach((e) => {
    e.consentHistory.forEach((h) => {
      if (h.action === 'requested') {
        pushChat(s, e.phone, { from: 'bot', kind: 'consent', text: fillTemplate(templateById(s, 5).body, e.name), buttons: ['Agree', 'Stop'], at: h.at })
      } else {
        pushChat(s, e.phone, { from: 'user', text: h.action === 'agreed' ? 'Agree' : 'Stop', at: h.at })
        pushChat(s, e.phone, { from: 'bot', text: h.action === 'agreed' ? s.settings.messages.welcome : s.settings.messages.optOut, at: h.at })
      }
    })
  })

  const campaignSeed = [
    {
      name: 'Privacy basics: public places',
      type: 'quiz',
      theme: 'Data privacy',
      templateId: 1,
      content: 'Confidential information can be discussed in a public place if you speak quietly.',
      correctOption: 'False',
      replies: {
        True: 'Not quite. Confidential information should never be discussed in public places, even quietly.',
        False: 'Correct! Never discuss confidential information where others can hear.'
      },
      sentDaysAgo: 12,
      profile: { read: 0.85, respond: 0.8, correct: 0.78 }
    },
    {
      name: 'Scenario: gift to a doctor',
      type: 'video',
      theme: 'Gifts & hospitality',
      templateId: 2,
      videoId: 1,
      content: 'Did the representative act correctly in this video?',
      correctOption: 'Wrong action',
      replies: {
        'Correct action': 'Not quite. Offering a gift to a doctor is not allowed under the Anti-Bribery Policy.',
        'Wrong action': 'Correct! Gifts to doctors are not allowed. Only approved educational material may be given.'
      },
      sentDaysAgo: 8,
      profile: { read: 0.8, respond: 0.75, correct: 0.6 }
    },
    {
      name: 'Nugget: approved vendors only',
      type: 'nugget',
      theme: 'Vendors',
      templateId: 3,
      content: 'Before meeting an external vendor, always check that they are on the approved vendor list.',
      sentDaysAgo: 5,
      profile: { read: 0.8, respond: 0.7 }
    },
    {
      name: 'Anti-bribery training is live',
      type: 'announcement',
      theme: 'Training',
      templateId: 4,
      content: 'the new Anti-Bribery training module is now live on the BSV Learning portal. Have you completed it?',
      sentDaysAgo: 2,
      reminder: { enabled: true, afterDays: 3 },
      profile: { read: 0.7, respond: 0.6, first: 0.55 }
    }
  ]

  campaignSeed.forEach((c, i) => {
    const sentAt = daysFromNow(-c.sentDaysAgo, '10:00')
    const tpl = templateById(s, c.templateId)
    const campaign = baseCampaign({
      id: i + 1,
      name: c.name,
      type: c.type,
      theme: c.theme,
      templateId: c.templateId,
      videoId: c.videoId ?? null,
      content: c.content,
      correctOption: c.correctOption ?? null,
      replies: c.replies ?? defaultReplies(c.type, tpl.buttons, c.correctOption),
      reminder: c.reminder ?? { enabled: false, afterDays: 2 },
      status: 'Sent',
      sentAt,
      createdBy: 'Pranita Mantha',
      createdAt: addTime(sentAt, { days: -1 })
    })
    deliver(s, campaign, sentAt)
    campaign.recipients.forEach((r) => {
      if (r.status === 'Failed') return
      const x = rng()
      r.status = x < c.profile.read ? 'Read' : x < c.profile.read + 0.1 ? 'Delivered' : 'Sent'
      if (r.status !== 'Read' || rng() > c.profile.respond) return
      let option
      if (campaign.correctOption) {
        option = rng() < c.profile.correct ? campaign.correctOption : tpl.buttons.find((b) => b !== campaign.correctOption)
      } else {
        option = rng() < (c.profile.first ?? 0.85) ? tpl.buttons[0] : tpl.buttons[1]
      }
      const at = addTime(sentAt, { minutes: 4 + Math.floor(rng() * 900) })
      respond(s, campaign, r, option, at)
    })
    s.campaigns.unshift(campaign)
  })

  // Upcoming and draft campaigns
  s.campaigns.unshift(
    baseCampaign({
      id: 5,
      name: 'Scenario: patient data on a call',
      type: 'video',
      theme: 'Data privacy',
      templateId: 2,
      videoId: 2,
      content: 'Did the representative handle the patient information correctly?',
      correctOption: 'Wrong action',
      replies: {
        'Correct action': 'Not quite. Patient details must never be shared on a call or WhatsApp.',
        'Wrong action': 'Correct! Patient details must never be shared on a call or WhatsApp.'
      },
      status: 'Scheduled',
      scheduledAt: daysFromNow(2, '10:00'),
      createdBy: 'Compliance Desk',
      createdAt: daysFromNow(-1, '16:00')
    }),
    baseCampaign({
      id: 6,
      name: 'Weekly nugget: record every sample',
      type: 'nugget',
      theme: 'Samples',
      templateId: 3,
      content: 'Record every sample in the field app on the same day, with the doctor\'s signature.',
      replies: defaultReplies('nugget', ['Understood', 'I have a question']),
      status: 'Scheduled',
      scheduledAt: daysFromNow(5, '09:30'),
      repeat: 'weekly',
      createdBy: 'Pranita Mantha',
      createdAt: daysFromNow(-1, '17:00')
    }),
    baseCampaign({
      id: 7,
      name: 'October privacy check',
      type: 'quiz',
      theme: 'Data privacy',
      templateId: 1,
      content: 'It is fine to send a patient report to a doctor from your personal email.',
      correctOption: 'False',
      replies: defaultReplies('quiz', ['True', 'False'], 'False'),
      status: 'Draft',
      createdBy: 'Pranita Mantha',
      createdAt: daysFromNow(0, '09:00')
    })
  )

  // Questions employees typed to the bot
  const querySeed = [
    ['BSV1004', 'Can I give a diwali gift box to a doctor?', 6, '18:40'],
    ['BSV1002', 'What is the deadline for the anti-bribery training?', 1, '09:12'],
    ['BSV2004', 'can i share patient report on whatsapp with the doctor', 4, '12:30'],
    ['BSV3002', 'Do I need approval to meet a new vendor?', 3, '15:05'],
    ['BSV1009', 'Can I attend a dinner organised by a distributor?', 2, '20:10'],
    ['BSV4002', 'Is the new training compulsory for area managers also?', 1, '11:45'],
    ['BSV3004', 'how do I report a concern anonymously', 7, '10:20'],
    ['BSV1001', 'Can I use my gmail to send the doctor list?', 9, '17:30'],
    ['BSV2003', 'Who approves conference sponsorship?', 5, '13:10'],
    [null, 'Hi, I want to know about job openings', 3, '19:00']
  ]
  querySeed.forEach(([empId, text, daysAgo, time]) => {
    const e = employees.find((x) => x.empId === empId)
    handleIncoming(s, e ? e.phone : '+919900012345', text, daysFromNow(-daysAgo, time))
  })

  s.auditLog.push(
    { id: 1, at: daysFromNow(-60, '09:00'), user: 'Pranita Mantha', action: 'Imported 24 employees from HR list (hr_master_aug.xlsx)' },
    { id: 2, at: daysFromNow(-30, '10:00'), user: 'Harsha Menon', action: 'Connected WhatsApp number +91 20 4000 1234' }
  )
  return s
}

/* ------------------------------------------------------------------ */
/* Engine: works on any state object, so the seed and the live app     */
/* share the same rules.                                               */
/* ------------------------------------------------------------------ */

function templateById(s, id) {
  return s.templates.find((t) => t.id === id)
}

function videoById(s, id) {
  return s.videos.find((v) => v.id === id)
}

function baseCampaign(fields) {
  return {
    theme: '',
    videoId: null,
    correctOption: null,
    replies: {},
    audience: 'all',
    // groupIds: [], // Phase 2: groups (disabled)
    status: 'Draft',
    scheduledAt: null,
    sentAt: null,
    repeat: 'none',
    reminder: { enabled: false, afterDays: 2 },
    reminderLog: [],
    recipients: [],
    ...fields
  }
}

function pushChat(s, phone, msg) {
  if (!s.chats[phone]) s.chats[phone] = []
  const list = s.chats[phone]
  list.push({ id: (list.at(-1)?.id ?? 0) + 1, at: stamp(), ...msg })
}

function failureReason(e) {
  if (!e.onWhatsApp) return 'Number is not on WhatsApp'
  if (e.consent === 'Declined') return 'Opted out (replied STOP)'
  if (e.consent !== 'Consented') return 'No consent yet'
  return ''
}

// Creates one recipient per active employee and puts the message in their chat
function deliver(s, campaign, at) {
  const tpl = templateById(s, campaign.templateId)
  const video = campaign.videoId ? videoById(s, campaign.videoId) : null
  campaign.recipients = s.employees
    .filter((e) => e.status === 'Active')
    .map((e) => {
      const reason = failureReason(e)
      const r = {
        employeeId: e.id,
        name: e.name,
        phone: e.phone,
        region: e.region,
        status: reason ? 'Failed' : 'Sent',
        reason,
        response: null,
        respondedAt: null,
        reminders: 0
      }
      if (!reason) {
        pushChat(s, e.phone, {
          from: 'bot',
          kind: 'campaign',
          campaignId: campaign.id,
          text: fillTemplate(tpl.body, e.name, campaign.content),
          buttons: [...tpl.buttons],
          video: video ? { title: video.title, thumb: video.thumb } : null,
          at
        })
      }
      return r
    })
}

function respond(s, campaign, r, option, at = stamp()) {
  const e = s.employees.find((x) => x.id === r.employeeId)
  r.response = option
  r.respondedAt = at
  r.status = 'Read'
  if (e) e.lastActive = at
  pushChat(s, r.phone, { from: 'user', text: option, campaignId: campaign.id, at })
  pushChat(s, r.phone, {
    from: 'bot',
    kind: 'feedback',
    campaignId: campaign.id,
    text: campaign.replies?.[option] || 'Thank you, your response has been recorded.',
    at
  })
}

export function matchFaq(text, s = store) {
  const lower = String(text).toLowerCase()
  const words = new Set(tokens(text))
  if (!words.size) return null
  let best = null
  let bestScore = 0
  s.faqs.forEach((f) => {
    if (!f.active) return
    let score = 0
    f.keywords.forEach((k) => {
      const key = k.toLowerCase().trim()
      if (!key) return
      if (key.includes(' ') ? lower.includes(key) : words.has(stem(key))) score += 2
    })
    tokens(f.question).forEach((w) => {
      if (words.has(w)) score += 1
    })
    if (score > bestScore) {
      best = f
      bestScore = score
    }
  })
  // AI mode (Phase 2) accepts looser matches and cites the policy source
  const threshold = s.settings.botMode === 'ai' ? 3 : 4
  return bestScore >= threshold ? best : null
}

function setConsent(s, e, action, at) {
  e.consent = action === 'agreed' ? 'Consented' : 'Declined'
  e.consentHistory.push({ at, action })
  e.lastActive = at
}

// The bot: every message an employee (or unknown number) sends comes through here
function handleIncoming(s, phone, rawText, at = stamp()) {
  const text = String(rawText).trim()
  if (!text) return null
  const e = s.employees.find((x) => x.phone === phone)
  pushChat(s, phone, { from: 'user', text, at })
  const reply = (msg, extra = {}) => {
    pushChat(s, phone, { from: 'bot', text: msg, at, ...extra })
    return msg
  }
  const log = (status, botReply, faqId = null) => {
    s.queries.unshift({
      id: nextId(s.queries),
      employeeId: e?.id ?? null,
      name: e?.name ?? 'Unknown number',
      phone,
      text,
      at,
      status,
      faqId,
      reply: botReply,
      reviewed: false
    })
  }

  if (!e || e.status !== 'Active') {
    const msg = reply(s.settings.messages.notRegistered)
    log('Not registered', msg)
    return msg
  }

  const upper = text.toUpperCase().replace(/[^A-Z ]/g, '').trim()
  e.lastActive = at

  if (['STOP', 'UNSUBSCRIBE', 'OPT OUT'].includes(upper)) {
    if (e.consent !== 'Declined') setConsent(s, e, 'declined', at)
    return reply(s.settings.messages.optOut)
  }
  if (['START', 'AGREE', 'SUBSCRIBE'].includes(upper)) {
    if (e.consent !== 'Consented') setConsent(s, e, 'agreed', at)
    return reply(s.settings.messages.welcome)
  }
  if (e.consent === 'Declined') {
    return reply('You have opted out of BSV Compliance messages. Reply START to subscribe again.')
  }
  if (e.consent === 'Pending') {
    return reply('Please tap Agree on our consent message (or reply START) before we can help you here.')
  }
  if (['HI', 'HELLO', 'HEY', 'HII', 'NAMASTE', 'GOOD MORNING'].includes(upper)) {
    return reply(s.settings.messages.greeting.replaceAll('{{1}}', firstName(e.name)))
  }
  if (['HELP', 'MENU', 'TOPICS'].includes(upper)) {
    const topics = [...new Set(s.faqs.filter((f) => f.active).map((f) => f.category))]
    return reply(`You can ask me about:\n• ${topics.join('\n• ')}\n\nJust type your question.`)
  }

  // A typed answer to the latest open campaign question ("true" instead of tapping the button)
  const open = latestOpenCampaign(s, e)
  if (open) {
    const option = templateById(s, open.campaign.templateId).buttons.find((b) => b.toLowerCase() === text.toLowerCase())
    if (option) {
      s.chats[phone].pop() // respond() adds the message itself
      respond(s, open.campaign, open.recipient, option, at)
      return open.campaign.replies?.[option]
    }
  }

  const faq = matchFaq(text, s)
  if (faq) {
    faq.hits++
    const msg = reply(s.settings.botMode === 'ai' ? `${faq.answer}\n\nSource: ${faq.source}` : faq.answer)
    log('Answered', msg, faq.id)
    return msg
  }
  const msg = reply(s.settings.messages.fallback)
  log('Not answered', msg)
  return msg
}

function latestOpenCampaign(s, e) {
  for (const c of s.campaigns) {
    if (c.status !== 'Sent') continue
    const r = c.recipients.find((x) => x.employeeId === e.id && x.status !== 'Failed' && !x.response)
    if (r) return { campaign: c, recipient: r }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Live store                                                          */
/* ------------------------------------------------------------------ */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.version === VERSION ? data : null
  } catch {
    return null
  }
}

export const store = reactive({ ...(load() ?? createSeedState()), toasts: [] })

let saveTimer = null
let frozen = false // set while the page reloads after a reset
watch(
  () => store,
  () => {
    clearTimeout(saveTimer)
    if (frozen) return
    saveTimer = setTimeout(() => {
      try {
        const { toasts, ...data } = store
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // Storage full or blocked: the app keeps working for this session
      }
    }, 300)
  },
  { deep: true }
)

export function resetDemoData() {
  const fresh = createSeedState()
  clearTimeout(saveTimer)
  frozen = true
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  } catch {
    Object.keys(fresh).forEach((k) => (store[k] = fresh[k]))
  }
}

export const currentUser = computed(
  () => store.settings.team.find((m) => m.email.toLowerCase() === authEmail.value.toLowerCase()) ?? null
)

export function can(permission) {
  return ROLE_PERMISSIONS[currentUser.value?.role]?.includes(permission) ?? false
}

export function toast(message, type = 'success') {
  const id = Date.now() + Math.random()
  store.toasts.push({ id, message, type })
  setTimeout(() => {
    const i = store.toasts.findIndex((t) => t.id === id)
    if (i !== -1) store.toasts.splice(i, 1)
  }, 3500)
}

export function audit(action) {
  store.auditLog.unshift({ id: nextId(store.auditLog), at: stamp(), user: currentUser.value?.name ?? 'System', action })
  if (store.auditLog.length > 500) store.auditLog.length = 500
}

// Phase 2: groups (disabled)
// export function groupName(id) {
//   return store.groups.find((g) => g.id === id)?.name ?? 'Unknown group'
// }

export function employeeById(id) {
  return store.employees.find((e) => e.id === id)
}

export function videoUsage(id) {
  return store.campaigns.filter((c) => c.videoId === id).length
}

export function templateUsage(id) {
  return store.campaigns.filter((c) => c.templateId === id).length
}

export function templateFor(id) {
  return templateById(store, id)
}

export function videoFor(id) {
  return videoById(store, id)
}

export function activeEmployees() {
  return store.employees.filter((e) => e.status === 'Active')
}

// Who a campaign can actually reach right now
export function audienceSummary() {
  const active = activeEmployees()
  const reachable = active.filter((e) => !failureReason(e))
  const blocked = {}
  active.forEach((e) => {
    const r = failureReason(e)
    if (r) blocked[r] = (blocked[r] ?? 0) + 1
  })
  return { active: active.length, reachable: reachable.length, blocked }
}

export function campaignStats(c) {
  const r = c.recipients
  const graded = CAMPAIGN_TYPES[c.type]?.graded && c.correctOption
  const responded = r.filter((x) => x.response)
  const sent = r.filter((x) => x.status !== 'Failed').length
  return {
    total: r.length,
    sent,
    delivered: r.filter((x) => ['Delivered', 'Read'].includes(x.status)).length,
    read: r.filter((x) => x.status === 'Read').length,
    failed: r.filter((x) => x.status === 'Failed').length,
    responded: responded.length,
    pending: sent - responded.length,
    correct: graded ? responded.filter((x) => x.response === c.correctOption).length : null
  }
}

function resetDailyUsage() {
  const today = stamp().slice(0, 10)
  if (store.settings.usageDate !== today) {
    store.settings.usageDate = today
    store.settings.usedToday = 0
  }
}

// Returns a list of problems that stop a campaign from being sent
export function campaignProblems(c) {
  const problems = []
  const tpl = templateById(store, c.templateId)
  if (!tpl) problems.push('The message template no longer exists.')
  else if (tpl.status !== 'Approved') problems.push(`Template "${tpl.name}" is ${tpl.status.toLowerCase()}, not approved.`)
  if (c.type === 'video' && !videoById(store, c.videoId)) problems.push('The video was deleted from the library.')
  if (!c.content?.trim()) problems.push('The message content is empty.')
  if (CAMPAIGN_TYPES[c.type]?.graded && !c.correctOption) problems.push('Choose the correct answer.')
  if (store.settings.connection !== 'Connected') problems.push('The WhatsApp number is not connected.')
  resetDailyUsage()
  const { reachable } = audienceSummary()
  if (!reachable) problems.push('No employee can receive messages yet (no active employee has given consent).')
  const left = store.settings.dailyLimit - store.settings.usedToday
  if (reachable > left) problems.push(`Daily sending limit: ${left} messages left today, but ${reachable} are needed.`)
  return problems
}

export function sendCampaign(c) {
  const problems = campaignProblems(c)
  if (problems.length) return { ok: false, problems }
  const at = stamp()
  c.status = 'Sent'
  c.sentAt = at
  deliver(store, c, at)
  const stats = campaignStats(c)
  store.settings.usedToday += stats.sent
  audit(`Sent campaign "${c.name}" to ${stats.sent} employees`)
  simulateDelivery(c.id)

  if (c.repeat !== 'none') {
    const next = JSON.parse(JSON.stringify(c))
    Object.assign(next, {
      id: nextId(store.campaigns),
      status: 'Scheduled',
      sentAt: null,
      recipients: [],
      reminderLog: [],
      scheduledAt: addTime(c.scheduledAt ?? at, { days: c.repeat === 'weekly' ? 7 : 30 })
    })
    store.campaigns.unshift(next)
  }
  return { ok: true, stats }
}

// Fake WhatsApp status webhooks: sent -> delivered -> read over a few seconds
function simulateDelivery(campaignId) {
  const step = (from, to, share) => {
    const c = store.campaigns.find((x) => x.id === campaignId)
    c?.recipients.forEach((r) => {
      if (r.status === from && Math.random() < share) r.status = to
    })
  }
  setTimeout(() => step('Sent', 'Delivered', 0.92), 2500)
  setTimeout(() => step('Delivered', 'Read', 0.75), 6000)
}

export function sendReminder(c, auto = false) {
  const tpl = templateById(store, c.templateId)
  const targets = c.recipients.filter((r) => r.status !== 'Failed' && !r.response)
  if (!targets.length) return 0
  const at = stamp()
  targets.forEach((r) => {
    r.reminders++
    pushChat(store, r.phone, {
      from: 'bot',
      kind: 'reminder',
      campaignId: c.id,
      text: `Reminder: we haven't received your answer yet.\n\n${fillTemplate(tpl.body, r.name, c.content)}`,
      buttons: [...tpl.buttons],
      at
    })
  })
  store.settings.usedToday += targets.length
  c.reminderLog.push({ at, count: targets.length, auto })
  audit(`${auto ? 'Automatic' : 'Manual'} reminder for "${c.name}" sent to ${targets.length} employees`)
  return targets.length
}

export function retryFailed(c) {
  const tpl = templateById(store, c.templateId)
  let fixed = 0
  c.recipients.forEach((r) => {
    if (r.status !== 'Failed') return
    const e = employeeById(r.employeeId)
    if (!e || e.status !== 'Active' || failureReason(e)) return
    r.status = 'Sent'
    r.reason = ''
    pushChat(store, e.phone, {
      from: 'bot',
      kind: 'campaign',
      campaignId: c.id,
      text: fillTemplate(tpl.body, e.name, c.content),
      buttons: [...tpl.buttons],
      video: c.videoId ? { title: videoById(store, c.videoId)?.title, thumb: videoById(store, c.videoId)?.thumb } : null
    })
    fixed++
  })
  if (fixed) {
    audit(`Resent "${c.name}" to ${fixed} previously failed employees`)
    simulateDelivery(c.id)
  }
  return fixed
}

// Employee taps a button on a campaign message (used by the WhatsApp simulator)
export function tapButton(phone, message, option) {
  const e = store.employees.find((x) => x.phone === phone)
  if (message.kind === 'consent') {
    return incomingMessage(phone, option)
  }
  const c = store.campaigns.find((x) => x.id === message.campaignId)
  const r = c?.recipients.find((x) => x.employeeId === e?.id)
  if (!c || !r || !e || e.status !== 'Active') {
    pushChat(store, phone, { from: 'user', text: option })
    pushChat(store, phone, { from: 'bot', text: 'This question is no longer active. Thank you!' })
    return
  }
  if (r.response) {
    pushChat(store, phone, { from: 'user', text: option, campaignId: c.id })
    pushChat(store, phone, { from: 'bot', text: `You already answered "${r.response}". Only your first answer counts. Thank you!`, campaignId: c.id })
    return
  }
  respond(store, c, r, option)
}

export function incomingMessage(phone, text) {
  return handleIncoming(store, phone, text)
}

export function requestConsent(e) {
  if (e.consent === 'Declined') return false
  const at = stamp()
  e.consentHistory.push({ at, action: 'requested' })
  pushChat(store, e.phone, { from: 'bot', kind: 'consent', text: fillTemplate(templateById(store, 5).body, e.name), buttons: ['Agree', 'Stop'], at })
  return true
}

/* Employees ---------------------------------------------------------- */

export function addEmployee(data) {
  const e = {
    id: nextId(store.employees),
    empId: data.empId,
    name: data.name,
    phone: data.phone,
    region: data.region || '',
    designation: data.designation || '',
    manager: data.manager || '',
    language: data.language || 'English',
    status: 'Active',
    consent: 'Pending',
    consentHistory: [],
    onWhatsApp: true,
    addedAt: stamp(),
    leftAt: null,
    lastActive: null
    // groupIds: [] // Phase 2: groups (disabled)
  }
  store.employees.unshift(e)
  if (store.settings.autoConsent) requestConsent(e)
  return e
}

export function updateEmployee(e, data) {
  const phoneChanged = data.phone && data.phone !== e.phone
  if (phoneChanged) {
    // A new number needs new consent; the old chat moves with the employee
    if (store.chats[e.phone]) {
      store.chats[data.phone] = store.chats[e.phone]
      delete store.chats[e.phone]
    }
    e.consent = 'Pending'
    e.onWhatsApp = true
  }
  Object.assign(e, data)
  if (phoneChanged && store.settings.autoConsent) requestConsent(e)
  return phoneChanged
}

export function deactivateEmployee(e, reason = 'Left the organisation') {
  e.status = 'Inactive'
  e.leftAt = stamp()
  e.inactiveReason = reason
}

export function reactivateEmployee(e) {
  e.status = 'Active'
  e.leftAt = null
  e.inactiveReason = ''
}

export function deleteEmployee(e) {
  store.employees = store.employees.filter((x) => x.id !== e.id)
  delete store.chats[e.phone]
  // Past campaign results keep the name snapshot for reports
}

const HEADER_MAP = {
  empId: ['employeeid', 'empid', 'employeecode', 'empcode', 'id', 'employeeno'],
  name: ['name', 'fullname', 'employeename'],
  phone: ['whatsappnumber', 'whatsapp', 'phone', 'phonenumber', 'mobile', 'mobilenumber', 'mobileno', 'contactnumber'],
  region: ['region', 'zone', 'territory'],
  designation: ['designation', 'role', 'title', 'jobtitle'],
  manager: ['manager', 'reportingmanager', 'reportsto'],
  language: ['language', 'preferredlanguage']
}

// Turns raw spreadsheet rows into a preview: add / update / reactivate / unchanged / error
export function validateImport(rawRows) {
  if (!rawRows.length) return { error: 'The file has no data rows.' }
  const headers = Object.keys(rawRows[0])
  const map = {}
  headers.forEach((h) => {
    const key = h.toLowerCase().replace(/[^a-z]/g, '')
    const field = Object.entries(HEADER_MAP).find(([, names]) => names.includes(key))?.[0]
    if (field && !map[field]) map[field] = h
  })
  const missingCols = ['empId', 'name', 'phone'].filter((f) => !map[f])
  if (missingCols.length) {
    const labels = { empId: 'Employee ID', name: 'Name', phone: 'WhatsApp number' }
    return { error: `Missing column(s): ${missingCols.map((f) => labels[f]).join(', ')}. Download the sample file to see the format.` }
  }
  if (rawRows.length > 5000) return { error: 'The file has more than 5,000 rows. Split it into smaller files.' }

  const seenIds = new Map()
  const seenPhones = new Map()
  const items = rawRows.map((raw, i) => {
    const get = (f) => (map[f] ? String(raw[map[f]] ?? '').trim() : '')
    const data = {
      empId: get('empId').toUpperCase(),
      name: get('name').replace(/\s+/g, ' '),
      phone: normalizePhone(get('phone')),
      region: get('region'),
      designation: get('designation'),
      manager: get('manager'),
      language: get('language')
    }
    const rawPhone = get('phone')
    const errors = []
    const warnings = []
    if (!data.empId) errors.push('Employee ID is missing')
    if (!data.name) errors.push('Name is missing')
    if (!rawPhone) errors.push('WhatsApp number is missing')
    else if (!data.phone) errors.push(`"${rawPhone}" is not a valid mobile number`)
    if (data.empId && seenIds.has(data.empId)) errors.push(`Employee ID repeats row ${seenIds.get(data.empId)}`)
    if (data.phone && seenPhones.has(data.phone)) errors.push(`Number repeats row ${seenPhones.get(data.phone)}`)
    if (data.empId) seenIds.set(data.empId, i + 2)
    if (data.phone) seenPhones.set(data.phone, i + 2)
    if (data.language) {
      const lang = LANGUAGES.find((l) => l.toLowerCase() === data.language.toLowerCase())
      if (!lang) warnings.push(`Language "${data.language}" not supported, English used`)
      data.language = lang ?? 'English'
    } else data.language = 'English'

    const existing = store.employees.find((e) => e.empId === data.empId)
    const phoneOwner = data.phone && store.employees.find((e) => e.phone === data.phone)
    if (phoneOwner && phoneOwner.empId !== data.empId) errors.push(`Number already belongs to ${phoneOwner.name} (${phoneOwner.empId})`)

    let action = 'add'
    const changes = []
    if (errors.length) action = 'error'
    else if (existing) {
      ;['name', 'phone', 'region', 'designation', 'manager', 'language'].forEach((f) => {
        if (data[f] && data[f] !== existing[f]) changes.push(f)
      })
      action = existing.status === 'Inactive' ? 'reactivate' : changes.length ? 'update' : 'unchanged'
    }
    return { row: i + 2, data, rawPhone, errors, warnings, action, changes, existingId: existing?.id ?? null }
  })

  const fileIds = new Set(items.map((x) => x.data.empId).filter(Boolean))
  const missing = activeEmployees().filter((e) => !fileIds.has(e.empId))
  return { items, missing }
}

export function applyImport(preview, { deactivateMissing }) {
  const counts = { added: 0, updated: 0, reactivated: 0, deactivated: 0, skipped: 0 }
  preview.items.forEach((item) => {
    if (item.action === 'error') return counts.skipped++
    if (item.action === 'unchanged') return
    const clean = Object.fromEntries(Object.entries(item.data).filter(([, v]) => v))
    if (item.action === 'add') {
      addEmployee(clean)
      counts.added++
    } else {
      const e = employeeById(item.existingId)
      updateEmployee(e, clean)
      if (item.action === 'reactivate') {
        reactivateEmployee(e)
        counts.reactivated++
      } else counts.updated++
    }
  })
  if (deactivateMissing) {
    preview.missing.forEach((e) => {
      deactivateEmployee(e, 'Not in latest HR list')
      counts.deactivated++
    })
  }
  return counts
}

/* Scheduler ---------------------------------------------------------- */

// Runs every 20 seconds while the app is open: sends due campaigns and automatic reminders
export function runScheduler() {
  resetDailyUsage()
  store.campaigns
    .filter((c) => c.status === 'Scheduled' && c.scheduledAt && isPast(c.scheduledAt))
    .forEach((c) => {
      const result = sendCampaign(c)
      if (result.ok) toast(`Scheduled campaign "${c.name}" was sent to ${result.stats.sent} employees.`)
      else {
        c.status = 'Draft'
        c.lastError = result.problems.join(' ')
        audit(`Scheduled campaign "${c.name}" could not be sent: ${c.lastError}`)
        toast(`"${c.name}" could not be sent and was moved to drafts.`, 'error')
      }
    })
  store.campaigns
    .filter((c) => c.status === 'Sent' && c.reminder?.enabled && !c.reminderLog.some((l) => l.auto))
    .filter((c) => isPast(addTime(c.sentAt, { days: c.reminder.afterDays })))
    .forEach((c) => {
      const n = sendReminder(c, true)
      if (n) toast(`Automatic reminder for "${c.name}" sent to ${n} employees.`)
      else c.reminderLog.push({ at: stamp(), count: 0, auto: true })
    })
}

export function inQuietHours(s) {
  const q = store.settings.quietHours
  if (!q.enabled || !s) return false
  const t = s.slice(11, 16)
  return q.from > q.to ? t >= q.from || t < q.to : t >= q.from && t < q.to
}
