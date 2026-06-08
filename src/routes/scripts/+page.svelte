<script lang="ts">
  import {
    scriptApi,
    getLanguageTag,
    getFileExtension,
    wrapForRun,
    downloadAsFile,
    type ScriptItem,
    type ScriptTag,
  } from '$lib/api/script';
  import { adminStore } from '$lib/stores/admin';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';

  type SideTab = 'browse' | 'upload' | 'review';

  let isAdmin = $state(false);
  adminStore.subscribe((s) => (isAdmin = s.isAdmin));

  // ===== URL 可恢复状态 =====
  let activeTab = $state<SideTab>('browse');
  let scripts = $state<ScriptItem[]>([]);
  let total = $state(0);
  let currentPage = $state(1);
  let pageSize = $state(12);
  let loading = $state(false);
  let keyword = $state('');
  let filterLang = $state('');
  let filterTag = $state('');
  let languageTags = $state<ScriptTag[]>([]);
  let allTags = $state<ScriptTag[]>([]);
  let selectedScript = $state<ScriptItem | null>(null);
  let showDetail = $state(false);
  let copied = $state('');
  let copiedRun = $state(false);

  let uploadTitle = $state('');
  let uploadContent = $state('');
  let uploadDesc = $state('');
  let uploadAuthor = $state('');
  let uploadLang = $state('');
  let uploadTags = $state('');
  let uploading = $state(false);

  let reviewScripts = $state<ScriptItem[]>([]);
  let reviewTotal = $state(0);
  let reviewPage = $state(1);
  let reviewLoading = $state(false);

  const LANG_COLORS: Record<string, string> = {
    powershell: 'bg-blue-100 text-blue-700',
    pwsh: 'bg-blue-100 text-blue-700',
    bash: 'bg-green-100 text-green-700',
    shell: 'bg-green-100 text-green-700',
    python: 'bg-yellow-100 text-yellow-700',
    javascript: 'bg-amber-100 text-amber-700',
    js: 'bg-amber-100 text-amber-700',
    typescript: 'bg-blue-100 text-blue-800',
    ts: 'bg-blue-100 text-blue-800',
  };

  const TAG_COLORS = [
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
    'bg-cyan-100 text-cyan-700',
  ];

  function tagColor(name: string, kind: string | null): string {
    if (kind === 'language' && LANG_COLORS[name.toLowerCase()]) {
      return LANG_COLORS[name.toLowerCase()];
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  }

  function canWrapRun(langTag: string): boolean {
    const l = langTag.toLowerCase();
    return l === 'powershell' || l === 'pwsh' || l === 'bash' || l === 'shell';
  }

  // ===== URL 同步逻辑 =====
  function syncUrl() {
    const params = new URLSearchParams();
    if (activeTab !== 'browse') params.set('tab', activeTab);
    if (keyword.trim()) params.set('q', keyword.trim());
    if (filterLang) params.set('lang', filterLang);
    if (filterTag) params.set('tag', filterTag);
    if (currentPage > 1) params.set('page', currentPage.toString());
    const newUrl = `${page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    replaceState(newUrl, page.state);
  }

  function initFromUrl() {
    const params = page.url.searchParams;
    const tab = params.get('tab') as SideTab | null;
    if (tab === 'browse' || tab === 'upload' || (tab === 'review' && isAdmin)) {
      activeTab = tab;
    }
    keyword = params.get('q') || '';
    filterLang = params.get('lang') || '';
    filterTag = params.get('tag') || '';
    const p = parseInt(params.get('page') || '1');
    if (p >= 1) currentPage = p;
  }

  async function loadTags() {
    try {
      languageTags = await scriptApi.tags('language');
      allTags = await scriptApi.tags();
    } catch {}
  }

  async function loadScripts() {
    loading = true;
    try {
      const filters: { tag?: string; kind?: string; keyword?: string } = {};
      if (filterLang) filters.kind = 'language';
      if (filterLang) filters.tag = filterLang;
      else if (filterTag) filters.tag = filterTag;
      if (keyword.trim()) filters.keyword = keyword.trim();
      const res = await scriptApi.list(currentPage, pageSize, filters);
      scripts = res.list || [];
      total = res.total || 0;
    } catch {
      scripts = [];
      total = 0;
    } finally {
      loading = false;
    }
  }

  async function loadReviewScripts() {
    reviewLoading = true;
    try {
      const res = await scriptApi.list(reviewPage, 20, { status: 'pending' });
      reviewScripts = res.list || [];
      reviewTotal = res.total || 0;
    } catch {
      reviewScripts = [];
      reviewTotal = 0;
    } finally {
      reviewLoading = false;
    }
  }

  async function openDetail(id: number) {
    try {
      selectedScript = await scriptApi.detail(id);
      showDetail = true;
      copied = '';
      copiedRun = false;
    } catch {}
  }

  async function copyContent(content: string, label: string) {
    try {
      await navigator.clipboard.writeText(content);
      copied = label;
      setTimeout(() => (copied = ''), 2000);
    } catch {}
  }

  async function copyRunContent(content: string, langTag: string) {
    try {
      await navigator.clipboard.writeText(wrapForRun(content, langTag));
      copiedRun = true;
      setTimeout(() => (copiedRun = false), 2000);
    } catch {}
  }

  function handleDownload(script: ScriptItem) {
    const lang = getLanguageTag(script.tags);
    const ext = lang ? getFileExtension(lang.name) : 'txt';
    downloadAsFile(script.content, `${script.title}.${ext}`);
  }

  async function handleUpload() {
    if (!uploadTitle.trim() || !uploadContent.trim()) return;
    uploading = true;
    try {
      const tags: (string | { name: string; kind: string | null })[] = [];
      if (uploadLang) tags.push({ name: uploadLang, kind: 'language' });
      if (uploadTags.trim()) {
        for (const t of uploadTags.split(',')) {
          const name = t.trim();
          if (name && name !== uploadLang) tags.push({ name, kind: null });
        }
      }
      await scriptApi.create({
        title: uploadTitle.trim(),
        content: uploadContent,
        description: uploadDesc.trim() || undefined,
        author: uploadAuthor.trim() || undefined,
        tags,
      });
      uploadTitle = '';
      uploadContent = '';
      uploadDesc = '';
      uploadAuthor = '';
      uploadLang = '';
      uploadTags = '';
      activeTab = 'browse';
      syncUrl();
      loadScripts();
    } catch {
    } finally {
      uploading = false;
    }
  }

  async function handleReview(id: number, status: 'approved' | 'rejected') {
    try {
      await scriptApi.review(id, status);
      loadReviewScripts();
    } catch {}
  }

  // 包装筛选变化：更新URL + 重新加载
  function onFilterChange() {
    currentPage = 1;
    syncUrl();
    loadScripts();
  }

  // 包装Tab切换：更新URL
  function switchTab(tab: SideTab) {
    activeTab = tab;
    syncUrl();
  }

  function totalPages() {
    return Math.max(1, Math.ceil(total / pageSize));
  }

  function reviewTotalPages() {
    return Math.max(1, Math.ceil(reviewTotal / 20));
  }

  function goToPage(p: number) {
    if (p >= 1 && p <= totalPages()) {
      currentPage = p;
      syncUrl();
      loadScripts();
    }
  }

  onMount(() => {
    initFromUrl();
    loadTags();
    if (activeTab === 'browse') loadScripts();
  });

  $effect(() => {
    if (activeTab === 'review' && isAdmin) loadReviewScripts();
  });
</script>

<div class="h-[calc(100vh-4rem)] flex">
  <aside class="w-48 border-r border-gray-200 bg-gray-50/50 flex flex-col shrink-0">
    <div class="p-3">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">脚本分享</h2>
      <nav class="space-y-0.5">
        <button
          onclick={() => switchTab('browse')}
          class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors {activeTab === 'browse'
            ? 'bg-white text-blue-600 font-medium shadow-sm'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'}"
        >
          浏览脚本
        </button>
        <button
          onclick={() => switchTab('upload')}
          class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors {activeTab === 'upload'
            ? 'bg-white text-blue-600 font-medium shadow-sm'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'}"
        >
          上传脚本
        </button>
        {#if isAdmin}
          <button
            onclick={() => switchTab('review')}
            class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors {activeTab === 'review'
              ? 'bg-white text-blue-600 font-medium shadow-sm'
              : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'}"
          >
            审核管理
            {#if reviewTotal > 0}
              <span class="ml-1 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">{reviewTotal}</span>
            {/if}
          </button>
        {/if}
      </nav>
    </div>

    <div class="p-3 border-t border-gray-200">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">语言筛选</h3>
      <div class="space-y-0.5">
        <button
          onclick={() => { filterLang = ''; onFilterChange(); }}
          class="w-full text-left px-2 py-1 text-xs rounded transition-colors {!filterLang
            ? 'bg-blue-50 text-blue-600 font-medium'
            : 'text-gray-500 hover:bg-gray-100'}"
        >
          全部语言
        </button>
        {#each languageTags as lt}
          <button
            onclick={() => { filterLang = lt.name; onFilterChange(); }}
            class="w-full text-left px-2 py-1 text-xs rounded transition-colors {filterLang === lt.name
              ? 'bg-blue-50 text-blue-600 font-medium'
              : 'text-gray-500 hover:bg-gray-100'}"
          >
            {lt.name}
          </button>
        {/each}
      </div>
    </div>

    {#if allTags.filter((t) => t.kind !== 'language').length > 0}
      <div class="p-3 border-t border-gray-200 overflow-y-auto">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">标签筛选</h3>
        <div class="flex flex-wrap gap-1">
          <button
            onclick={() => { filterTag = ''; onFilterChange(); }}
            class="px-2 py-0.5 text-[10px] rounded-full transition-colors {!filterTag
              ? 'bg-blue-50 text-blue-600 font-medium'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
          >
            全部
          </button>
          {#each allTags.filter((t) => t.kind !== 'language') as at}
            <button
              onclick={() => { filterTag = at.name; onFilterChange(); }}
              class="px-2 py-0.5 text-[10px] rounded-full transition-colors {filterTag === at.name
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
            >
              {at.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </aside>

  <main class="flex-1 overflow-y-auto">
    {#if activeTab === 'browse'}
      <div class="p-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="flex-1 relative">
            <input
              type="text"
              placeholder="搜索脚本..."
              bind:value={keyword}
              onkeydown={(e) => e.key === 'Enter' && onFilterChange()}
              class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
            />
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onclick={onFilterChange}
            class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            搜索
          </button>
        </div>

        {#if loading}
          <div class="flex items-center justify-center py-20 text-gray-400">
            <svg class="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            加载中...
          </div>
        {:else if scripts.length === 0}
          <div class="text-center py-20 text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>暂无脚本</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {#each scripts as script}
              {@const lang = getLanguageTag(script.tags)}
              <button
                onclick={() => openDetail(script.id)}
                class="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div class="flex items-start justify-between gap-2 mb-2">
                  <h3 class="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {script.title}
                  </h3>
                  {#if lang}
                    <span class="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full {tagColor(lang.name, lang.kind)}">
                      {lang.name}
                    </span>
                  {/if}
                </div>
                {#if script.description}
                  <p class="text-xs text-gray-500 mb-3 line-clamp-2">{script.description}</p>
                {/if}
                <div class="flex flex-wrap gap-1 mb-3">
                  {#each script.tags.filter((t) => t.kind !== 'language') as st}
                    <span class="px-1.5 py-0.5 text-[10px] rounded-full {tagColor(st.name, st.kind)}">{st.name}</span>
                  {/each}
                </div>
                <div class="flex items-center justify-between text-[10px] text-gray-400">
                  <span>{script.author || '匿名'}</span>
                  <span>{new Date(script.created_at).toLocaleDateString()}</span>
                </div>
                <pre class="mt-2 text-[10px] text-gray-600 bg-gray-50 rounded p-2 overflow-hidden max-h-16 font-mono leading-tight">{script.content.slice(0, 200)}{script.content.length > 200 ? '...' : ''}</pre>
              </button>
            {/each}
          </div>

          {#if totalPages() > 1}
            <div class="flex items-center justify-center gap-2 mt-6">
              <button
                onclick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <span class="text-sm text-gray-500">{currentPage} / {totalPages()}</span>
              <button
                onclick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages()}
                class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          {/if}
        {/if}
      </div>

    {:else if activeTab === 'upload'}
      <div class="p-6 max-w-2xl">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">上传脚本</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
            <input
              type="text"
              bind:value={uploadTitle}
              placeholder="脚本标题"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">脚本内容 *</label>
            <textarea
              bind:value={uploadContent}
              placeholder="粘贴或输入脚本内容..."
              rows="12"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors font-mono resize-y"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              bind:value={uploadDesc}
              placeholder="简要描述脚本功能..."
              rows="2"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-y"
            ></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">作者</label>
              <input
                type="text"
                bind:value={uploadAuthor}
                placeholder="你的名字"
                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">语言标签 *</label>
              <select
                bind:value={uploadLang}
                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
              >
                <option value="">选择语言</option>
                {#each languageTags as lt}
                  <option value={lt.name}>{lt.name}</option>
                {/each}
                <option value="powershell">PowerShell</option>
                <option value="bash">Bash</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">其他标签</label>
            <input
              type="text"
              bind:value={uploadTags}
              placeholder="逗号分隔，如: 工具,网络,自动化"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <button
            onclick={handleUpload}
            disabled={!uploadTitle.trim() || !uploadContent.trim() || uploading}
            class="px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? '提交中...' : '提交审核'}
          </button>
          <p class="text-xs text-gray-400">提交后需管理员审核通过才会公开展示</p>
        </div>
      </div>

    {:else if activeTab === 'review' && isAdmin}
      <div class="p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">待审核脚本</h2>
        {#if reviewLoading}
          <div class="flex items-center justify-center py-20 text-gray-400">加载中...</div>
        {:else if reviewScripts.length === 0}
          <div class="text-center py-20 text-gray-400">
            <p>暂无待审核脚本</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each reviewScripts as rs}
              <div class="bg-white border border-gray-200 rounded-xl p-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-semibold text-gray-900">{rs.title}</h3>
                    {#if rs.author}
                      <p class="text-xs text-gray-500 mt-0.5">作者: {rs.author}</p>
                    {/if}
                    {#if rs.description}
                      <p class="text-xs text-gray-500 mt-1">{rs.description}</p>
                    {/if}
                    <div class="flex flex-wrap gap-1 mt-2">
                      {#each rs.tags as t}
                        <span class="px-1.5 py-0.5 text-[10px] rounded-full {tagColor(t.name, t.kind)}">{t.name}</span>
                      {/each}
                    </div>
                    <pre class="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-3 overflow-x-auto max-h-40 font-mono">{rs.content}</pre>
                  </div>
                  <div class="flex flex-col gap-2 shrink-0">
                    <button
                      onclick={() => handleReview(rs.id, 'approved')}
                      class="px-4 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      通过
                    </button>
                    <button
                      onclick={() => handleReview(rs.id, 'rejected')}
                      class="px-4 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          {#if reviewTotalPages() > 1}
            <div class="flex items-center justify-center gap-2 mt-6">
              <button
                onclick={() => { if (reviewPage > 1) { reviewPage--; loadReviewScripts(); } }}
                disabled={reviewPage <= 1}
                class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span class="text-sm text-gray-500">{reviewPage} / {reviewTotalPages()}</span>
              <button
                onclick={() => { if (reviewPage < reviewTotalPages()) { reviewPage++; loadReviewScripts(); } }}
                disabled={reviewPage >= reviewTotalPages()}
                class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </main>
</div>

{#if showDetail && selectedScript}
  {@const lang = getLanguageTag(selectedScript.tags)}
  {@const langName = lang?.name || ''}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    onclick={() => (showDetail = false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="flex items-center justify-between p-5 border-b border-gray-100">
        <div class="flex items-center gap-3 min-w-0">
          <h2 class="text-lg font-bold text-gray-900 truncate">{selectedScript.title}</h2>
          {#if lang}
            <span class="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded-full {tagColor(lang.name, lang.kind)}">{lang.name}</span>
          {/if}
        </div>
        <button
          onclick={() => (showDetail = false)}
          class="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if selectedScript.description}
        <p class="px-5 pt-4 text-sm text-gray-500">{selectedScript.description}</p>
      {/if}

      <div class="flex flex-wrap gap-1.5 px-5 pt-3">
        {#each selectedScript.tags.filter((t) => t.kind !== 'language') as st}
          <span class="px-2 py-0.5 text-[10px] rounded-full {tagColor(st.name, st.kind)}">{st.name}</span>
        {/each}
      </div>

      <div class="flex-1 overflow-y-auto p-5">
        <pre class="text-sm text-gray-800 bg-gray-50 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{selectedScript.content}</pre>
      </div>

      <div class="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
        <div class="text-xs text-gray-400">
          {selectedScript.author || '匿名'} · {new Date(selectedScript.created_at).toLocaleDateString()}
        </div>
        <div class="flex items-center gap-2">
          {#if langName && canWrapRun(langName)}
            <button
              onclick={() => copyRunContent(selectedScript!.content, langName)}
              class="px-3 py-1.5 text-xs font-medium border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
            >
              {#if copiedRun}
                ✓ 已复制(可运行)
              {:else}
                复制(可运行)
              {/if}
            </button>
          {/if}
          <button
            onclick={() => copyContent(selectedScript!.content, 'raw')}
            class="px-3 py-1.5 text-xs font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {copied === 'raw' ? '✓ 已复制' : '复制'}
          </button>
          <button
            onclick={() => handleDownload(selectedScript!)}
            class="px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            下载
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
