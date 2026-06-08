<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import "@unocss/reset/tailwind-v4.css";
  import "virtual:uno.css";
  import "./style.css";
  import Message from "$lib/components/Message.svelte";
  import AdminIndicator from "$lib/components/AdminIndicator.svelte";
  import KonamiCodeListener from "$lib/components/KonamiCodeListener.svelte";
  import MessageProvider from "$lib/components/common/MessageProvider.svelte";
  import DialogProvider from "$lib/components/common/DialogProvider.svelte";
  import { adminStore } from "$lib/stores/admin";
  import { page } from '$app/state';
  let { children } = $props();
  let isAdmin = $state(false);

  // 监听管理员状态
  adminStore.subscribe((state) => {
    isAdmin = state.isAdmin;
  });

  // 判断当前路径是否激活
  function isActive(path: string) {
    if (path === "/") {
      return page.url.pathname === "/";
    }
    return page.url.pathname.startsWith(path);
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>
<MessageProvider />
<DialogProvider />
<KonamiCodeListener />
<Message />
<AdminIndicator />

<!-- 头部导航 -->
<header class="bg-white h-16 border-b border-gray-200 sticky top-0 z-50">
  <div class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center h-16 gap-4">
      <!-- Logo -->
      <h1 class="text-xl font-bold text-gray-900 shrink-0">魂祈梦</h1>

      <!-- 游客功能导航：所有屏幕可见 -->
      <nav class="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5 flex-wrap overflow-x-auto">
        <a
          href="/recent"
          class="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap {isActive('/recent')
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'}">表情包</a
        >
        <a
          href="/scripts"
          class="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap {isActive('/scripts')
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'}">脚本分享</a
        >
        <a
          href="/tools/codec-support"
          class="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap {isActive('/tools')
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'}">工具集</a
        >
      </nav>

      <!-- 管理链接：仅宽屏显示 -->
      {#if isAdmin}
        <nav class="hidden lg:flex items-center gap-1 ml-auto pl-4 border-l border-gray-200 shrink-0">
          <a
            href="/upload"
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap {isActive('/upload')
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}">上传</a
          >
          <a
            href="/test"
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap text-gray-400 hover:text-gray-600"
            >test</a
          >
          <a
            href="/admin"
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap {isActive('/admin')
              ? 'bg-red-50 text-red-600 shadow-sm'
              : 'text-red-500 hover:text-red-700'}">管理后台</a
          >
        </nav>
      {/if}
    </div>
  </div>
</header>

{@render children()}
