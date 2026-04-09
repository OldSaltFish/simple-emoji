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
  import { page } from "$app/state";
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
<header class="bg-white h-64px border-b border-gray-200 sticky top-0 z-50">
  <div class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center gap-8">
        <h1 class="text-xl font-bold text-gray-900">表情包网站</h1>
        <nav class="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
          <a
            href="/"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {isActive(
              '/',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}">图集</a
          >
          <a
            href="/recent"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {isActive(
              '/recent',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}">最近</a
          >
          <a
            href="/snippets"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {isActive(
              '/snippets',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}">代码片段</a
          >
          <a
            href="/test/api-tester"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {isActive(
              '/test/api-tester',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}">API 测试</a
          >
          {#if isAdmin}
            <a
              href="/upload"
              class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {isActive(
                '/upload',
              )
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}">上传</a
            >
            <a
              href="/test"
              class="px-4 py-1.5 text-sm font-medium rounded-md transition-all text-gray-400 hover:text-gray-600"
              >test</a
            >
          {/if}
          {#if isAdmin}
            <a
              href="/admin"
              class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {isActive(
                '/admin',
              )
                ? 'bg-red-50 text-red-600 shadow-sm'
                : 'text-red-500 hover:text-red-700'}">管理后台</a
            >
          {/if}
        </nav>
      </div>

      <!-- 移动端导航 -->
      <nav class="md:hidden flex items-center bg-gray-100 rounded-lg p-1">
          <a
            href="/"
            class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
              '/',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600'}">图集</a
          >
          <a
            href="/recent"
            class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
              '/recent',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600'}">最近</a
          >
          <a
            href="/snippets"
            class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
              '/snippets',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600'}">代码</a
          >
          <a
            href="/test/api-tester"
            class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
              '/test/api-tester',
            )
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600'}">API测试</a
          >
          {#if isAdmin}
            <a
              href="/upload"
              class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
                '/upload',
              )
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600'}">上传</a
            >
            <a
              href="/test"
              class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
                '/test',
              )
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600'}">test</a
            >
          {/if}
          {#if isAdmin}
            <a
              href="/admin"
              class="px-3 py-1 text-sm font-medium rounded-md transition-all {isActive(
                '/admin',
              )
                ? 'bg-red-50 text-red-600 shadow-sm'
                : 'text-red-500'}">管理</a
            >
          {/if}
        </nav>
    </div>
  </div>
</header>

{@render children()}
