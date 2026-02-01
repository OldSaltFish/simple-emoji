<script lang="ts">
  let { activeTab = $bindable('interfaces') } = $props();

  const menuItems = [
    { id: 'interfaces', name: '接口管理', icon: '🔗' },
    { id: 'images', name: '图片管理', icon: '🖼️' },
    { id: 'settings', name: '系统设置', icon: '⚙️' }
  ];
</script>

<div class="w-64 bg-white shadow-lg h-screen">
  <div class="p-6 border-b border-gray-200">
    <h1 class="text-xl font-bold text-gray-900">管理后台</h1>
  </div>
  
  <nav class="p-4">
    <ul class="space-y-2">
      {#each menuItems as item}
        <li>
          <button
            on:click={() => activeTab = item.id}
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
</div>