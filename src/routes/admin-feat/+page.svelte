<script lang="ts">
  import { onMount } from 'svelte';
  import { adminStore } from '$lib/stores/admin';
  import AdminFeatSidebar from '$lib/components/admin-feat/AdminFeatSidebar.svelte';
  import LlmApiTester from '$lib/components/admin-feat/LlmApiTester.svelte';

  let isAdmin = $state(false);
  let activeTab = $state('llm-api-test');
  let isLoaded = $state(false);

  onMount(() => {
    const stored = localStorage.getItem('emotion-emoji-admin-mode');
    isAdmin = stored === 'true';
    isLoaded = true;

    if (!isAdmin) {
      window.location.href = '/';
      return;
    }

    return adminStore.subscribe((state) => {
      isAdmin = state.isAdmin;
    });
  });
</script>

<svelte:head>
  <title>管理工具 - 表情包网站</title>
</svelte:head>

{#if !isLoaded}
  <div class="bg-gray-50 flex items-center justify-center min-h-[calc(100vh-4rem)]">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">验证权限中...</p>
    </div>
  </div>
{:else if isAdmin}
  <div class="bg-gray-50 flex min-h-[calc(100vh-4rem)]">
    <AdminFeatSidebar bind:activeTab />

    <div class="flex-1 p-6 overflow-y-auto">
      {#if activeTab === 'llm-api-test'}
        <LlmApiTester />
      {/if}
    </div>
  </div>
{/if}
