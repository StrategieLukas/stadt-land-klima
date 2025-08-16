<template>
    <div class="card bg-white shadow-xl rounded-none overflow-hidden border-2 border-green">
      <div class="card-body p-6 flex flex-row items-center gap-6">

        <!-- Avatar Circle -->
        <div class="avatar">
          <div class="w-24 h-24 rounded-full bg-black flex-shrink-0">
            <img 
              v-if="avatarSrc" 
              :src="avatarSrc" 
              :alt="name"
              class="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>
        
        <!-- Content -->
        <div class="flex-1">
          <h2 class="text-2xl font-bold text-green mb-3">{{ $t("onboarding.title") }}</h2>
          <p class="text-gray-800 text-base mb-4">
            {{ $t("onboarding.book_appointment.long") }}
          </p>
          
          <!-- Button -->
          <div class="flex items-center gap-2 text-green">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="text-lg font-semibold">{{ $t("onboarding.book_appointment.short") }}</span>
          </div>
        </div>


      </div>
    </div>
</template>
  
<script setup>
  const { $t } = useNuxtApp();

  defineProps({
    avatarSrc: {
      type: String,
      default: ''
    },
    name: {
      type: String,
    }
  })
</script>