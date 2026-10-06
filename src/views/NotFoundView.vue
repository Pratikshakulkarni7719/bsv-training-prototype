<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 text-center">
    <p class="text-6xl font-bold text-brand-600">404</p>
    <h1 class="mt-4 text-2xl font-bold text-ink">Page not found</h1>
    <p class="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
    <router-link :to="{ name: 'dashboard' }" class="btn-primary mt-6">Go to dashboard</router-link>
  </div>
</template>
