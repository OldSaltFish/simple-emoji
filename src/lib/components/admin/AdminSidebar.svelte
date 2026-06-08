<script lang="ts">
  let { activeTab = 'interfaces', onTabChange } = $props();

  const menuItems = [
    { id: 'interfaces', name: '接口管理', icon: '🔗' },
    { id: 'categories', name: '图集管理', icon: '📁' },
    { id: 'check-in', name: '签到管理', icon: '✅' },
    { id: 'llm-api-test', name: '密钥管理', icon: '🔑' },
    { id: 'chat', name: '模型聊天', icon: '💬' }
  ];

  function handleTabClick(tabId: string) {
    if (tabId === activeTab) return;
    onTabChange?.(tabId);
  }
</script>

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
              ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
              : 'text-gray-700 hover:bg-gray-100'}"
          >
            <span class="text-lg">{item.icon}</span>
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
            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
            : 'text-gray-700 hover:bg-gray-100'}"
        >
          <span class="text-xl">{item.icon}</span>
          <span class="font-medium">{item.name}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>
