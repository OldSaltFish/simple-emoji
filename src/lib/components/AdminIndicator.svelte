<script lang="ts">
  import { adminStore } from '$lib/stores/admin';
  import { onMount } from 'svelte';

  let isAdmin = $state(false);
  
  onMount(() => {
    return adminStore.subscribe(state => {
      isAdmin = state.isAdmin;
    });
  });

  function disableAdminMode() {
    adminStore.disableAdminMode();
    adminStore.addMessage({
      type: 'info',
      content: '管理员模式已关闭',
      duration: 2000
    });
  }
</script>

{#if isAdmin}
  <div class="fixed top-4 left-4 z-40 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg animate-pulse flex items-center gap-2">
    <span>管理员模式</span>
    <button 
      on:click={disableAdminMode}
      class="hover:bg-red-700 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
      title="退出管理员模式"
    >
      ×
    </button>
  </div>
{/if}