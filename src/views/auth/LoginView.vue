<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { setPendingEmail } from '@/data/auth'
import { store, toast } from '@/data/store'

const router = useRouter()
const route = useRoute()
const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const showPassword = ref(false)
const loading = ref(false)

function validate() {
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : 'Enter a valid email address.'
  errors.password = form.password.length >= 6 ? '' : 'Password must be at least 6 characters.'
  if (!errors.email && !store.settings.team.some((m) => m.email.toLowerCase() === form.email.toLowerCase())) {
    errors.email = 'No admin account uses this email. Ask an admin to invite you.'
  }
  return !errors.email && !errors.password
}

function useDemo(member) {
  form.email = member.email
  form.password = 'password'
  Object.assign(errors, { email: '', password: '' })
}

function submit() {
  if (!validate()) return
  loading.value = true
  // Simulate the API call that sends the OTP
  setTimeout(() => {
    loading.value = false
    setPendingEmail(form.email)
    toast('We sent a 6-digit code to your email.')
    router.push({ name: 'otp', query: route.query })
  }, 700)
}
</script>

<template>
  <AuthLayout>
    <h1 class="text-2xl font-bold text-ink">Log in</h1>
    <p class="mt-1 text-sm text-slate-500">Compliance team admin portal.</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="submit">
      <div>
        <label for="email" class="label">Email</label>
        <input id="email" v-model.trim="form.email" type="email" autocomplete="email" class="input" />
        <p v-if="errors.email" class="error-text">{{ errors.email }}</p>
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label for="password" class="label">Password</label>
          <router-link :to="{ name: 'forgotPassword' }" class="mb-1.5 text-sm font-medium text-brand-700 hover:underline">Forgot password?</router-link>
        </div>
        <div class="relative">
          <input
            id="password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            class="input pr-10"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-4" />
            <Eye v-else class="size-4" />
          </button>
        </div>
        <p v-if="errors.password" class="error-text">{{ errors.password }}</p>
      </div>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        <Loader2 v-if="loading" class="size-4 animate-spin" />
        {{ loading ? 'Sending code...' : 'Continue' }}
      </button>
    </form>

    <div class="mt-8 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
      <p class="font-semibold text-slate-700">Demo accounts (any 6+ character password, OTP 123456)</p>
      <ul class="mt-2 space-y-1">
        <li v-for="m in store.settings.team" :key="m.email">
          <button type="button" class="w-full rounded px-2 py-1 text-left hover:bg-white" @click="useDemo(m)">
            <span class="font-medium text-slate-800">{{ m.email }}</span> · {{ m.role }}
          </button>
        </li>
      </ul>
    </div>
  </AuthLayout>
</template>
