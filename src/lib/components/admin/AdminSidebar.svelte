<script lang="ts">
  let { activeTab = 'interfaces', onTabChange } = $props();

  const menuItems = [
    { id: 'interfaces', name: '接口管理', icon: 'link' },
    { id: 'categories', name: '图集管理', icon: 'folder' },
    { id: 'check-in', name: '签到管理', icon: 'check' },
    { id: 'llm-api-test', name: '密钥管理', icon: 'key' },
    { id: 'chat', name: '模型聊天', icon: 'chat' }
  ];

  function handleTabClick(tabId: string) {
    if (tabId === activeTab) return;
    onTabChange?.(tabId);
  }
</script>

<!-- SVG Icons as reusable blocks (inline to avoid component overhead) -->
{#snippet linkIcon()}
  <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
{/snippet}
{#snippet folderIcon()}
  <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
{/snippet}
{#snippet checkIcon()}
  <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
{/snippet}
{#snippet keyIcon()}
  <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
{/snippet}
{#snippet chatIcon()}
  <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
{/snippet}

<nav class="p-4">
  <div class="mb-4">
    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2">表情包管理</h3>
    <ul class="space-y-1">
      {#each menuItems.slice(0, 2) as item}
        <li>
          <button
            onclick={() => handleTabClick(item.id)}
            class="w-full text-left px-4 py-2.5 rounded-lg transition-colors duration-200 flex items-center gap-3
                     {activeTab === item.id
              ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-700'
              : 'text-gray-700 hover:bg-gray-100'}"
          >
            {#if item.icon === 'link'}{@render linkIcon()}
            {:else if item.icon === 'folder'}{@render folderIcon()}{/if}
            <span class="font-medium text-sm">{item.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <ul class="space-y-2">
    {#each menuItems.slice(2) as item}
      <li>
        <button
          onclick={() => handleTabClick(item.id)}
          class="w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center gap-3
                   {activeTab === item.id
            ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-700'
            : 'text-gray-700 hover:bg-gray-100'}"
        >
          {#if item.icon === 'check'}{@render checkIcon()}
          {:else if item.icon === 'key'}{@render keyIcon()}
          {:else if item.icon === 'chat'}{@render chatIcon()}{/if}
          <span class="font-medium">{item.name}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>
