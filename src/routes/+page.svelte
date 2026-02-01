<script lang="ts">
  import { onMount } from 'svelte';
  import { imagesApi } from '$lib/api/images';
  import type { Category, Image } from '$lib/types';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import JSZip from 'jszip';
  import { adminStore } from '$lib/stores/admin';
  import { showMessage } from '$lib/stores/messageStore';
  import { goto } from '$app/navigation';

  let albums = $state<(Category & { previewImage?: Image })[]>([]);
  let loading = $state(false);
  let contextMenu = $state<ContextMenu>();
  let contextMenuItems = $state<{ label: string; icon?: string; action: () => void; danger?: boolean; divider?: boolean }[]>([]);
  let currentAlbum = $state<(Category & { previewImage?: Image }) | null>(null);
  let isAdmin = $state(false);
  let editingAlbum = $state<Category | null>(null);
  let editName = $state('');
  let editDescription = $state('');

  adminStore.subscribe(state => {
    isAdmin = state.isAdmin;
  });

  onMount(async () => {
    await loadAlbums();
  });

  async function loadAlbums() {
    loading = true;
    try {
      const categories = await imagesApi.getCategories();

      const albumsWithPreview = await Promise.all(
        categories.map(async (category) => {
          try {
            const response = await imagesApi.getImages({
              category: category.name,
              page: 1,
              page_size: 1
            });
            return {
              ...category,
              previewImage: response.images[0]
            };
          } catch (error) {
            console.error(`加载图集 ${category.name} 预览失败:`, error);
            return { ...category, previewImage: undefined };
          }
        })
      );

      albums = albumsWithPreview;
    } catch (error) {
      console.error('加载图集失败:', error);
    } finally {
      loading = false;
    }
  }

  async function downloadAlbum(album: Category & { previewImage?: Image }) {
    try {
      const response = await imagesApi.getImages({
        category: album.name,
        page: 1,
        page_size: 9999
      });

      if (!response.images || response.images.length === 0) {
        showMessage('该图集下没有图片', 'info');
        return;
      }

      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;

      for (const image of response.images) {
        try {
          const imageResponse = await fetch(image.url);
          const blob = await imageResponse.blob();
          const fileName = image.description || `image_${image.id}.${blob.type.split('/')[1] || 'png'}`;
          zip.file(fileName, blob);
          successCount++;
        } catch (error) {
          console.error('下载图片失败:', image.id, error);
          failCount++;
        }
      }

      if (successCount === 0) {
        showMessage('没有成功下载任何图片', 'error');
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${album.name}_表情包_${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (failCount > 0) {
        showMessage(`成功打包 ${successCount} 个图片，失败 ${failCount} 个`, 'info');
      } else {
        showMessage(`成功打包 ${successCount} 个图片`, 'success');
      }
    } catch (error) {
      console.error('下载图集失败:', error);
      showMessage('下载图集失败，请重试', 'error');
    }
  }

  function startEditAlbum(album: Category) {
    editingAlbum = album;
    editName = album.name;
    editDescription = album.description || '';
  }

  async function saveEditAlbum() {
    if (!editingAlbum || !editName.trim()) return;

    try {
      // 使用原名称作为标识符更新
      await imagesApi.updateCategoryByName(editingAlbum.name, {
        name: editName.trim(),
        description: editDescription.trim() || undefined
      });
      showMessage('图集更新成功', 'success');
      editingAlbum = null;
      await loadAlbums();
    } catch (error) {
      console.error('更新图集失败:', error);
      showMessage('更新图集失败，请重试', 'error');
    }
  }

  async function deleteAlbum(album: Category & { previewImage?: Image }) {
    if (!confirm(`确定要删除图集 "${album.name}" 吗？这将同时删除该图集下的所有图片！`)) {
      return;
    }

    try {
      // 删除图集及其所有图片（使用名称作为标识符）
      await imagesApi.deleteCategoryByName(album.name);
      showMessage('图集及其图片已删除', 'success');
      await loadAlbums();
    } catch (error) {
      console.error('删除图集失败:', error);
      showMessage('删除图集失败，请重试', 'error');
    }
  }

  function buildAlbumContextMenu(album: Category & { previewImage?: Image }) {
    currentAlbum = album;
    contextMenuItems = [
      {
        label: '下载图集',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />',
        action: () => downloadAlbum(album)
      },
      {
        label: '复制名称',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />',
        action: () => {
          navigator.clipboard.writeText(album.name);
          showMessage('名称已复制', 'success');
        }
      }
    ];

    // 管理员功能
    if (isAdmin) {
      contextMenuItems.push(
        { divider: true } as any,
        {
          label: '编辑图集',
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />',
          action: () => startEditAlbum(album)
        },
        {
          label: '删除图集',
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />',
          action: () => deleteAlbum(album),
          danger: true
        }
      );
    }
  }

  function handleAlbumContextMenu(event: MouseEvent, album: Category & { previewImage?: Image }) {
    buildAlbumContextMenu(album);
    contextMenu?.handleContextMenu(event);
  }

  function handleAlbumTouchStart(event: TouchEvent, album: Category & { previewImage?: Image }) {
    buildAlbumContextMenu(album);
    contextMenu?.handleTouchStart(event);
  }

  function viewAlbum(albumName: string) {
    goto(`/recent?category=${encodeURIComponent(albumName)}`);
  }
</script>

<svelte:head>
  <title>图集 - 表情包网站</title>
  <meta name="description" content="浏览所有表情包图集" />
</svelte:head>

<ContextMenu bind:this={contextMenu} items={contextMenuItems} />

<div class="bg-gray-50" style="height: calc(100vh - 64px);">
  <main class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    {:else if albums.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-lg mb-2">暂无图集</div>
        {#if isAdmin}
          <div class="text-gray-500">去上传页面创建新图集吧</div>
          <a href="/upload" class="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            去上传
          </a>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {#each albums as album}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            oncontextmenu={(e) => handleAlbumContextMenu(e, album)}
            ontouchstart={(e) => handleAlbumTouchStart(e, album)}
            ontouchend={() => contextMenu?.handleTouchEnd()}
            ontouchmove={() => contextMenu?.handleTouchMove()}
          >
            <button
              type="button"
              onclick={() => viewAlbum(album.name)}
              class="block w-full text-left"
            >
              <!-- 预览图 -->
              <div class="aspect-square bg-gray-100 relative overflow-hidden">
                {#if album.previewImage}
                  <img
                    src={album.previewImage.url}
                    alt={album.name}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                    draggable="false"
                  />
                {:else}
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                {/if}
              </div>

              <!-- 图集信息 -->
              <div class="p-3">
                <h3 class="font-medium text-gray-900 truncate">{album.name}</h3>
                {#if album.description}
                  <p class="text-sm text-gray-500 mt-1 line-clamp-2">{album.description}</p>
                {/if}
              </div>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- 编辑图集弹窗 -->
{#if editingAlbum}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onclick={(e) => { if (e.target === e.currentTarget) editingAlbum = null; }}>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">编辑图集</h3>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">图集名称</label>
          <input
            type="text"
            bind:value={editName}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
          <textarea
            bind:value={editDescription}
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
          ></textarea>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onclick={() => editingAlbum = null}
          class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveEditAlbum}
          disabled={!editName.trim()}
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  </div>
{/if}
