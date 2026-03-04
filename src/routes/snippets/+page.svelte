<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import Pagination from '$lib/components/Pagination.svelte';
  import { codeSnippetsApi, imagesApi, imageHostsApi } from '$lib/api';
  import type { CodeSnippet, Tag, FilterOptions, TagKind } from '$lib/types';
  import { showMessage } from '$lib/stores/messageStore';
  import { adminStore } from '$lib/stores/admin';
  import Select from '$lib/components/Select.svelte';
  import { TAG_KIND_OPTIONS } from '$lib/types';
  import InputModal from '$lib/components/InputModal.svelte';

  let codeSnippets = $state<CodeSnippet[]>([]);
  let tags = $state<Tag[]>([]);
  let loading = $state(false);
  let updating = $state(false);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let total = $state(0);
  let filters = $state<FilterOptions>({});
  let editingSnippet = $state<CodeSnippet | null>(null);
  let editTitle = $state('');
  let editDescription = $state('');
  let editUrl = $state('');
  let editCoverUrl = $state('');
  let editCoverPreview = $state<string>('');
  let isUploading = $state(false);
  let editTags = $state<string[]>([]);
  let newTagName = $state('');
  let newTagKind = $state('');
  let showNewTagModal = $state(false);
  let showSortDropdown = $state(false);
  let isAdmin = $state(false);
  let showTagManagementModal = $state(false);
  let editingTag = $state<Tag | null>(null);
  let editTagName = $state('');
  let editTagKind = $state('');
  let tagFilterKind = $state<string>('');

  let filteredTags = $derived(
    tagFilterKind
      ? tags.filter(tag => tag.kind === tagFilterKind)
      : tags
  );

  // 从 URL 查询参数初始化状态
  function initFromUrl() {
    const params = $page.url.searchParams;

    const pageParam = params.get('page');
    currentPage = pageParam ? parseInt(pageParam, 10) : 1;

    const searchParam = params.get('search');
    const sortByParam = params.get('sortBy');
    const sortOrderParam = params.get('sortOrder');
    const tagsParam = params.get('tags');
    const frameworkParam = params.get('framework');

    filters = {};
    if (searchParam) filters.search = searchParam;
    if (sortByParam) filters.sortBy = sortByParam as 'created_at' | 'size' | 'name';
    if (sortOrderParam) filters.sortOrder = sortOrderParam as 'asc' | 'desc';
    if (tagsParam) filters.tags = tagsParam.split(',');
    if (frameworkParam) filters.framework = frameworkParam;
  }

  // 更新 URL 查询参数
  function updateUrl() {
    const params = new URLSearchParams();

    if (currentPage > 1) params.set('page', currentPage.toString());
    if (filters.search) params.set('search', filters.search);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    if (filters.framework) params.set('framework', filters.framework);

    const newUrl = `${$page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    replaceState(newUrl, $page.state);
  }

  onMount(async () => {
    initFromUrl();
    await loadData();
    
    // 订阅管理员状态
    adminStore.subscribe(state => {
      isAdmin = state.isAdmin;
    });
  });

  // 辅助函数：对标签数组进行去重
  function deduplicateTags(tagsData: Tag[]): Tag[] {
    const seen = new Set<string>();
    return tagsData.filter((tag) => {
      if (seen.has(tag.name)) {
        return false;
      }
      seen.add(tag.name);
      return true;
    });
  }

  async function loadData() {
    loading = true;
    try {
      const tagsData = await imagesApi.getTags();
      tags = deduplicateTags(tagsData);

      const codeSnippetsData = await codeSnippetsApi.getCodeSnippets({
        search: filters.search,
        tags: filters.tags?.join(','),
        framework: filters.framework,
        page: currentPage,
        page_size: 20,
        sortBy: (filters.sortBy || 'created_at') as string,
        sortOrder: (filters.sortOrder || 'desc') as string
      });

      codeSnippets = codeSnippetsData?.code_snippets || [];
      total = codeSnippetsData?.total || 0;
      totalPages = codeSnippetsData?.total_pages || 1;
    } catch (error) {
      console.error('加载数据失败:', error);
      codeSnippets = [];
      total = 0;
      totalPages = 1;
    } finally {
      loading = false;
    }
  }

  function handleFilterChange(newFilters: FilterOptions) {
    filters = { ...filters, ...newFilters };
    currentPage = 1;
    updateUrl();
    loadData();
  }

  function handlePageChange(page: number) {
    currentPage = page;
    updateUrl();
    loadData();
  }

  function startEditSnippet(snippet: CodeSnippet) {
    editingSnippet = snippet;
    editTitle = snippet.title;
    editDescription = snippet.description || '';
    editUrl = snippet.url;
    editCoverUrl = snippet.cover_url || '';
    editCoverPreview = '';
    isUploading = false;
    editTags = snippet.tags?.map(tag => tag.name) || [];
  }

  function cancelEdit() {
    editingSnippet = null;
  }

  async function saveEditSnippet() {
    if (!editingSnippet) return;

    updating = true;
    try {
      if (editingSnippet.id === 0) {
        await codeSnippetsApi.createCodeSnippet({
          title: editTitle,
          description: editDescription,
          url: editUrl,
          cover_url: editCoverUrl,
          tags: editTags
        });
        showMessage('代码片段创建成功', 'success');
      } else {
        await codeSnippetsApi.updateCodeSnippet(editingSnippet.id, {
          title: editTitle,
          description: editDescription,
          url: editUrl,
          cover_url: editCoverUrl,
          tags: editTags
        });
        showMessage('代码片段更新成功', 'success');
      }
      editingSnippet = null;
      await loadData();
    } catch (error) {
      console.error('保存代码片段失败:', error);
      showMessage('保存失败，请重试', 'error');
    } finally {
      updating = false;
    }
  }

  async function handleCoverPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === 0) {
        const blob = items[i].getAsFile();
        if (blob) {
          await uploadCoverImage(blob);
        }
      }
    }
  }

  async function handleCoverUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      await uploadCoverImage(file);
    }
  }

  async function uploadCoverImage(file: File) {
    // 创建本地预览
    editCoverPreview = URL.createObjectURL(file);
    isUploading = true;
    
    try {
      const result = await imageHostsApi.upload(file);
      editCoverUrl = result.url;
      showMessage('封面上传成功', 'success');
    } catch (error) {
      console.error('上传封面失败:', error);
      showMessage('上传封面失败，请重试', 'error');
    } finally {
      isUploading = false;
      // 清除本地预览 URL，避免内存泄漏
      setTimeout(() => {
        URL.revokeObjectURL(editCoverPreview);
        editCoverPreview = '';
      }, 1000);
    }
  }

  function toggleTag(tagName: string) {
    if (editTags.includes(tagName)) {
      editTags = editTags.filter(name => name !== tagName);
    } else {
      editTags = [...editTags, tagName];
    }
  }

  function toggleFramework(tagName: string) {
    const otherFrameworkTags = frameworkTags.map(t => t.name).filter(n => n !== tagName);
    const newEditTags = editTags.filter(name => !otherFrameworkTags.includes(name));

    if (newEditTags.includes(tagName)) {
      editTags = newEditTags.filter(name => name !== tagName);
    } else {
      editTags = [...newEditTags, tagName];
    }
  }

  async function addNewTag() {
    const tagName = newTagName.trim();
    if (!tagName) return;

    if (tags.some(tag => tag.name === tagName)) {
      if (!editTags.includes(tagName)) {
        editTags = [...editTags, tagName];
      }
      newTagName = '';
      newTagKind = '';
      return;
    }

    try {
      await imagesApi.createTag({ name: tagName, kind: newTagKind || 'code' });
      showMessage('标签创建成功', 'success');

      const updatedTags = await imagesApi.getTags();
      tags = deduplicateTags(updatedTags);

      if (!editTags.includes(tagName)) {
        editTags = [...editTags, tagName];
      }

      newTagName = '';
      newTagKind = '';
    } catch (error) {
      console.error('创建标签失败:', error);
      showMessage('创建标签失败，请重试', 'error');
    }
  }

  // 标签管理相关函数
  function openTagManagement() {
    showTagManagementModal = true;
  }

  function startEditTag(tag: Tag) {
    editingTag = tag;
    editTagName = tag.name;
    editTagKind = tag.kind || '';
  }

  async function saveEditTag() {
    if (!editingTag || !editTagName.trim()) return;

    try {
      await imagesApi.updateTag(editingTag.name, { name: editTagName, kind: editTagKind });
      showMessage('标签更新成功', 'success');

      const updatedTags = await imagesApi.getTags();
      tags = deduplicateTags(updatedTags);

      editingTag = null;
      editTagName = '';
      editTagKind = '';
    } catch (error) {
      console.error('更新标签失败:', error);
      showMessage('更新标签失败，请重试', 'error');
    }
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`确定要删除标签 "${tag.name}" 吗？`)) return;

    try {
      await imagesApi.deleteTag(tag.name);
      showMessage('标签删除成功', 'success');

      const updatedTags = await imagesApi.getTags();
      tags = deduplicateTags(updatedTags);

      // 如果正在编辑的标签被删除，清空编辑状态
      if (editingTag && editingTag.name === tag.name) {
        editingTag = null;
        editTagName = '';
        editTagKind = '';
      }
    } catch (error) {
      console.error('删除标签失败:', error);
      showMessage('删除标签失败，请重试', 'error');
    }
  }

  function cancelEditTag() {
    editingTag = null;
    editTagName = '';
    editTagKind = '';
  }

  async function handleCreateSnippet() {
    const newSnippet: CodeSnippet = {
      id: 0,
      title: '新代码片段',
      description: '',
      url: 'https://',
      created_at: new Date().toISOString()
    };
    startEditSnippet(newSnippet);
  }

  async function handleDeleteSnippet(snippet: CodeSnippet) {
    if (!confirm(`确定要删除代码片段 "${snippet.title}" 吗？`)) return;

    try {
      await codeSnippetsApi.deleteCodeSnippet(snippet.id);
      showMessage('代码片段删除成功', 'success');
      await loadData();
    } catch (error) {
      console.error('删除代码片段失败:', error);
      showMessage('删除失败，请重试', 'error');
    }
  }

  function handleSnippetClick(snippet: CodeSnippet) {
    window.open(snippet.url, '_blank');
  }

  function toggleSortOrder() {
    handleFilterChange({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
  }

  function resetFilters() {
    filters = {};
    currentPage = 1;
    updateUrl();
    loadData();
  }

  const sortOptions = [
    { value: 'created_at', label: '时间' },
    { value: 'name', label: '名称' }
  ];

  // 框架类标签
  const frameworkTags = $derived(tags.filter((tag: Tag) => tag.kind === '框架'));
  // 其他标签
  const otherTags = $derived(tags.filter((tag: Tag) => tag.kind !== '框架'));
  // 所有标签选项
  const allTagOptions = $derived(tags.map((tag: Tag) => ({ value: tag.name, label: tag.name })));
</script>

<svelte:head>
  <title>代码片段 - 表情包网站</title>
  <meta name="description" content="管理代码片段" />
</svelte:head>

<div class="bg-gray-50 min-h-[calc(100vh-var(--header-height))]">
  <!-- 代码片段专用筛选面板 -->
  <div class="sticky" style="top: var(--header-height); z-index: 40; background: white; border-bottom: 1px solid #e5e7eb; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
    <div class="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-3">
      <!-- 第一行：搜索框和其他筛选器 -->
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
        <!-- 搜索框 -->
        <div class="flex-1 min-w-0">
          <div class="relative">
            <svg class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索代码片段..."
              bind:value={filters.search}
              oninput={() => handleFilterChange({ search: filters.search })}
              class="w-full pl-8 sm:pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <!-- 其他标签多选 -->
        <div class="flex gap-2 flex-wrap">
          <Select
            options={otherTags.map((tag: Tag) => ({ value: tag.name, label: tag.name }))}
            values={filters.tags || []}
            placeholder="筛选其他标签"
            searchable={true}
            multiple={true}
            onChanges={(vals: string[]) => handleFilterChange({ tags: vals })}
            class="w-40 sm:w-48"
          />

          <!-- 排序选择 -->
          <div class="relative">
            <button
              onclick={() => showSortDropdown = !showSortDropdown}
              class="flex items-center gap-1 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors h-full"
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
                    onclick={() => { handleFilterChange({ sortBy: option.value as 'created_at' | 'name' }); showSortDropdown = false; }}
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

          <!-- 重置按钮 -->
          {#if filters.search || filters.tags?.length || filters.framework || filters.sortBy || filters.sortOrder}
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

      <!-- 第二行：框架标签平铺单选 -->
      <div class="flex gap-2 flex-wrap items-center transition-all duration-300 ease-in-out">
        <span class="text-sm text-gray-500 mr-1">框架:</span>
        <button
          onclick={() => handleFilterChange({ framework: undefined })}
          class="px-3 py-1.5 text-sm rounded-full border transition-all duration-300 ease-in-out"
          class:bg-blue-500={!filters.framework}
          class:text-white={!filters.framework}
          class:bg-white={filters.framework}
          class:border-gray-300={filters.framework}
          class:border-blue-500={!filters.framework}
          class:text-gray-700={filters.framework}
        >
          全部
        </button>
        {#each frameworkTags as tag}
          <button
            onclick={() => handleFilterChange({ framework: tag.name })}
            class="px-3 py-1.5 text-sm rounded-full border transition-all duration-300 ease-in-out"
            class:bg-blue-500={filters.framework === tag.name}
            class:text-white={filters.framework === tag.name}
            class:bg-white={filters.framework !== tag.name}
            class:border-gray-300={filters.framework !== tag.name}
            class:border-blue-500={filters.framework === tag.name}
            class:text-gray-700={filters.framework !== tag.name}
          >
            {tag.name}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <main class="max-w-[1280px] mx-auto py-4 sm:py-6">
    <!-- 操作栏 -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">代码片段管理</h1>
      {#if isAdmin}
      <div class="flex gap-3">
        <button
          onclick={openTagManagement}
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          标签管理
        </button>
        <button
          onclick={handleCreateSnippet}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 新建代码片段
        </button>
      </div>
      {/if}
    </div>

    <!-- 代码片段列表 -->
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    {:else if codeSnippets.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-lg mb-2">暂无代码片段</div>
        <button
          onclick={handleCreateSnippet}
          class="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          新建代码片段
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each codeSnippets as snippet}
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1">
            <!-- 封面图片 -->
            <div class="h-48 bg-gray-100 relative overflow-hidden transition-all duration-300">
              {#if snippet.cover_url}
                <img
                  src={snippet.cover_url}
                  alt={snippet.title}
                  class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-gray-400 transition-colors duration-300">
                  <svg class="w-12 h-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
              {/if}
            </div>

            <!-- 内容 -->
            <div class="p-4 transition-all duration-300">
              <h3 class="font-medium text-gray-900 mb-2 truncate transition-colors duration-300">{snippet.title}</h3>
              {#if snippet.description}
                <p class="text-sm text-gray-500 mb-3 line-clamp-2 transition-colors duration-300">{snippet.description}</p>
              {/if}
              <div class="flex flex-wrap gap-1 mb-4 transition-all duration-300">
                {#each snippet.tags || [] as tag}
                  <span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full transition-all duration-300 hover:bg-gray-200">{tag.name}</span>
                {/each}
              </div>
              <div class="flex justify-between items-center transition-all duration-300">
                <button
                  onclick={() => handleSnippetClick(snippet)}
                  class="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-300"
                >
                  查看链接
                </button>
                {#if isAdmin}
                <div class="flex gap-2 transition-all duration-300 ease-in-out">
                  <button
                    onclick={() => startEditSnippet(snippet)}
                    class="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors duration-300"
                    title="编辑"
                  >
                    <svg class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onclick={() => handleDeleteSnippet(snippet)}
                    class="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors duration-300"
                    title="删除"
                  >
                    <svg class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- 分页 -->
      {#if totalPages > 1}
        <Pagination
          bind:currentPage
          {totalPages}
          onPageChange={handlePageChange}
        />
      {/if}
    {/if}
  </main>

  {#if !loading && total > 0}
    <div class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div class="text-center text-sm text-gray-500">
        共找到 {total} 个代码片段
      </div>
    </div>
  {/if}
</div>

<!-- 编辑代码片段弹窗 -->
{#if editingSnippet && isAdmin}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300" style="background-color: rgba(0, 0, 0, 0.5); opacity: 1;" onclick={(e) => { if (e.target === e.currentTarget) editingSnippet = null; }}>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transform transition-all duration-300 scale-100 opacity-100">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">{editingSnippet.id ? '编辑代码片段' : '新建代码片段'}</h3>
      </div>
      <div class="p-6 space-y-4 overflow-y-auto flex-1" onpaste={handleCoverPaste}>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">标题</label>
          <input
            type="text"
            bind:value={editTitle}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            bind:value={editDescription}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          ></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">外部链接</label>
          <input
            type="url"
            bind:value={editUrl}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="https://"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">封面图片</label>
          {#if editCoverUrl || editCoverPreview}
            <div class="relative mb-3">
              <img
                src={editCoverPreview || editCoverUrl}
                alt="封面预览"
                class="w-full h-48 object-cover rounded-lg"
              />
              {#if isUploading}
                <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                    <span class="text-white text-sm">上传中...</span>
                  </div>
                </div>
              {/if}
              <button
                onclick={() => {
                  editCoverUrl = '';
                  editCoverPreview = '';
                }}
                class="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                title="移除封面"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/if}
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors"
            ondragover={(e) => e.preventDefault()}
            ondrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer) {
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  uploadCoverImage(file);
                }
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              onchange={handleCoverUpload}
              class="hidden"
              id="cover-upload"
            />
            <label for="cover-upload" class="cursor-pointer">
              <svg class="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div class="text-gray-600">点击选择图片或拖拽到此处</div>
              <div class="text-sm text-gray-500 mt-1">支持 JPG、PNG、GIF 格式</div>
            </label>
            <p class="text-xs text-gray-500 mt-2">提示：也可直接粘贴图片到此处上传</p>
          </div>
        </div>
        <div>
          <!-- 框架选择 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">框架</label>
            <div class="flex flex-wrap gap-2">
              {#each frameworkTags as tag}
                <button
                  onclick={() => toggleFramework(tag.name)}
                  class="px-3 py-1.5 text-sm rounded-full border transition-colors"
                  class:bg-blue-500={editTags.includes(tag.name)}
                  class:text-white={editTags.includes(tag.name)}
                  class:bg-white={!editTags.includes(tag.name)}
                  class:border-gray-300={!editTags.includes(tag.name)}
                  class:border-blue-500={editTags.includes(tag.name)}
                  class:text-gray-700={!editTags.includes(tag.name)}
                >
                  {tag.name}
                </button>
              {/each}
              <button
                onclick={() => { showNewTagModal = true; newTagKind = '框架'; }}
                class="px-3 py-1.5 text-sm rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center gap-1"
                title="新增框架"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                新增
              </button>
            </div>
          </div>

          <!-- 标签选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">标签</label>
            <div class="flex gap-2">
              <Select
                options={otherTags.map((tag: Tag) => ({ value: tag.name, label: tag.name }))}
                values={editTags.filter(name => otherTags.some(t => t.name === name))}
                placeholder="选择标签"
                searchable={true}
                multiple={true}
                onChanges={(vals: string[]) => {
                  const frameworkTagNames = frameworkTags.map(t => t.name);
                  const currentFrameworkTags = editTags.filter(name => frameworkTagNames.includes(name));
                  editTags = [...currentFrameworkTags, ...vals];
                }}
                class="flex-1"
              />
              <button
                onclick={() => { showNewTagModal = true; newTagKind = ''; }}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="新增标签"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onclick={cancelEdit}
          class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveEditSnippet}
          disabled={!editTitle.trim() || !editUrl.trim() || updating}
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {updating ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 新增标签弹窗 -->
{#if isAdmin}
<InputModal
  bind:isOpen={showNewTagModal}
  title={newTagKind ? `新增${newTagKind}` : '新增标签'}
  placeholder="请输入标签名称"
  confirmText="添加"
  onConfirm={async (value: string) => {
    if (value?.trim()) {
      newTagName = value.trim();
      await addNewTag();
    }
  }}
  onCancel={() => {}}
/>
{/if}

<!-- 标签管理弹窗 -->
{#if showTagManagementModal && isAdmin}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300" style="background-color: rgba(0, 0, 0, 0.5); opacity: 1;" onclick={(e) => { if (e.target === e.currentTarget) showTagManagementModal = false; }}>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transform transition-all duration-300 scale-100 opacity-100">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-900">标签管理</h3>
        <button
          onclick={() => showTagManagementModal = false}
          class="p-1.5 text-gray-600 hover:text-gray-900 rounded-full transition-colors"
          title="关闭"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="p-6 space-y-4 overflow-y-auto" style="height: 60vh; min-height: 400px;">
        <!-- 筛选器 -->
        <div class="flex items-center gap-3 pb-3 border-b border-gray-200 flex-wrap">
          <span class="text-sm font-medium text-gray-700">类型：</span>
          <div class="flex gap-2 flex-wrap">
            <button
              onclick={() => tagFilterKind = ''}
              class="px-3 py-1.5 text-sm rounded-full transition-all duration-200 {tagFilterKind === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              全部
            </button>
            {#each TAG_KIND_OPTIONS as option}
              <button
                onclick={() => tagFilterKind = option}
                class="px-3 py-1.5 text-sm rounded-full transition-all duration-200 {tagFilterKind === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
              >
                {option}
              </button>
            {/each}
          </div>
        </div>
        
        <!-- 标签列表 -->
        <div class="space-y-3">
          {#each filteredTags as tag (tag.name)}
            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg transition-all duration-300 ease-in-out">
                <div>
                  <div class="font-medium">{tag.name}</div>
                  <div class="text-sm text-gray-500">{tag.kind || '通用'}</div>
                </div>
                <div class="flex gap-2">
                  <button
                    onclick={() => startEditTag(tag)}
                    class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="编辑"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onclick={() => deleteTag(tag)}
                    class="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="删除"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <!-- 编辑标签表单 -->
              {#if editingTag?.name === tag.name}
                <div class="p-4 border border-gray-200 rounded-lg transition-all duration-300 ease-in-out transform opacity-100 scale-100 bg-blue-50">
                  <h4 class="text-md font-semibold text-gray-900 mb-3">编辑标签</h4>
                  <div class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">标签名称</label>
                      <input
                        type="text"
                        bind:value={editTagName}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        autofocus
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">标签类型</label>
                      <div class="flex gap-2 flex-wrap">
                        <button
                          onclick={() => editTagKind = ''}
                          class="px-3 py-1.5 text-sm rounded-full transition-all duration-200 {editTagKind === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                        >
                          不限
                        </button>
                        {#each TAG_KIND_OPTIONS as option}
                          <button
                            onclick={() => editTagKind = option}
                            class="px-3 py-1.5 text-sm rounded-full transition-all duration-200 {editTagKind === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                          >
                            {option}
                          </button>
                        {/each}
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <button
                        onclick={saveEditTag}
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onclick={cancelEditTag}
                        class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
