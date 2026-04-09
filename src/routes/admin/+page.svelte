<script lang="ts">
  import { onMount } from 'svelte';
  import { adminStore } from '$lib/stores/admin';
  import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';
  import InterfaceManagement from '$lib/components/admin/InterfaceManagement.svelte';
  import CategoryManagement from '$lib/components/admin/CategoryManagement.svelte';
  import TagManagement from '$lib/components/admin/TagManagement.svelte';
  import SnippetTagManagement from '$lib/components/admin/SnippetTagManagement.svelte';

  let isAdmin = $state(false);
  let activeTab = $state('interfaces');
  let isLoaded = $state(false);

  onMount(() => {
    // 直接从localStorage读取状态，避免store订阅延迟
    const stored = localStorage.getItem('emotion-emoji-admin-mode');
    isAdmin = stored === 'true';
    isLoaded = true;
    
    // 如果不是管理员，立即重定向
    if (!isAdmin) {
      window.location.href = '/';
      return;
    }
    
    // 订阅store以保持状态同步
    return adminStore.subscribe(state => {
      isAdmin = state.isAdmin;
    });
  });
</script>

<svelte:head>
  <title>管理后台 - 表情包网站</title>
</svelte:head>

{#if !isLoaded}
  <!-- 加载中 -->
  <div class="bg-gray-50 flex items-center justify-center min-h-[calc(100vh-4rem)]">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">验证权限中...</p>
    </div>
  </div>
{:else if isAdmin}
  <div class="bg-gray-50 flex min-h-[calc(100vh-4rem)]">
    <!-- 侧边栏 -->
    <AdminSidebar bind:activeTab />
    
    <!-- 主内容区域 -->
    <div class="flex-1 p-6 overflow-y-auto">
      {#if activeTab === 'interfaces'}
        <InterfaceManagement />
      {:else if activeTab === 'categories'}
        <CategoryManagement />
      {:else if activeTab === 'tags'}
        <TagManagement />
      {:else if activeTab === 'snippet-tags'}
        <SnippetTagManagement />
      {:else if activeTab === 'images'}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-2xl font-bold mb-4">图片管理</h2>
          <p class="text-gray-600">图片管理功能开发中...</p>
        </div>
      {:else if activeTab === 'settings'}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-2xl font-bold mb-4">系统设置</h2>
          <p class="text-gray-600">系统设置功能开发中...</p>
        </div>
      {/if}
    </div>
  </div>
{/if}
