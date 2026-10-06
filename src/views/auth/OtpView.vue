<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { DEMO_OTP, clearPendingEmail, getPendingEmail, setLoggedIn } from '@/data/auth'
import { audit, toast } from '@/data/store'

const router = useRouter()
const route = useRoute()
const email = getPendingEmail()
const digits = ref(['', '', '', '', '', ''])
const inputs = ref([])
const error = ref('')
const loading = ref(false)
const secondsLeft = ref(30)
let timer = null

const code = computed(() => digits.value.join(''))

onMounted(() => {
  if (!email) {
    router.replace({ name: 'login' })
    return
  }
  startTimer()
  nextTick(() => inputs.value[0]?.focus())
})

onBeforeUnmount(() => clearInterval(timer))

function startTimer() {
  secondsLeft.value = 30
  clearInterval(timer)
  timer = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value--
    else clearInterval(timer)
  }, 1000)
}

function onInput(i, e) {
  const value = e.target.value.replace(/\D/g, '')
  if (value.length === 6) {
    // Pasted a whole code
    value.split('').forEach((d, j) => (digits.value[j] = d))
    inputs.value[5]?.focus()
  } else {
    // Typing into a filled box replaces its digit
    digits.value[i] = value.slice(-1)
    e.target.value = digits.value[i]
    if (digits.value[i] && i < 5) inputs.value[i + 1]?.focus()
  }
  error.value = ''
}

function onKeydown(i, e) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) inputs.value[i - 1]?.focus()
}

function verify() {
  if (code.value.length !== 6) {
    error.value = 'Enter all 6 digits.'
    return
  }
  loading.value = true
  setTimeout(() => {
    loading.value = false
    if (code.value !== DEMO_OTP) {
      error.value = 'That code is not correct. Try 123456.'
      return
    }
    setLoggedIn(email)
    clearPendingEmail()
    audit('Logged in')
    toast('Logged in successfully.')
    router.push(typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'dashboard' })
  }, 600)
}

function resend() {
  startTimer()
  toast('A new code has been sent.')
}
</script>

<template>
  <AuthLayout>
    <router-link :to="{ name: 'login' }" class="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ArrowLeft class="size-4" /> Back to log in
    </router-link>
    <h1 class="text-2xl font-bold text-ink">Check your email</h1>
    <p class="mt-1 text-sm text-slate-500">
      We sent a 6-digit code to <span class="font-medium text-slate-700">{{ email }}</span>.
    </p>

    <form class="mt-8" novalidate @submit.prevent="verify">
      <fieldset>
        <legend class="label">Verification code</legend>
        <div class="flex gap-2">
          <input
            v-for="(d, i) in digits"
            :key="i"
            :ref="(el) => (inputs[i] = el)"
            :value="d"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            :aria-label="`Digit ${i + 1}`"
            :class="[
              'input h-12 w-12 text-center text-lg font-semibold',
              error ? 'ring-red-400' : ''
            ]"
            @input="onInput(i, $event)"
            @keydown="onKeydown(i, $event)"
          />
        </div>
      </fieldset>
      <p v-if="error" class="error-text">{{ error }}</p>

      <button type="submit" class="btn-primary mt-6 w-full" :disabled="loading">
        <Loader2 v-if="loading" class="size-4 animate-spin" />
        {{ loading ? 'Verifying...' : 'Verify and log in' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-slate-500">
      Didn't get it?
      <button
        v-if="secondsLeft === 0"
        type="button"
        class="font-medium text-brand-700 hover:underline"
        @click="resend"
      >
        Resend code
      </button>
      <span v-else>Resend in {{ secondsLeft }}s</span>
    </p>
  </AuthLayout>
</template>
