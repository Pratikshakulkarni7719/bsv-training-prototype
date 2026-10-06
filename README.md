# BSV Compliance Connect (static prototype)

A working Vue 3 prototype of BSV's WhatsApp compliance platform. The Compliance team sends personal WhatsApp messages (quick checks, video scenarios, learning nuggets, announcements) to the field force, records every response, and runs a bot that answers policy questions.

It covers the Phase 1 and Phase 2 scope from the requirements call on 1 Oct 2026. There is no backend. All data lives in the browser (localStorage), so changes survive a refresh. **Settings → Demo data** resets everything.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

**Log in** with one of the team emails below, any password of 6+ characters, and OTP `123456`. The login page lists them, and you can click one to fill it in.

| Email | Role | Can do |
|---|---|---|
| pranita@bsv.example | Admin | Everything |
| harsha@bsv.example | Admin | Everything |
| desk@bsv.example | Campaign manager | Content, campaigns, knowledge base, queries |
| region@bsv.example | Viewer | Read only |

## Screens

| Area | Route | What it does |
|---|---|---|
| Dashboard | `/dashboard` | Reachable employees, response and correct rates, alerts, weakest topics, unanswered questions, upcoming sends |
| Employees | `/employees` | HR list: Excel/CSV import with validation preview, full HR sync, add/edit, deactivate vs delete, consent requests, bulk actions, export, per-employee history |
| Video library | `/videos` | Real MP4 upload (type, 16 MB and length checks, playback), rename, delete only when unused |
| Templates | `/templates` | Meta-approved formats per campaign type and language; `{{1}}` = first name, `{{2}}` = campaign content |
| Knowledge base | `/knowledge-base` | FAQ answers the bot uses, policy PDFs for AI answers (Phase 2), "Test the bot" |
| Campaigns | `/campaigns` | List by status and type |
| New / edit campaign | `/campaigns/new`, `/campaigns/:id/edit` | Type → content (correct answer, reply per button) → audience (all active employees) → schedule, repeat, auto-reminder |
| Campaign detail | `/campaigns/:id` | Live delivered/read/responded/correct, recipients, answers, by region, reminders, retry, export, duplicate |
| Employee queries | `/queries` | Every question asked and the bot's reply; turn unanswered ones into knowledge-base answers |
| Reports & insights | `/insights` | Weekly trend, topics, regions, leaderboard, never-responded, AI themes (Phase 2), Excel export |
| WhatsApp simulator | `/simulator` | Act as any employee or an unknown number: tap buttons, ask questions, STOP / START |
| Settings | `/settings` | WhatsApp connection, quiet hours, bot messages, team and roles, HR sync (Phase 2), opt-outs, audit log, demo data |
| Setup guide | `/setup-guide` | Phase scope, go-live steps, FAQs |

## Business rules built in

- **No sign-up.** Being active in the HR list is the only rule. WhatsApp still requires consent, so new employees get a one-tap Agree/Stop message.
- **One-to-one only.** Campaigns go to every active, consented employee as a personal message. There are no WhatsApp groups.
- **No human chat.** The bot answers from the knowledge base. Otherwise it replies "Please connect with your local compliance team or your manager."
- Messages from unknown or inactive numbers get a polite "only for BSV field employees" reply.
- STOP opts out (never messaged again until START), HELP lists topics, and typing a button's text counts as tapping it. Only the first answer counts.
- A campaign can't be sent if its template isn't approved, its video was deleted, the number is disconnected, no one has consented, or the daily limit would be exceeded.
- Scheduled campaigns send automatically while the app is open (checked every 20 seconds). If a send fails, the campaign returns to drafts with the reason. Weekly and monthly repeats create the next occurrence.
- Automatic reminders go once to non-responders after the chosen number of days.

## Phase 2: groups (switched off)

BSV asked to send to everyone first and add team or business-unit targeting once traction is proven. All group code is **commented out, not deleted**. Search for `Phase 2: groups (disabled)`:

- `src/router/index.js`: the `/groups` route
- `src/layouts/AppLayout.vue`: the Groups menu item
- `src/data/store.js`: group seed data, `groupIds`, `groupName()`
- `src/views/StaffView.vue`: group filter, column and checkboxes
- `src/views/CampaignCreateView.vue`: the group picker on the Audience step
- `src/views/CampaignsView.vue`, `CampaignDetailView.vue`, `InsightsView.vue`: group columns and filters
- `src/views/GroupsView.vue`: the page itself, unchanged

To switch groups back on, uncomment those blocks and restore `groups` in `createSeedState()`. GroupsView still uses the older `store.staff` name, which is now `store.employees`.

## Structure

```
src/
  data/store.js      Data, rules, bot, campaign sending, scheduler, import validation (the only "backend")
  data/files.js      Excel/CSV read and export (SheetJS, loaded on demand)
  data/auth.js       Fake login state
  router/index.js    Routes, login guard and role permissions
  layouts/           App shell (sidebar) and login layout
  components/        Shared UI: modal, badges, stat card, WhatsApp phone preview
  views/             One file per screen
```

Stack: Vue 3, Vite, Tailwind CSS 4, vue-router, lucide-vue-next, SheetJS (xlsx).
