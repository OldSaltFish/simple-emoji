<script lang="ts">
  import type { FilterOptions, Category } from '$lib/types';

  let {
    categories = $bindable([]),
    tags = $bindable([]),
    filters = $bindable({}),
    onFilterChange = $bindable(),
    onDownloadCategory = $bindable()
  } = $props();

  let showCategoryPopup = $state(false);
  let showSortDropdown = $state(false);
  let popupRef: HTMLElement;

  // 点击外部关闭popup
  function handleClickOutside(e: MouseEvent) {
    if (showCategoryPopup && popupRef && !popupRef.contains(e.target as Node)) {
      showCategoryPopup = false;
    }
  }

  $effect(() => {
    if (showCategoryPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  });

  function updateFilter(key: keyof FilterOptions, value: any) {
    filters = { ...filters, [key]: value };
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }

  function selectCategory(categoryName: string) {
    updateFilter('category', categoryName);
    showCategoryPopup = false;
  }

  function toggleTag(tagName: string) {
    const currentTags = filters.tags || [];
    if (currentTags.includes(tagName)) {
      updateFilter('tags', currentTags.filter((name:string) => name !== tagName));
    } else {
      updateFilter('tags', [...currentTags, tagName]);
    }
  }

  function toggleSortOrder() {
    updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
  }

  function resetFilters() {
    filters = {};
    if (onFilterChange) {
      onFilterChange({});
    }
  }

  const sortOptions = [
    { value: 'created_at', label: '时间' },
    { value: 'name', label: '名称' }
  ];

  function filterNoCategory() {
    selectCategory('none');
  }
</script>

<div class="sticky" style="top: var(--header-height); z-index: 40; background: white; border-bottom: 1px solid #e5e7eb; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
  <div class="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-3">
    <!-- 移动端：两行布局 -->
    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <!-- 第一行：图集选择 + 搜索 -->
      <div class="flex items-center gap-2 sm:gap-3 flex-1">
        <!-- 图集选择（popup触发器） -->
        <div class="relative flex-shrink-0" bind:this={popupRef}>
          <button
            onclick={() => showCategoryPopup = !showCategoryPopup}
            class="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
          >
            <span class="text-sm text-gray-700 whitespace-nowrap font-medium">
              {filters.category === 'none' ? '无图集' : (filters.category || '全部')}
            </span>
            <svg class="w-4 h-4 text-gray-400" class:rotate-180={showCategoryPopup} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Popup：非模态浮层 -->
          {#if showCategoryPopup}
            <div class="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-3 px-3 z-50 w-[340px] sm:w-[420px] animate-in fade-in slide-in-from-top-1 duration-150">
              <!-- 全部选项 -->
              <button
                onclick={() => selectCategory('')}
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left {filters.category === '' && filters.category !== 'none' ? 'bg-indigo-50 text-indigo-600' : ''}"
              >
                <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium">全部</div>
                  <div class="text-xs text-gray-400">查看所有表情包</div>
                </div>
                {#if filters.category === '' && filters.category !== 'none'}
                  <svg class="w-4 h-4 text-indigo-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                {/if}
              </button>

              <div class="border-t border-gray-100 my-1"></div>

              <!-- 图集列表 -->
              <div class="max-h-[320px] overflow-y-auto space-y-0.5 pr-1">
                {#each categories as album}
                  <button
                    onclick={() => selectCategory(album.name)}
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left group {filters.category === album.name ? 'bg-indigo-50' : ''}"
                  >
                    <!-- 缩略图 -->
                    <div class="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                      {#if album.cover_url}
                        <img src={album.cover_url} alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" draggable="false" />
                      {:else}
                        <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      {/if}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium truncate {filters.category === album.name ? 'text-indigo-600' : 'text-gray-700'}">{album.name}</div>
                      <div class="text-xs text-gray-400 truncate">{album.description || '暂无描述'}</div>
                    </div>
                    {#if filters.category === album.name}
                      <svg class="w-4 h-4 text-indigo-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    {/if}
                  </button>
                {/each}

                {#if categories.length === 0}
                  <div class="text-center py-6 text-sm text-gray-400">暂无图集</div>
                {/if}

                <!-- 无图集选项 -->
                <div class="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onclick={filterNoCategory}
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left {filters.category === 'none' ? 'bg-indigo-50 text-indigo-600' : ''}"
                  >
                    <div class="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <div class="text-sm font-medium">无图集</div>
                      <div class="text-xs text-gray-400">未分类的表情包</div>
                    </div>
                    {#if filters.category === 'none'}
                      <svg class="w-4 h-4 text-indigo-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- 搜索框 -->
        <div class="flex-1 min-w-0">
          <div class="relative">
            <svg class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索..."
              bind:value={filters.search}
              oninput={() => updateFilter('search', filters.search)}
              class="w-full pl-8 sm:pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 text-sm"
            />
          </div>
        </div>
      </div>

      <!-- 第二行：排序 + 操作按钮 -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- 排序选择 -->
        <div class="relative">
          <button
            onclick={() => showSortDropdown = !showSortDropdown}
            class="flex items-center gap-1 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
          >
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span class="text-sm text-gray-700 hidden sm:inline">
              {sortOptions.find(o => o.value === filters.sortBy)?.label || '时间'}
            </span>
            <svg class="w-4 h-4 text-gray-400" class:rotate-180={showSortDropdown} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {#if showSortDropdown}
            <div class="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[100px] z-50">
              {#each sortOptions as option}
                <button
                  onclick={() => { updateFilter('sortBy', option.value); showSortDropdown = false; }}
                  class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {option.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- 升降序按钮 -->
        <button
          onclick={toggleSortOrder}
          class="p-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
          title={filters.sortOrder === 'asc' ? '升序' : '降序'}
        >
          <svg class="w-4 h-4 text-gray-600" class:rotate-180={filters.sortOrder === 'desc'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          </svg>
        </button>

      <!-- 下载图集按钮 - 移动端只显示图标 -->
      {#if filters.category && filters.category !== 'none' && onDownloadCategory}
        <button
          onclick={() => onDownloadCategory(filters.category)}
          class="flex items-center gap-1 px-2 sm:px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          title="下载该图集"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span class="text-sm hidden sm:inline">下载</span>
        </button>
      {/if}

        <!-- 重置按钮 - 只显示图标 -->
        {#if filters.category || filters.search || filters.tags?.length || filters.sortBy || filters.sortOrder}
          <button
            onclick={resetFilters}
            class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="重置筛选"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-in-from-top-1 { from { transform: translateY(-4px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .animate-in { animation: fade-in 0.15s ease-out, slide-in-from-top-1 0.15s ease-out; }
</style>
