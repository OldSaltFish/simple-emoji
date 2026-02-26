<script lang="ts">
  import type { FilterOptions } from '$lib/types';

  let {
    categories = $bindable([]),
    tags = $bindable([]),
    filters = $bindable({}),
    onFilterChange = $bindable(),
    onDownloadCategory = $bindable()
  } = $props();

  let isExpanded = $state(true);
  let showCategoryDropdown = $state(false);
  let showSortDropdown = $state(false);

  function updateFilter(key: keyof FilterOptions, value: any) {
    filters = { ...filters, [key]: value };
    if (onFilterChange) {
      onFilterChange(filters);
    }
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
    { value: 'size', label: '大小' },
    { value: 'name', label: '名称' }
  ];

  // 筛选无分类
  function filterNoCategory() {
    updateFilter('category', 'none');
  }
</script>

<div class="sticky" style="top: var(--header-height); z-index: 40; background: white; border-bottom: 1px solid #e5e7eb; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
  <div class="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-3">
    <!-- 移动端：两行布局 -->
    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <!-- 第一行：分类 + 搜索 -->
      <div class="flex items-center gap-2 sm:gap-3 flex-1">
        <!-- 分类选择 -->
        <div class="relative flex-shrink-0">
        <button
          onclick={() => showCategoryDropdown = !showCategoryDropdown}
          class="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
        >
          <span class="text-sm text-gray-700 whitespace-nowrap">
            {filters.category === 'none' ? '无图集' : (filters.category || '全部图集')}
          </span>
          <svg class="w-4 h-4 text-gray-400" class:rotate-180={showCategoryDropdown} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if showCategoryDropdown}
          <div class="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[140px] z-50 max-h-[60vh] overflow-y-auto">
            <button
              onclick={() => { updateFilter('category', ''); showCategoryDropdown = false; }}
              class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              全部图集
            </button>
            <button
              onclick={() => { filterNoCategory(); showCategoryDropdown = false; }}
              class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              无图集
            </button>
            {#each categories as category}
              <button
                onclick={() => { updateFilter('category', category.name); showCategoryDropdown = false; }}
                class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {category.name}
              </button>
            {/each}
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
              class="w-full pl-8 sm:pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400 text-sm"
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
          class="flex items-center gap-1 px-2 sm:px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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