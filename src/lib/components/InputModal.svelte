<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  interface Props {
    isOpen?: boolean;
    title?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (value: string) => void;
    onCancel?: () => void;
  }

  let {
    isOpen = $bindable(false),
    title = '输入',
    placeholder = '请输入',
    confirmText = '确定',
    cancelText = '取消',
    onConfirm,
    onCancel
  } = $props();

  let inputValue = $state('');
  let inputElement: HTMLInputElement;

  function handleConfirm() {
    if (onConfirm) {
      onConfirm(inputValue);
    }
    inputValue = '';
    isOpen = false;
  }

  function handleCancel() {
    inputValue = '';
    if (onCancel) {
      onCancel();
    }
    isOpen = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }

  $effect(() => {
    if (isOpen && browser) {
      setTimeout(() => {
        inputElement?.focus();
      }, 100);
    }
  });
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
    onclick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div class="p-6">
        <input
          bind:this={inputElement}
          type="text"
          bind:value={inputValue}
          onkeydown={handleKeydown}
          {placeholder}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
        />
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onclick={handleCancel}
          class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {cancelText}
        </button>
        <button
          onclick={handleConfirm}
          disabled={!inputValue.trim()}
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
