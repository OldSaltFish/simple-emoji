<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import { adminStore } from '$lib/stores/admin';
  import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';
  import InterfaceManagement from '$lib/components/admin/InterfaceManagement.svelte';
  import CategoryManagement from '$lib/components/admin/CategoryManagement.svelte';
  import CheckInManagement from '$lib/components/admin/CheckInManagement.svelte';

  let isAdmin = $state(false);
  let activeTab = $state('interfaces');
  let isLoaded = $state(false);

  const VALID_TABS = ['interfaces', 'categories', 'check-in'] as const;

  function syncUrl() {
    const params = new URLSearchParams($page.url.searchParams);
    if (activeTab !== 'interfaces') {
      params.set('tab', activeTab);
    } else {
      params.delete('tab');
    }
    const newUrl = `${$page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    replaceState(newUrl, $page.state);
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
    syncUrl();
  }

  onMount(() => {
    // 从URL读取tab状态
    const urlTab = $page.url.searchParams.get('tab') || '';
    if (VALID_TABS.includes(urlTab as any)) {
      activeTab = urlTab;
    }

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
  <title>管理后台 - 魂祈梦</title>
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
    <AdminSidebar {activeTab} onTabChange={handleTabChange} />

    <!-- 主内容区域 -->
    <div class="flex-1 p-6 overflow-y-auto">
      {#if activeTab === 'interfaces'}
        <InterfaceManagement />
      {:else if activeTab === 'categories'}
        <CategoryManagement />
      {:else if activeTab === 'check-in'}
        <CheckInManagement />
      {/if}
    </div>
  </div>
{/if}
