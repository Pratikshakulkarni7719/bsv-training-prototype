import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { isLoggedIn, setLoggedIn } from '@/data/auth'
import { can, currentUser, toast } from '@/data/store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { public: true, title: 'Log in' } },
    { path: '/verify-otp', name: 'otp', component: () => import('@/views/auth/OtpView.vue'), meta: { public: true, title: 'Verify OTP' } },
    { path: '/forgot-password', name: 'forgotPassword', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { public: true, title: 'Forgot password' } },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard' } },
        { path: 'employees', name: 'employees', component: () => import('@/views/StaffView.vue'), meta: { title: 'Employees' } },
        { path: 'staff', redirect: { name: 'employees' } },
        // Phase 2: groups (team / business-unit targeting). Disabled for Phase 1.
        // { path: 'groups', name: 'groups', component: () => import('@/views/GroupsView.vue'), meta: { title: 'Groups' } },
        { path: 'videos', name: 'videos', component: () => import('@/views/VideosView.vue'), meta: { title: 'Video library' } },
        { path: 'templates', name: 'templates', component: () => import('@/views/TemplatesView.vue'), meta: { title: 'Templates' } },
        { path: 'templates/new', name: 'templateCreate', component: () => import('@/views/TemplateCreateView.vue'), meta: { title: 'New template', permission: 'content' } },
        { path: 'templates/:id/edit', name: 'templateEdit', component: () => import('@/views/TemplateCreateView.vue'), meta: { title: 'Edit template', permission: 'content' } },
        { path: 'knowledge-base', name: 'knowledgeBase', component: () => import('@/views/KnowledgeBaseView.vue'), meta: { title: 'Knowledge base' } },
        { path: 'campaigns', name: 'campaigns', component: () => import('@/views/CampaignsView.vue'), meta: { title: 'Campaigns' } },
        { path: 'campaigns/new', name: 'campaignCreate', component: () => import('@/views/CampaignCreateView.vue'), meta: { title: 'New campaign', permission: 'campaigns' } },
        { path: 'campaigns/:id/edit', name: 'campaignEdit', component: () => import('@/views/CampaignCreateView.vue'), meta: { title: 'Edit campaign', permission: 'campaigns' } },
        { path: 'campaigns/:id', name: 'campaignDetail', component: () => import('@/views/CampaignDetailView.vue'), meta: { title: 'Campaign' } },
        { path: 'queries', name: 'queries', component: () => import('@/views/InboxView.vue'), meta: { title: 'Employee queries' } },
        { path: 'inbox', redirect: { name: 'queries' } },
        { path: 'insights', name: 'insights', component: () => import('@/views/InsightsView.vue'), meta: { title: 'Reports & insights' } },
        { path: 'simulator', name: 'simulator', component: () => import('@/views/SimulatorView.vue'), meta: { title: 'WhatsApp simulator' } },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: 'Settings', permission: 'settings' } },
        { path: 'setup-guide', name: 'setupGuide', component: () => import('@/views/SetupGuideView.vue'), meta: { title: 'Setup guide' } }
      ]
    },
    { path: '/:pathMatch(.*)*', name: 'notFound', component: () => import('@/views/NotFoundView.vue'), meta: { public: true, title: 'Page not found' } }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  document.title = `${to.meta.title ?? 'BSV Compliance'} | BSV Compliance Connect`
  if (to.meta.public) {
    if ((to.name === 'login' || to.name === 'otp') && isLoggedIn() && currentUser.value) return { name: 'dashboard' }
    return
  }
  if (!isLoggedIn()) return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  // The account was removed from the team after logging in
  if (!currentUser.value) {
    setLoggedIn('')
    toast('Your account no longer has access. Ask an admin to add you again.', 'error')
    return { name: 'login' }
  }
  if (to.meta.permission && !can(to.meta.permission)) {
    toast(`Your role (${currentUser.value.role}) can't open "${to.meta.title}".`, 'error')
    return { name: 'dashboard' }
  }
})

export default router
