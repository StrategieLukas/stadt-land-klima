<template>
  <private-view title="Personen einladen">
    <div class="role-invitations">
      <InvitationForm endpoint="/role-invitations/invite" :select-role="true" />
    </div>
  </private-view>
</template>
<script setup lang="ts">
import InvitationForm from "../shared/InvitationForm.vue";
</script>
<style scoped>
.role-invitations {
  padding: 24px;
  max-width: 1000px;
}
</style>
