<script lang="ts">
  import { onMount } from 'svelte';
  import { imagesApi } from '$lib/api/images';
  import type { Category, Image } from '$lib/types';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import { adminStore } from '$lib/stores/admin';
  import { showMessage } from '$lib/stores/messageStore';
  import { customConfirm } from '$lib/stores/dialogStore';

  let albums = $state<Category[]>([]);
  let loading = $state(true);
  let isAdmin = $state(false);
  let showEditModal = $state(false);
  let editingAlbum = $state<Category | null>(null);
  let editName = $state('');
  let editDescription = $state('');

  // 订阅管理员状态
  adminStore.subscribe(state => {
    isAdmin = state.isAdmin;
  });

  onMount(async () => {
    await loadAlbums();
  });

  async function loadAlbums() {
    loading = true;
    try {
      albums = await imagesApi.getCategories();
    } catch (error) {
      console.error('加载图集失败:', error);
    } finally {
      loading = false;
    }
  }

  function viewAlbum(categoryName: string) {
    window.location.href = `/recent?category=${encodeURIComponent(categoryName)}`;
  }

  function handleContextMenu(e: MouseEvent, album: Category) {
    if (!isAdmin) return;
    e.preventDefault();
    // 逻辑由 ContextMenu 组件处理
  }

  function startEditAlbum(album: Category) {
    editingAlbum = album;
    editName = album.name;
    editDescription = album.description || '';
    showEditModal = true;
  }

  async function saveEditAlbum() {
    if (!editingAlbum) return;
    try {
      await imagesApi.updateCategoryByName(editingAlbum.name, {
        name: editName,
        description: editDescription
      });
      showMessage('图集更新成功', 'success');
      showEditModal = false;
      await loadAlbums();
    } catch (error) {
      console.error('更新图集失败:', error);
      showMessage('更新失败，请重试', 'error');
    }
  }

  async function deleteAlbum(album: Category) {
    if (await customConfirm(`确定要删除图集 "${album.name}" 吗？这将同时删除该图集下的所有图片！`)) {
      try {
        await imagesApi.deleteCategoryByName(album.name);
        showMessage('图集已删除', 'success');
        await loadAlbums();
      } catch (error) {
        console.error('删除图集失败:', error);
        showMessage('删除失败，请重试', 'error');
      }
    }
  }
</script>

<svelte:head>
  <title>图集 - 表情包网站</title>
</svelte:head>

<div class="bg-gray-50 min-h-[calc(100vh-4rem)]">
  <main class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex justify-between items-center mb-8">
      <h2 class="text-2xl font-bold text-gray-900">图集展示</h2>
      {#if isAdmin}
        <a 
          href="/upload" 
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          上传图片
        </a>
      {/if}
    </div>

    {#if loading}
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    {:else if albums.length === 0}
      <div class="text-center py-20">
        <div class="text-gray-400 text-lg mb-4">暂无图集</div>
        {#if isAdmin}
          <a href="/upload" class="text-blue-600 font-medium hover:underline">立即创建第一个图集</a>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {#each albums as album}
          <div class="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 overflow-hidden relative">
            <button
              onclick={() => viewAlbum(album.name)}
              class="block w-full text-left"
            >
              <!-- 预览图 -->
              <div class="aspect-square bg-gray-100 relative overflow-hidden">
                {#if album.cover_url}
                  <img
                    src={album.cover_url}
                    alt={album.name}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    draggable="false"
                  />
                  <!-- loading="lazy" -->
                {:else}
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                {/if}
              </div>

              <!-- 信息 -->
              <div class="p-4">
                <h3 class="font-bold text-gray-900 truncate mb-1">{album.name}</h3>
                <p class="text-sm text-gray-500 line-clamp-1">{album.description || '暂无描述'}</p>
              </div>
            </button>

            <!-- 管理菜单 -->
            {#if isAdmin}
              <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ContextMenu 
                  items={[
                    { label: '编辑', onClick: () => startEditAlbum(album) },
                    { label: '删除', onClick: () => deleteAlbum(album), variant: 'danger' }
                  ]}
                />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- 编辑图集弹窗 -->
{#if showEditModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background-color: rgba(0, 0, 0, 0.5);">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
      <div class="px-6 py-4 border-b border-gray-100">
        <h3 class="text-lg font-bold text-gray-900">编辑图集</h3>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">名称</label>
          <input
            type="text"
            bind:value={editName}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            bind:value={editDescription}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          ></textarea>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/30">
        <button
          onclick={() => showEditModal = false}
          class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveEditAlbum}
          class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          保存
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes zoom-in { from { transform: scale(0.95); } to { transform: scale(1); } }
  .animate-in { animation: fade-in 0.2s ease-out, zoom-in 0.2s ease-out; }
</style>
