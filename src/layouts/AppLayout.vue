<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Users,
  // UsersRound, // Phase 2: groups (disabled)
  Video,
  FileText,
  BookOpenCheck,
  Send,
  MessageCircleQuestion,
  ChartColumn,
  Smartphone,
  Settings,
  BookOpen,
  LogOut,
  Menu,
  X
} from 'lucide-vue-next'
import { store, toast, can, currentUser, initials } from '@/data/store'
import { setLoggedIn } from '@/data/auth'
import BsvLogo from '@/components/BsvLogo.vue'

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

const openQueries = computed(() => store.queries.filter((q) => q.status === 'Not answered' && !q.reviewed).length)

const sections = computed(() =>
  [
    {
      label: 'Overview',
      items: [{ name: 'Dashboard', to: 'dashboard', icon: LayoutDashboard }]
    },
    {
      label: 'Audience',
      items: [
        { name: 'Employees', to: 'employees', icon: Users }
        // Phase 2: groups (team / business-unit targeting). Disabled for Phase 1.
        // { name: 'Groups', to: 'groups', icon: UsersRound }
      ]
    },
    {
      label: 'Content',
      items: [
        { name: 'Video library', to: 'videos', icon: Video },
        { name: 'Templates', to: 'templates', icon: FileText },
        { name: 'Knowledge base', to: 'knowledgeBase', icon: BookOpenCheck }
      ]
    },
    {
      label: 'Engage',
      items: [
        { name: 'Campaigns', to: 'campaigns', icon: Send },
        { name: 'Employee queries', to: 'queries', icon: MessageCircleQuestion, badge: openQueries.value },
        { name: 'Reports & insights', to: 'insights', icon: ChartColumn }
      ]
    },
    {
      label: 'Tools',
      items: [
        { name: 'WhatsApp simulator', to: 'simulator', icon: Smartphone },
        { name: 'Settings', to: 'settings', icon: Settings, hidden: !can('settings') },
        { name: 'Setup guide', to: 'setupGuide', icon: BookOpen }
      ]
    }
  ].map((s) => ({ ...s, items: s.items.filter((i) => !i.hidden) }))
)

function isActive(name) {
  if (route.name === name) return true
  // Keep the parent menu item highlighted on child pages
  const prefix = { campaigns: 'campaign', templates: 'template' }[name]
  return prefix ? String(route.name).startsWith(prefix) : false
}

watch(
  () => route.fullPath,
  () => (sidebarOpen.value = false)
)

function logout() {
  setLoggedIn('')
  toast('You have been logged out.')
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" @click="sidebarOpen = false" />

    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink text-slate-300 transition-transform lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <div class="flex h-16 items-center justify-between px-5">
        <router-link :to="{ name: 'dashboard' }" class="flex items-center gap-3" aria-label="BSV Compliance Connect home">
          <span class="rounded-lg bg-white px-2 py-1"><BsvLogo :size="30" /></span>
          <div>
            <p class="text-sm font-bold leading-tight text-white">Compliance</p>
            <p class="text-[11px] text-slate-400">Connect · WhatsApp</p>
          </div>
        </router-link>
        <button type="button" class="text-slate-400 hover:text-white lg:hidden" aria-label="Close menu" @click="sidebarOpen = false">
          <X class="size-5" />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        <div v-for="section in sections" :key="section.label" class="mt-4">
          <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ section.label }}</p>
          <ul class="mt-1 space-y-0.5">
            <li v-for="item in section.items" :key="item.to">
              <router-link
                :to="{ name: item.to }"
                :class="[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.to) ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'
                ]"
              >
                <component :is="item.icon" class="size-4.5" />
                <span class="flex-1">{{ item.name }}</span>
                <span v-if="item.badge" class="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white" :title="`${item.badge} unanswered`">
                  {{ item.badge }}
                </span>
              </router-link>
            </li>
          </ul>
        </div>
      </nav>

      <div class="border-t border-white/10 p-3">
        <div class="flex items-center gap-3 rounded-lg px-2 py-2">
          <span class="flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
            {{ initials(currentUser?.name) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">{{ currentUser?.name }}</p>
            <p class="truncate text-xs text-slate-400">{{ currentUser?.role }}</p>
          </div>
          <button type="button" class="rounded p-1 text-slate-400 hover:text-white" aria-label="Log out" title="Log out" @click="logout">
            <LogOut class="size-4.5" />
          </button>
        </div>
      </div>
    </aside>

    <div class="lg:pl-64">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:hidden">
        <button type="button" class="text-slate-600" aria-label="Open menu" @click="sidebarOpen = true">
          <Menu class="size-6" />
        </button>
        <p class="font-semibold text-ink">{{ route.meta.title }}</p>
      </header>

      <div v-if="currentUser?.role === 'Viewer'" class="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-xs text-sky-800">
        You are signed in as a <b>Viewer</b>. You can see everything but can't make changes.
      </div>

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <router-view :key="route.path" />
      </main>
    </div>
  </div>
</template>
