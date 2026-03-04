<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';

  interface Option {
    value: string;
    label: string;
  }

  let { 
    options = $bindable([]), 
    value = $bindable(''), 
    values = $bindable<string[]>([]), 
    placeholder = $bindable('请选择'), 
    onChange = $bindable<(value: string) => void>(), 
    onChanges = $bindable<(values: string[]) => void>(), 
    class: className = '', 
    searchable = $bindable(false), 
    multiple = $bindable(false)
  } = $props();

  let isOpen = $state(false);
  let searchQuery = $state('');
  let selectElement: HTMLDivElement;
  let dropdownElement = $state<HTMLDivElement>();
  let searchInput = $state<HTMLInputElement>();

  let selectedLabel = $derived(
    multiple 
      ? ''
      : (options.find(opt => opt.value === value)?.label || placeholder)
  );

  function isSelected(optionValue: string): boolean {
    if (multiple) {
      return values.includes(optionValue);
    }
    return value === optionValue;
  }

  function getLabelByValue(val: string): string {
    return options.find(opt => opt.value === val)?.label || val;
  }

  function handleSelect(optionValue: string) {
    if (multiple) {
      const index = values.indexOf(optionValue);
      if (index > -1) {
        values = values.filter(v => v !== optionValue);
      } else {
        values = [...values, optionValue];
      }
      if (onChanges) {
        onChanges(values);
      }
      if (searchInput) {
        searchInput.focus();
      }
    } else {
      value = optionValue;
      isOpen = false;
      if (onChange) {
        onChange(optionValue);
      }
    }
  }

  function removeTag(optionValue: string, event: MouseEvent) {
    event.stopPropagation();
    values = values.filter(v => v !== optionValue);
    if (onChanges) {
      onChanges(values);
    }
  }

  async function toggleOpen(event: Event) {
    event.stopPropagation();
    isOpen = !isOpen;
    
    if (isOpen) {
      await tick();
      updateDropdownPosition();
      if (searchable && searchInput) {
        setTimeout(() => searchInput?.focus(), 100);
      }
    }
  }

  function updateDropdownPosition() {
    if (!selectElement || !dropdownElement || typeof window === 'undefined') return;
    
    const rect = selectElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = dropdownElement.offsetHeight;
    
    // 检查下方空间是否足够
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // 如果下方空间不足且上方空间足够，显示在上方
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      dropdownElement.style.top = 'auto';
      dropdownElement.style.bottom = '100%';
      dropdownElement.style.marginTop = '0';
      dropdownElement.style.marginBottom = '4px';
    } else {
      // 默认显示在下方
      dropdownElement.style.top = '100%';
      dropdownElement.style.bottom = 'auto';
      dropdownElement.style.marginTop = '4px';
      dropdownElement.style.marginBottom = '0';
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      selectElement && 
      !selectElement.contains(event.target as Node) &&
      dropdownElement && 
      !dropdownElement.contains(event.target as Node)
    ) {
      isOpen = false;
    }
  }

  function clearSearch() {
    searchQuery = '';
  }

  onMount(() => {
    // 确保只在浏览器环境中执行
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.addEventListener('click', handleClickOutside);
      window.addEventListener('resize', updateDropdownPosition);
    }
  });

  onDestroy(() => {
    // 确保只在浏览器环境中执行
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', updateDropdownPosition);
    }
  });

  const filteredOptions = $derived(
    searchQuery
      ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options
  );
</script>

<div class="relative inline-block {className}">
  <div bind:this={selectElement}>
    {#if multiple}
      <div
        role="button"
        tabindex="0"
        onclick={toggleOpen}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleOpen(e); }}
        class="w-full min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-all cursor-text"
        class:border-blue-400={isOpen}
      >
        {#each values as val}
          <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
            <span class="max-w-[100px] truncate">{getLabelByValue(val)}</span>
            <button
              type="button"
              onclick={(e) => removeTag(val, e)}
              class="hover:bg-blue-200 rounded-sm p-0.5 transition-colors"
              title="移除"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        {/each}
        {#if values.length === 0}
          <span class="text-gray-400 px-1">{placeholder}</span>
        {/if}
        <svg
          class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-auto"
          class:rotate-180={isOpen}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    {:else}
      <button
        type="button"
        onclick={toggleOpen}
        class="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 transition-all"
        class:border-blue-400={isOpen}
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
    {/if}
  </div>

  {#if isOpen}
    <div
      bind:this={dropdownElement}
      class="absolute z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-[200px] overflow-y-auto left-0 w-full"
    >
      {#if searchable}
        <div class="px-3 py-2 border-b border-gray-100">
          <div class="relative">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              bind:this={searchInput}
              type="text"
              bind:value={searchQuery}
              placeholder="搜索..."
              class="w-full pl-8 pr-6 py-1.5 text-sm border border-gray-200 rounded-md"
            />
            {#if searchQuery}
              <button
                type="button"
                onclick={clearSearch}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="清除搜索"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            {/if}
          </div>
        </div>
      {/if}
      
      {#if filteredOptions.length === 0}
        <div class="px-3 py-4 text-center text-gray-500 text-sm">
          {searchQuery ? '没有找到匹配的选项' : '暂无选项'}
        </div>
      {:else}
        {#each filteredOptions as option}
          <button
            type="button"
            onclick={() => handleSelect(option.value)}
            class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
            class:text-blue-600={isSelected(option.value)}
            class:bg-blue-50={isSelected(option.value)}
            class:text-gray-700={!isSelected(option.value)}
          >
            <span>{option.label}</span>
            {#if isSelected(option.value)}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
