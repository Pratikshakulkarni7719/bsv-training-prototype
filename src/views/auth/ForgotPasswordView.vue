<script setup>
import { ref } from 'vue'
import { ArrowLeft, Mail } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'

const email = ref('')
const error = ref('')
const sent = ref(false)

function submit() {
  error.value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) ? '' : 'Enter a valid email address.'
  if (!error.value) sent.value = true
}
</script>

<template>
  <AuthLayout>
    <router-link :to="{ name: 'login' }" class="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ArrowLeft class="size-4" /> Back to log in
    </router-link>

    <template v-if="!sent">
      <h1 class="text-2xl font-bold text-ink">Reset your password</h1>
      <p class="mt-1 text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
      <form class="mt-8 space-y-5" novalidate @submit.prevent="submit">
        <div>
          <label for="reset-email" class="label">Email</label>
          <input id="reset-email" v-model.trim="email" type="email" autocomplete="email" class="input" />
          <p v-if="error" class="error-text">{{ error }}</p>
        </div>
        <button type="submit" class="btn-primary w-full">Send reset link</button>
      </form>
    </template>

    <div v-else class="text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50">
        <Mail class="size-6 text-brand-600" />
      </span>
      <h1 class="mt-4 text-2xl font-bold text-ink">Check your email</h1>
      <p class="mt-2 text-sm text-slate-500">
        If an account exists for <b>{{ email }}</b>, you'll get a link to reset your password.
      </p>
    </div>
  </AuthLayout>
</template>
