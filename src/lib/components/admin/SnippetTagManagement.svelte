<script lang="ts">
  import { onMount } from 'svelte';
  import { snippetTagsApi } from '$lib/api/snippetTags';
  import type { SnippetTag } from '$lib/types';
  import { SNIPPET_TAG_KIND_OPTIONS } from '$lib/types';
  import { showMessage } from '$lib/stores/messageStore';
  import { customConfirm } from '$lib/stores/dialogStore';

  let tags = $state<SnippetTag[]>([]);
  let kinds = $state<string[]>([]);
  let loading = $state(false);
  let showEditModal = $state(false);
  let editingTag = $state<Partial<SnippetTag>>({});
  let isNew = $state(false);
  let viewMode = $state<'all' | 'byKind'>('byKind');

  onMount(async () => {
    await Promise.all([loadTags(), loadKinds()]);
  });

  async function loadTags() {
    loading = true;
    try {
      tags = await snippetTagsApi.getTags();
    } catch (error) {
      console.error('加载代码片段标签失败:', error);
      showMessage('加载标签失败', 'error');
    } finally {
      loading = false;
    }
  }

  async function loadKinds() {
    try {
      kinds = await snippetTagsApi.getKinds();
    } catch (error) {
      console.error('加载标签种类失败:', error);
    }
  }

  function openAddModal() {
    editingTag = { name: '', kind: '其他' };
    isNew = true;
    showEditModal = true;
  }

  function openEditModal(tag: SnippetTag) {
    editingTag = { ...tag };
    isNew = false;
    showEditModal = true;
  }

  async function saveTag() {
    if (!editingTag.name) {
      showMessage('请输入标签名称', 'error');
      return;
    }

    try {
      if (isNew) {
        await snippetTagsApi.createTag(editingTag as any);
        showMessage('创建代码片段标签成功', 'success');
      } else {
        await snippetTagsApi.updateTag(editingTag.name!, editingTag);
        showMessage('更新代码片段标签成功', 'success');
      }
      await Promise.all([loadTags(), loadKinds()]);
      showEditModal = false;
    } catch (error) {
      console.error('保存标签失败:', error);
      showMessage('保存标签失败', 'error');
    }
  }

  async function deleteTag(name: string) {
    if (await customConfirm(`确定要删除代码片段标签 "${name}" 吗？`)) {
      try {
        await snippetTagsApi.deleteTag(name);
        showMessage('删除标签成功', 'success');
        await loadTags();
      } catch (error) {
        console.error('删除标签失败:', error);
        showMessage('删除标签失败', 'error');
      }
    }
  }

  let groupedTags = $derived.by(() => {
    const groups: Record<string, SnippetTag[]> = {};
    tags.forEach(tag => {
      const kind = tag.kind || '未分类';
      if (!groups[kind]) groups[kind] = [];
      groups[kind].push(tag);
    });
    return groups;
  });

  let allKindOptions = $derived([...new Set([...kinds, ...SNIPPET_TAG_KIND_OPTIONS])]);
</script>

<div class="bg-white rounded-lg shadow">
  <div class="p-6 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
    <div class="flex items-center gap-4">
      <h2 class="text-2xl font-bold text-gray-900">代码片段标签管理</h2>
      <div class="flex bg-gray-100 rounded-lg p-1">
        <button
          onclick={() => viewMode = 'byKind'}
          class="px-3 py-1.5 text-sm font-medium rounded-md transition-all {viewMode === 'byKind' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
        >
          按维度
        </button>
        <button
          onclick={() => viewMode = 'all'}
          class="px-3 py-1.5 text-sm font-medium rounded-md transition-all {viewMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
        >
          列表
        </button>
      </div>
    </div>
    <button
      onclick={openAddModal}
      class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
    >
      添加代码标签
    </button>
  </div>

  <div class="p-6">
    <p class="text-sm text-gray-500 mb-6">管理用于代码片段分类的标签，支持按语言、框架、工具等维度进行管理。</p>

    {#if loading}
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600">加载中...</p>
      </div>
    {:else}
      {#if viewMode === 'byKind'}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          {#each Object.entries(groupedTags) as [kind, kindTags]}
            <div class="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-1 h-5 bg-blue-500 rounded-full"></span>
                  {kind}
                </div>
                <span class="text-xs font-normal bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{kindTags.length}</span>
              </h3>
              <div class="flex flex-wrap gap-2">
                {#each kindTags as tag}
                  <div class="group bg-white border border-gray-200 rounded-lg pl-3 pr-1 py-1 flex items-center gap-1 hover:border-blue-300 hover:shadow-sm transition-all">
                    <span class="text-gray-700 text-sm">{tag.name}</span>
                    <div class="flex items-center">
                      <button onclick={() => openEditModal(tag)} class="p-1 text-gray-400 hover:text-blue-600" title="编辑">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onclick={() => deleteTag(tag.name)} class="p-1 text-gray-400 hover:text-red-600" title="删除">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex flex-wrap gap-3">
          {#each tags as tag}
            <div class="group bg-white border border-gray-200 rounded-lg pl-4 pr-2 py-2 flex items-center gap-3 hover:border-blue-300 transition-all">
              <div class="flex flex-col">
                <span class="text-gray-800 font-medium">{tag.name}</span>
                <span class="text-[10px] text-gray-400 uppercase tracking-wider">{tag.kind || '未分类'}</span>
              </div>
              <div class="flex items-center gap-1 border-l border-gray-100 pl-2">
                <button onclick={() => openEditModal(tag)} class="p-1 text-gray-400 hover:text-blue-600">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onclick={() => deleteTag(tag.name)} class="p-1 text-gray-400 hover:text-red-600">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showEditModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold text-gray-900 mb-6">{isNew ? '添加代码片段标签' : '编辑标签信息'}</h3>
      <div class="space-y-5">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">标签名称</label>
          <input
            bind:value={editingTag.name}
            type="text"
            readonly={!isNew}
            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            class:bg-gray-50={!isNew}
            placeholder="例如：Vue, React, Utility"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">所属维度 (Kind)</label>
          <div class="relative">
            <input
              bind:value={editingTag.kind}
              type="text"
              list="snippet-kind-options"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="选择或输入维度"
            />
            <datalist id="snippet-kind-options">
              {#each allKindOptions as kind}
                <option value={kind}></option>
              {/each}
            </datalist>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            {#each SNIPPET_TAG_KIND_OPTIONS as option}
              <button 
                onclick={() => editingTag.kind = option}
                class="text-[11px] px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
              >
                {option}
              </button>
            {/each}
          </div>
        </div>
      </div>
      <div class="mt-8 flex justify-end gap-3">
        <button
          onclick={() => showEditModal = false}
          class="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveTag}
          class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md hover:shadow-lg transition-all"
        >
          确定并保存
        </button>
      </div>
    </div>
  </div>
{/if}
