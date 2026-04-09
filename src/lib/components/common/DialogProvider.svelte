<script lang="ts">
  import { dialogStore, closeDialog } from '$lib/stores/dialogStore';
  import { browser } from '$app/environment';

  let state = $state({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    placeholder: '',
    confirmText: '确定',
    cancelText: '取消',
    value: ''
  });

  dialogStore.subscribe(s => {
    state = s as any;
  });

  let inputElement: HTMLInputElement;

  $effect(() => {
    if (state.isOpen && state.type === 'prompt' && browser) {
      setTimeout(() => {
        inputElement?.focus();
      }, 100);
    }
  });

  function handleConfirm() {
    closeDialog(state.type === 'prompt' ? state.value : true);
  }

  function handleCancel() {
    closeDialog(state.type === 'confirm' ? false : null);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if state.isOpen}
  <div 
    class="fixed inset-0 z-[300] flex items-center justify-center p-4" 
    style="background-color: rgba(0, 0, 0, 0.5);"
    onclick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 class="text-lg font-bold text-gray-900">{state.title}</h3>
        <button onclick={handleCancel} class="text-gray-400 hover:text-gray-600 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="p-6">
        <p class="text-gray-600 leading-relaxed whitespace-pre-wrap">{state.message}</p>
        
        {#if state.type === 'prompt'}
          <div class="mt-4">
            <input
              bind:this={inputElement}
              type="text"
              bind:value={state.value}
              onkeydown={handleKeydown}
              placeholder={state.placeholder}
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        {/if}
      </div>

      <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/30">
        {#if state.type !== 'alert'}
          <button
            onclick={handleCancel}
            class="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
          >
            {state.cancelText}
          </button>
        {/if}
        <button
          onclick={handleConfirm}
          class="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
        >
          {state.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes zoom-in {
    from { transform: scale(0.95); }
    to { transform: scale(1); }
  }
  .animate-in {
    animation: fade-in 0.2s ease-out, zoom-in 0.2s ease-out;
  }
</style>
