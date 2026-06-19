<script lang="ts">
  let { activeTab = $bindable('llm-api-test') } = $props();

  const menuItems = [
    { id: 'llm-api-test', name: 'LLM 密钥管理', icon: 'key' },
    { id: 'chat', name: '模型对话', icon: 'chat' },
  ];
</script>

<nav class="p-4">
  <ul class="space-y-2">
    {#each menuItems as item}
      <li>
        <button
          onclick={() => (activeTab = item.id)}
          class="w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center gap-3
                   {activeTab === item.id
            ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-700'
            : 'text-gray-700 hover:bg-gray-100'}"
        >
          <!-- Key Icon -->
          {#if item.icon === 'key'}
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          {:else if item.icon === 'chat'}
            <!-- Chat Icon -->
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          {/if}
          <span class="font-medium">{item.name}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>
