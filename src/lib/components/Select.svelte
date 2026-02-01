<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  interface Option {
    value: string;
    label: string;
  }

  let {
    options = $bindable([]),
    value = $bindable(''),
    placeholder = $bindable('请选择'),
    onChange = $bindable<(value: string) => void>(),
    class: className = ''
  } = $props();

  let isOpen = $state(false);
  let selectedLabel = $derived(options.find(opt => opt.value === value)?.label || placeholder);
  let selectElement: HTMLDivElement;

  function handleSelect(optionValue: string) {
    value = optionValue;
    isOpen = false;
    if (onChange) {
      onChange(optionValue);
    }
  }

  function toggleOpen(event: MouseEvent) {
    event.stopPropagation();
    isOpen = !isOpen;
  }

  function handleClickOutside(event: MouseEvent) {
    if (selectElement && !selectElement.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    if (browser) {
      document.addEventListener('click', handleClickOutside);
    }
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div bind:this={selectElement} class="relative inline-block {className}">
  <!-- 触发按钮 -->
  <button
    type="button"
    onclick={toggleOpen}
    class="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 transition-all focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
    class:border-blue-400={isOpen}
    class:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]={isOpen}
  >
    <span class="truncate">{selectedLabel}</span>
    <svg
      class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
      class:rotate-180={isOpen}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <!-- 下拉选项 -->
  {#if isOpen}
    <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-[200px] overflow-y-auto">
      {#each options as option}
        <button
          type="button"
          onclick={() => handleSelect(option.value)}
          class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
          class:text-blue-600={option.value === value}
          class:bg-blue-50={option.value === value}
          class:text-gray-700={option.value !== value}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
