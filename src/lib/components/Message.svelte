<script lang="ts">
  import { adminStore, type Message } from '$lib/stores/admin';
  import { onMount } from 'svelte';

  let messages = $state<Message[]>([]);
  
  onMount(() => {
    return adminStore.subscribe(state => {
      messages = state.messages;
    });
  });

  function removeMessage(id: string) {
    adminStore.removeMessage(id);
  }

  function getMessageStyles(type: Message['type']) {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-400 text-green-700';
      case 'error':
        return 'bg-red-100 border-red-400 text-red-700';
      case 'warning':
        return 'bg-yellow-100 border-yellow-400 text-yellow-700';
      case 'info':
      default:
        return 'bg-blue-100 border-blue-400 text-blue-700';
    }
  }
</script>

{#if messages.length > 0}
  <div class="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
    {#each messages as message (message.id)}
      <div 
        class="border px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out animate-in slide-in-from-right"
        class:getMessageStyles(message.type)
        role="alert"
      >
        <div class="flex items-center justify-between">
          <span class="block sm:inline">{message.content}</span>
          <button 
            onclick={() => removeMessage(message.id)}
            class="ml-4 text-lg leading-none hover:opacity-70"
            aria-label="关闭消息"
          >
            ×
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}