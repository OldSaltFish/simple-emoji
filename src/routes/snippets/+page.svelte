<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import Pagination from '$lib/components/Pagination.svelte';
  import { codeSnippetsApi, imageHostsApi } from '$lib/api';
  import { snippetTagsApi } from '$lib/api/snippetTags';
  import type { CodeSnippet, SnippetTag, FilterOptions } from '$lib/types';
  import { showMessage } from '$lib/stores/messageStore';
  import { adminStore } from '$lib/stores/admin';
  import Select from '$lib/components/Select.svelte';
  import { SNIPPET_TAG_KIND_OPTIONS } from '$lib/types';
  import InputModal from '$lib/components/InputModal.svelte';
  import { customConfirm } from '$lib/stores/dialogStore';

  let codeSnippets = $state<CodeSnippet[]>([]);
  let tags = $state<SnippetTag[]>([]);
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
  let editingTag = $state<SnippetTag | null>(null);
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
    if (sortByParam) filters.sortBy = sortByParam as 'created_at' | 'name';
    if (sortOrderParam) filters.sortOrder = sortOrderParam as 'asc' | 'desc';
    if (tagsParam) filters.tags = tagsParam.split(',');
    if (frameworkParam) filters.framework = frameworkParam;
  }

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
    adminStore.subscribe(state => {
      isAdmin = state.isAdmin;
    });
  });

  function deduplicateTags(tagsData: SnippetTag[]): SnippetTag[] {
    const seen = new Set<string>();
    return tagsData.filter((tag) => {
      if (seen.has(tag.name)) return false;
      seen.add(tag.name);
      return true;
    });
  }

  async function loadData() {
    loading = true;
    try {
      const tagsData = await snippetTagsApi.getTags();
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
        if (blob) await uploadCoverImage(blob);
      }
    }
  }

  async function handleCoverUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) await uploadCoverImage(file);
  }

  async function uploadCoverImage(file: File) {
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
    const frameworkTagNames = frameworkTags.map(t => t.name);
    const otherFrameworkTags = frameworkTagNames.filter(n => n !== tagName);
    const filteredTags = editTags.filter(name => !otherFrameworkTags.includes(name));
    if (filteredTags.includes(tagName)) {
      editTags = filteredTags.filter(name => name !== tagName);
    } else {
      editTags = [...filteredTags, tagName];
    }
  }

  async function addNewTag() {
    const tagName = newTagName.trim();
    if (!tagName) return;
    if (tags.some(tag => tag.name === tagName)) {
      if (!editTags.includes(tagName)) editTags = [...editTags, tagName];
      newTagName = '';
      return;
    }
    try {
      await snippetTagsApi.createTag({ name: tagName, kind: newTagKind || '其他' });
      showMessage('标签创建成功', 'success');
      const updatedTags = await snippetTagsApi.getTags();
      tags = deduplicateTags(updatedTags);
      if (!editTags.includes(tagName)) editTags = [...editTags, tagName];
      newTagName = '';
      newTagKind = '';
    } catch (error) {
      console.error('创建标签失败:', error);
      showMessage('创建标签失败，请重试', 'error');
    }
  }

  function startEditTag(tag: SnippetTag) {
    editingTag = tag;
    editTagName = tag.name;
    editTagKind = tag.kind || '';
  }

  async function saveEditTag() {
    if (!editingTag || !editTagName.trim()) return;
    try {
      await snippetTagsApi.updateTag(editingTag.name, { name: editTagName, kind: editTagKind });
      showMessage('标签更新成功', 'success');
      const updatedTags = await snippetTagsApi.getTags();
      tags = deduplicateTags(updatedTags);
      editingTag = null;
    } catch (error) {
      console.error('更新标签失败:', error);
      showMessage('更新标签失败，请重试', 'error');
    }
  }

  async function deleteTag(tag: SnippetTag) {
    if (await customConfirm(`确定要删除标签 "${tag.name}" 吗？`)) {
      try {
        await snippetTagsApi.deleteTag(tag.name);
        showMessage('标签删除成功', 'success');
        const updatedTags = await snippetTagsApi.getTags();
        tags = deduplicateTags(updatedTags);
        if (editingTag?.name === tag.name) editingTag = null;
      } catch (error) {
        console.error('删除标签失败:', error);
        showMessage('删除标签失败，请重试', 'error');
      }
    }
  }

  async function handleCreateSnippet() {
    startEditSnippet({ id: 0, title: '新代码片段', description: '', url: 'https://', created_at: new Date().toISOString() });
  }

  async function handleDeleteSnippet(snippet: CodeSnippet) {
    if (await customConfirm(`确定要删除代码片段 "${snippet.title}" 吗？`)) {
      try {
        await codeSnippetsApi.deleteCodeSnippet(snippet.id);
        showMessage('代码片段删除成功', 'success');
        await loadData();
      } catch (error) {
        console.error('删除代码片段失败:', error);
        showMessage('删除失败，请重试', 'error');
      }
    }
  }

  function handleSnippetClick(snippet: CodeSnippet) {
    window.open(snippet.url, '_blank');
  }

  const sortOptions = [
    { value: 'created_at', label: '时间' },
    { value: 'name', label: '名称' }
  ];

  const frameworkTags = $derived(tags.filter(t => t.kind === '框架'));
  const otherTags = $derived(tags.filter(t => t.kind !== '框架'));
</script>

<svelte:head>
  <title>代码片段 - 表情包网站</title>
</svelte:head>

<div class="bg-gray-50 min-h-[calc(100vh-4rem)]">
  <div class="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-[1280px] mx-auto px-4 py-3">
      <div class="flex flex-col sm:flex-row gap-3 mb-3">
        <div class="flex-1 relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="搜索代码片段..." bind:value={filters.search} oninput={() => handleFilterChange({ search: filters.search })} class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>
        <div class="flex gap-2">
          <Select options={otherTags.map(t => ({ value: t.name, label: t.name }))} values={filters.tags || []} placeholder="筛选标签" searchable={true} multiple={true} onChanges={(vals: string[]) => handleFilterChange({ tags: vals })} class="w-48" />
          <div class="relative">
            <button onclick={() => showSortDropdown = !showSortDropdown} class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
              <span class="text-sm text-gray-700">{sortOptions.find(o => o.value === filters.sortBy)?.label || '时间'}</span>
              <svg class="w-4 h-4 text-gray-400 transition-transform {showSortDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {#if showSortDropdown}
              <div class="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[100px] z-50">
                {#each sortOptions as option}
                  <button onclick={() => { handleFilterChange({ sortBy: option.value as any }); showSortDropdown = false; }} class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">{option.label}</button>
                {/each}
              </div>
            {/if}
          </div>
          <button onclick={() => handleFilterChange({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })} class="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <svg class="w-5 h-5 text-gray-600 {filters.sortOrder === 'asc' ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
          </button>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap items-center">
        <span class="text-sm font-medium text-gray-500">框架:</span>
        <button onclick={() => handleFilterChange({ framework: undefined })} class="px-3 py-1 text-sm rounded-full border transition-all { !filters.framework ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400' }">全部</button>
        {#each frameworkTags as tag}
          <button onclick={() => handleFilterChange({ framework: tag.name })} class="px-3 py-1 text-sm rounded-full border transition-all { filters.framework === tag.name ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400' }">{tag.name}</button>
        {/each}
      </div>
    </div>
  </div>

  <main class="max-w-[1280px] mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
      <h2 class="text-2xl font-bold text-gray-900">代码片段库</h2>
      {#if isAdmin}
        <div class="flex gap-3">
          <button onclick={() => showTagManagementModal = true} class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium">标签管理</button>
          <button onclick={handleCreateSnippet} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md shadow-blue-100 transition-all font-medium">+ 新建片段</button>
        </div>
      {/if}
    </div>

    {#if loading}
      <div class="flex justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
    {:else if codeSnippets.length === 0}
      <div class="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
        <p class="text-gray-400 text-lg">暂无相关代码片段</p>
        {#if isAdmin}<button onclick={handleCreateSnippet} class="mt-4 text-blue-600 font-medium">立即创建一个</button>{/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each codeSnippets as snippet}
          <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-100 transition-all group">
            <div class="h-48 bg-gray-50 relative overflow-hidden">
              {#if snippet.cover_url}
                <img src={snippet.cover_url} alt={snippet.title} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-gray-300">
                  <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
              {/if}
              <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div class="p-5">
              <h3 class="font-bold text-gray-900 mb-2 truncate group-hover:text-blue-600 transition-colors">{snippet.title}</h3>
              <p class="text-sm text-gray-500 mb-4 line-clamp-2 h-10">{snippet.description || '暂无描述'}</p>
              <div class="flex flex-wrap gap-1.5 mb-5">
                {#each snippet.tags || [] as tag}
                  <span class="px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-600 rounded-md">{tag.name}</span>
                {/each}
              </div>
              <div class="flex justify-between items-center pt-4 border-t border-gray-50">
                <button onclick={() => handleSnippetClick(snippet)} class="text-sm font-bold text-blue-600 hover:text-blue-700">查看详情 →</button>
                {#if isAdmin}
                  <div class="flex gap-1">
                    <button onclick={() => startEditSnippet(snippet)} class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="编辑"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    <button onclick={() => handleDeleteSnippet(snippet)} class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="删除"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
      {#if totalPages > 1}<Pagination bind:currentPage {totalPages} onPageChange={handlePageChange} />{/if}
    {/if}
  </main>
</div>

{#if editingSnippet && isAdmin}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onclick={(e) => { if (e.target === e.currentTarget) editingSnippet = null; }}>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 class="text-lg font-bold text-gray-900">{editingSnippet.id ? '编辑片段' : '新建片段'}</h3>
        <button onclick={() => editingSnippet = null} class="text-gray-400 hover:text-gray-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <div class="p-6 space-y-5 overflow-y-auto" onpaste={handleCoverPaste}>
        <div class="grid grid-cols-1 gap-5">
          <div><label class="block text-sm font-bold text-gray-700 mb-1.5">标题</label><input type="text" bind:value={editTitle} class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" /></div>
          <div><label class="block text-sm font-bold text-gray-700 mb-1.5">链接</label><input type="url" bind:value={editUrl} placeholder="https://" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" /></div>
          <div><label class="block text-sm font-bold text-gray-700 mb-1.5">描述</label><textarea bind:value={editDescription} rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"></textarea></div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">封面</label>
            {#if editCoverUrl || editCoverPreview}
              <div class="relative rounded-xl overflow-hidden border border-gray-200 mb-3 group">
                <img src={editCoverPreview || editCoverUrl} alt="预览" class="w-full h-40 object-cover" />
                <button onclick={() => { editCoverUrl = ''; editCoverPreview = ''; }} class="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            {/if}
            <div class="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-all">
              <input type="file" accept="image/*" onchange={handleCoverUpload} class="hidden" id="cover-up" />
              <label for="cover-up" class="cursor-pointer block">
                <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <div class="text-sm text-gray-600 font-medium">点击或拖拽上传封面，也可直接粘贴</div>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">框架</label>
            <div class="flex flex-wrap gap-2">
              {#each frameworkTags as tag}<button onclick={() => toggleFramework(tag.name)} class="px-3 py-1 text-sm rounded-full border transition-all {editTags.includes(tag.name) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}">{tag.name}</button>{/each}
              <button onclick={() => { showNewTagModal = true; newTagKind = '框架'; }} class="px-3 py-1 text-sm rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-600 transition-all">+ 新增</button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">标签</label>
            <div class="flex gap-2">
              <Select options={otherTags.map(t => ({ value: t.name, label: t.name }))} values={editTags.filter(n => otherTags.some(t => t.name === n))} placeholder="选择标签" searchable={true} multiple={true} onChanges={(vals: string[]) => { const fTags = editTags.filter(n => frameworkTags.some(t => t.name === n)); editTags = [...fTags, ...vals]; }} class="flex-1" />
              <button onclick={() => { showNewTagModal = true; newTagKind = ''; }} class="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg></button>
            </div>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/30">
        <button onclick={cancelEdit} class="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">取消</button>
        <button onclick={saveEditSnippet} disabled={!editTitle.trim() || !editUrl.trim() || updating} class="px-8 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100 transition-all">{updating ? '保存中...' : '确认保存'}</button>
      </div>
    </div>
  </div>
{/if}

{#if isAdmin}
<InputModal bind:isOpen={showNewTagModal} title={newTagKind ? `新增${newTagKind}` : '新增标签'} placeholder="请输入名称" confirmText="添加" onConfirm={async (v: string) => { if (v?.trim()) { newTagName = v.trim(); await addNewTag(); } }} />
{/if}

{#if showTagManagementModal && isAdmin}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onclick={(e) => { if (e.target === e.currentTarget) showTagManagementModal = false; }}>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 class="text-lg font-bold text-gray-900">标签管理</h3>
        <button onclick={() => showTagManagementModal = false} class="text-gray-400 hover:text-gray-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <div class="p-6 space-y-6 overflow-y-auto">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-sm font-bold text-gray-500">过滤类型:</span>
          <button onclick={() => tagFilterKind = ''} class="px-3 py-1 text-sm rounded-full transition-all {tagFilterKind === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">全部</button>
          {#each SNIPPET_TAG_KIND_OPTIONS as option}<button onclick={() => tagFilterKind = option} class="px-3 py-1 text-sm rounded-full transition-all {tagFilterKind === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">{option}</button>{/each}
        </div>
        <div class="grid grid-cols-1 gap-3">
          {#each filteredTags as tag (tag.name)}
            <div class="flex flex-col border border-gray-100 rounded-2xl p-4 transition-all {editingTag?.name === tag.name ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'bg-white hover:border-blue-200 shadow-sm'}">
              <div class="flex justify-between items-center">
                <div><div class="font-bold text-gray-900">{tag.name}</div><div class="text-xs text-gray-400 uppercase font-medium">{tag.kind || '通用'}</div></div>
                <div class="flex gap-1">
                  <button onclick={() => startEditTag(tag)} class="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                  <button onclick={() => deleteTag(tag)} class="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
              </div>
              {#if editingTag?.name === tag.name}
                <div class="mt-4 pt-4 border-t border-blue-100 space-y-4">
                  <div><label class="block text-xs font-bold text-gray-500 mb-1">名称</label><input type="text" bind:value={editTagName} class="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-2">分类</label>
                    <div class="flex gap-2 flex-wrap">
                      <button onclick={() => editTagKind = ''} class="px-2.5 py-1 text-xs rounded-lg transition-all {editTagKind === '' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}">不限</button>
                      {#each SNIPPET_TAG_KIND_OPTIONS as opt}<button onclick={() => editTagKind = opt} class="px-2.5 py-1 text-xs rounded-lg transition-all {editTagKind === opt ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}">{opt}</button>{/each}
                    </div>
                  </div>
                  <div class="flex gap-2"><button onclick={saveEditTag} class="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">保存修改</button><button onclick={cancelEditTag} class="px-4 py-2 text-sm font-bold text-gray-500">取消</button></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes zoom-in { from { transform: scale(0.95); } to { transform: scale(1); } }
  .animate-in { animation: fade-in 0.2s ease-out, zoom-in 0.2s ease-out; }
</style>
