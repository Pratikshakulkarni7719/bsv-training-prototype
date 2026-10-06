<script setup>
import { computed, reactive, ref } from 'vue'
import { Upload, Play, Trash2, Pencil, Video, Loader2, CircleAlert, Info, Search, FileVideo } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { store, nextId, toast, audit, can, stamp, formatStamp, videoUsage, MAX_VIDEO_MB } from '@/data/store'

const thumbs = ['from-emerald-400 to-teal-600', 'from-sky-400 to-indigo-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-pink-600', 'from-violet-400 to-purple-600']
const canEdit = computed(() => can('content'))

// Real uploads play from memory for this session only (a server would store the file)
const objectUrls = reactive({})

const search = ref('')
const list = computed(() => store.videos.filter((v) => v.title.toLowerCase().includes(search.value.trim().toLowerCase())))

const previewing = ref(null)

/* Upload ------------------------------------------------------------- */
const uploadOpen = ref(false)
const fileInput = ref(null)
const upload = reactive({ title: '', file: null, progress: 0, uploading: false, error: '', warning: '' })

const sampleFiles = [
  { name: 'doctor_visit_scenario.mp4', type: 'video/mp4', sizeMb: 7.6, seconds: 48 },
  { name: 'vendor_meeting.mov', type: 'video/quicktime', sizeMb: 12.1, seconds: 55 },
  { name: 'full_training_session.mp4', type: 'video/mp4', sizeMb: 24.3, seconds: 130 }
]

function openUpload() {
  Object.assign(upload, { title: '', file: null, progress: 0, uploading: false, error: '', warning: '' })
  uploadOpen.value = true
}

function duration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

function check(f) {
  upload.file = f
  upload.error = ''
  upload.warning = ''
  if (f.type !== 'video/mp4') upload.error = 'Only MP4 videos can be sent on WhatsApp. Convert the file to MP4 first.'
  else if (f.sizeMb > MAX_VIDEO_MB) upload.error = `This file is ${f.sizeMb} MB. WhatsApp allows up to ${MAX_VIDEO_MB} MB. Shorten or compress it.`
  else if (f.seconds > 90) upload.warning = 'Videos longer than 90 seconds get fewer views. Keep scenarios short.'
  if (!upload.error && !upload.title) upload.title = f.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function onFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  const f = { name: file.name, type: file.type, sizeMb: Math.round((file.size / 1048576) * 10) / 10, seconds: 0, url: URL.createObjectURL(file) }
  // Read the real duration from the file
  const probe = document.createElement('video')
  probe.preload = 'metadata'
  probe.onloadedmetadata = () => {
    f.seconds = Number.isFinite(probe.duration) ? probe.duration : 0
    check(f)
  }
  probe.onerror = () => {
    upload.file = f
    upload.error = 'This file could not be read as a video.'
  }
  probe.src = f.url
}

function startUpload() {
  if (!upload.file || upload.error) return
  const title = upload.title.trim()
  if (!title) {
    upload.error = 'Give the video a title.'
    return
  }
  if (store.videos.some((v) => v.title.toLowerCase() === title.toLowerCase())) {
    upload.error = 'A video with this title already exists.'
    return
  }
  upload.uploading = true
  const timer = setInterval(() => {
    upload.progress += 20
    if (upload.progress < 100) return
    clearInterval(timer)
    const id = nextId(store.videos)
    store.videos.unshift({
      id,
      title,
      duration: duration(upload.file.seconds),
      sizeMb: upload.file.sizeMb,
      uploadedAt: stamp(),
      thumb: thumbs[id % thumbs.length]
    })
    if (upload.file.url) objectUrls[id] = upload.file.url
    audit(`Uploaded video "${title}"`)
    uploadOpen.value = false
    toast('Video uploaded.')
  }, 250)
}

/* Rename ------------------------------------------------------------- */
const renaming = ref(null)
const newTitle = ref('')
const renameError = ref('')
function openRename(v) {
  renaming.value = v
  newTitle.value = v.title
  renameError.value = ''
}
function saveRename() {
  const t = newTitle.value.trim()
  if (!t) return (renameError.value = 'Title is required.')
  if (store.videos.some((v) => v.id !== renaming.value.id && v.title.toLowerCase() === t.toLowerCase())) return (renameError.value = 'Another video has this title.')
  renaming.value.title = t
  audit(`Renamed a video to "${t}"`)
  renaming.value = null
  toast('Video renamed.')
}

/* Delete ------------------------------------------------------------- */
const deleting = ref(null)
function confirmDelete() {
  store.videos = store.videos.filter((v) => v.id !== deleting.value.id)
  audit(`Deleted video "${deleting.value.title}"`)
  toast('Video deleted.')
  deleting.value = null
}
</script>

<template>
  <PageHeader title="Video library" :subtitle="`Short scenario clips for video campaigns. MP4, up to ${MAX_VIDEO_MB} MB (about 1 minute).`">
    <template #actions>
      <button v-if="canEdit" type="button" class="btn-primary" @click="openUpload"><Upload class="size-4" /> Upload video</button>
    </template>
  </PageHeader>

  <div v-if="store.videos.length" class="relative mb-4 max-w-sm">
    <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    <input v-model="search" type="search" placeholder="Search videos" aria-label="Search videos" class="input pl-9" />
  </div>

  <div v-if="list.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <div v-for="v in list" :key="v.id" class="card overflow-hidden">
      <button type="button" :class="['relative flex h-40 w-full items-center justify-center bg-linear-to-br', v.thumb]" :aria-label="`Play ${v.title}`" @click="previewing = v">
        <span class="flex size-12 items-center justify-center rounded-full bg-black/40 transition hover:bg-black/60"><Play class="size-6 fill-white text-white" /></span>
        <span class="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">{{ v.duration }}</span>
      </button>
      <div class="p-4">
        <p class="font-medium text-slate-800">{{ v.title }}</p>
        <p class="mt-1 text-xs text-slate-500">
          {{ v.sizeMb }} MB · {{ formatStamp(v.uploadedAt, false) }} · Used in {{ videoUsage(v.id) }} campaign{{ videoUsage(v.id) === 1 ? '' : 's' }}
        </p>
        <div v-if="canEdit" class="mt-3 flex justify-end gap-1">
          <button type="button" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" :aria-label="`Rename ${v.title}`" title="Rename" @click="openRename(v)"><Pencil class="size-4" /></button>
          <button
            type="button"
            class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="videoUsage(v.id) > 0"
            :title="videoUsage(v.id) > 0 ? 'Used in a campaign, so it cannot be deleted' : 'Delete'"
            :aria-label="`Delete ${v.title}`"
            @click="deleting = v"
          >
            <Trash2 class="size-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card">
    <EmptyState v-if="store.videos.length" :icon="Search" title="No videos match" text="Try a different search." />
    <EmptyState v-else :icon="Video" title="No videos yet" text="Upload a short scenario clip to use in a video campaign.">
      <button v-if="canEdit" type="button" class="btn-primary" @click="openUpload"><Upload class="size-4" /> Upload video</button>
    </EmptyState>
  </div>

  <!-- Preview -->
  <BaseModal :open="!!previewing" :title="previewing?.title ?? ''" size="lg" @close="previewing = null">
    <video v-if="previewing && objectUrls[previewing.id]" :src="objectUrls[previewing.id]" controls autoplay class="aspect-video w-full rounded-lg bg-black" />
    <div v-else :class="['flex aspect-video items-center justify-center rounded-lg bg-linear-to-br', previewing?.thumb]">
      <p class="rounded-lg bg-black/40 px-4 py-2 text-sm text-white">Sample video · {{ previewing?.duration }}</p>
    </div>
  </BaseModal>

  <!-- Upload -->
  <BaseModal :open="uploadOpen" title="Upload video" @close="!upload.uploading && (uploadOpen = false)">
    <div class="space-y-4">
      <input ref="fileInput" type="file" accept="video/*" class="sr-only" @change="onFile" />
      <button
        type="button"
        class="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-brand-500 hover:bg-brand-50/40"
        :disabled="upload.uploading"
        @click="fileInput.click()"
      >
        <FileVideo class="size-9 text-slate-400" />
        <p class="mt-2 text-sm font-medium text-slate-700">{{ upload.file ? upload.file.name : 'Choose a video from your computer' }}</p>
        <p v-if="upload.file" class="mt-1 text-xs text-slate-500">{{ upload.file.sizeMb }} MB<template v-if="upload.file.seconds"> · {{ duration(upload.file.seconds) }}</template></p>
      </button>
      <details class="text-sm">
        <summary class="cursor-pointer text-xs font-medium text-slate-500">No video handy? Try a sample file to see the checks</summary>
        <div class="mt-2 space-y-2">
          <button
            v-for="f in sampleFiles"
            :key="f.name"
            type="button"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ring-1 ring-slate-200 hover:bg-slate-50"
            :disabled="upload.uploading"
            @click="check(f)"
          >
            <span class="font-medium text-slate-700">{{ f.name }}</span>
            <span class="text-xs text-slate-500">{{ f.sizeMb }} MB · {{ duration(f.seconds) }}</span>
          </button>
        </div>
      </details>
      <p v-if="upload.error" class="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><CircleAlert class="mt-0.5 size-4 shrink-0" /> {{ upload.error }}</p>
      <p v-else-if="upload.warning" class="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><Info class="mt-0.5 size-4 shrink-0" /> {{ upload.warning }}</p>
      <div>
        <label for="video-title" class="label">Title</label>
        <input id="video-title" v-model="upload.title" class="input" maxlength="80" :disabled="upload.uploading" />
      </div>
      <div v-if="upload.uploading">
        <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full bg-brand-600 transition-all" :style="{ width: `${upload.progress}%` }" /></div>
        <p class="mt-1 text-xs text-slate-500">Uploading and checking format... {{ upload.progress }}%</p>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" :disabled="upload.uploading" @click="uploadOpen = false">Cancel</button>
      <button type="button" class="btn-primary" :disabled="!upload.file || !!upload.error || upload.uploading" @click="startUpload">
        <Loader2 v-if="upload.uploading" class="size-4 animate-spin" /> Upload
      </button>
    </template>
  </BaseModal>

  <!-- Rename -->
  <BaseModal :open="!!renaming" title="Rename video" size="sm" @close="renaming = null">
    <label for="rename" class="label">Title</label>
    <input id="rename" v-model="newTitle" class="input" maxlength="80" @keyup.enter="saveRename" />
    <p v-if="renameError" class="error-text">{{ renameError }}</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="renaming = null">Cancel</button>
      <button type="button" class="btn-primary" @click="saveRename">Save</button>
    </template>
  </BaseModal>

  <!-- Delete -->
  <BaseModal :open="!!deleting" title="Delete video" size="sm" @close="deleting = null">
    <p class="text-sm text-slate-600">Delete <b>{{ deleting?.title }}</b>? This can't be undone.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="deleting = null">Cancel</button>
      <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
    </template>
  </BaseModal>
</template>
