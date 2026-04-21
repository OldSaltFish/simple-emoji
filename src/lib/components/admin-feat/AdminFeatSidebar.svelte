<script lang="ts">
  let { activeTab = $bindable('llm-api-test') } = $props();

  const menuItems = [
    { id: 'llm-api-test', name: 'LLM API 测试', icon: '🤖' },
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
