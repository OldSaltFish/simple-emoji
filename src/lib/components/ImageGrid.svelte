<script lang="ts">
  import type { Image, Category } from '$lib/types';
  import JSZip from 'jszip';
  import ContextMenu from './ContextMenu.svelte';
  import Select from './Select.svelte';
  import { adminStore } from '$lib/stores/admin';
  import { showMessage } from '$lib/stores/messageStore';
  import { config } from '$lib/config/env';

  let {
    images = $bindable([]),
    loading = $bindable(false),
    categories = $bindable([]),
    onBatchUpdateCategory = $bindable(),
    onReplaceImage = $bindable(),
    onDeleteImage = $bindable(),
    onEditImage = $bindable()
  } = $props();

  let selectedIds = $state<Set<string>>(new Set());
  let downloadMode = $state<'individual' | 'zip'>('individual');
  let contextMenu = $state<ContextMenu>();
  let contextMenuItems = $state<{ label: string; icon?: string; action: () => void; danger?: boolean; divider?: boolean }[]>([]);
  let currentImage = $state<Image | null>(null);
  let isAdmin = $state(false);

  // 订阅管理员状�?  
  adminStore.subscribe(state => {
    isAdmin = state.isAdmin;
  });

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('zh-CN');
  }

  // 缓存已获取的blob，避免重复下�?  
  const imageBlobCache = new Map<string, Blob>();

  async function getImageBlob(image: Image): Promise<Blob> {
    // 检查缓�?    
    if (imageBlobCache.has(image.url)) {
      return imageBlobCache.get(image.url)!;
    }

    let blob: Blob;

    // 尝试从已加载的img元素获取（同源或支持CORS的图片）
    const imgElement = document.querySelector(`img[src="${image.url}"]`) as HTMLImageElement;
    if (imgElement && imgElement.complete) {
      try {
        // 尝试使用canvas获取图片数据
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const response = await fetch(dataUrl);
          blob = await response.blob();
          imageBlobCache.set(image.url, blob);
          return blob;
        }
      } catch (canvasError) {
        // canvas失败（跨域限制），继续尝试fetch
        console.warn('Canvas获取失败，尝试fetch:', canvasError);
      }
    }

    // 尝试直接fetch
    try {
      const response = await fetch(image.url);
      blob = await response.blob();
      imageBlobCache.set(image.url, blob);
      return blob;
    } catch (fetchError) {
      // 直接fetch失败，尝试通过后端代理
      console.warn('直接fetch失败，尝试使用代�?', fetchError);
      const encodedUrl = encodeURIComponent(image.url);
      const proxyResponse = await fetch(`${config.apiBaseUrl}/bing/imgProxy?url=${encodedUrl}`);
      blob = await proxyResponse.blob();
      imageBlobCache.set(image.url, blob);
      return blob;
    }
  }

  async function downloadImage(image: Image) {
    try {
      const blob = await getImageBlob(image);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.description || `image_${image.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      showMessage('下载失败，请重试');
    }
  }

  async function copyImage(image: Image) {
    try {
      // 直接使用 fetch 获取图片 blob，避�?canvas 跨域问题
      let blob: Blob;
      
      // 尝试直接 fetch
      try {
        const response = await fetch(image.url);
        blob = await response.blob();
      } catch (fetchError) {
        // 使用后端代理
        console.warn('直接 fetch 失败，使用代�?', fetchError);
        const encodedUrl = encodeURIComponent(image.url);
        const proxyResponse = await fetch(`${config.apiBaseUrl}/bing/imgProxy?url=${encodedUrl}`);
        blob = await proxyResponse.blob();
      }
      
      // 尝试使用 Clipboard API 复制图片
      if (navigator.clipboard && navigator.clipboard.write) {
        // 确保文档处于聚焦状�?        
        if (document.hasFocus()) {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          showMessage('图片已复制到剪切板', 'success');
        } else {
          // 文档未聚焦，降级复制链接
          await navigator.clipboard.writeText(image.url);
          showMessage('图片链接已复制', 'info');
        }
      } else {
        // 降级：复制图片链�?        
        await navigator.clipboard.writeText(image.url);
        showMessage('图片链接已复制（浏览器不支持直接复制图片', 'info');
      }
    } catch (error) {
      console.error('复制失败:', error);
      // 降级：复制图片链�?      
      try {
        await navigator.clipboard.writeText(image.url);
        showMessage('图片链接已复制', 'info');
      } catch {
        showMessage('复制失败，请重试', 'error');
      }
    }
  }

  function toggleSelect(imageId: string) {
    if (selectedIds.has(imageId)) {
      selectedIds.delete(imageId);
      selectedIds = new Set(selectedIds);
    } else {
      selectedIds.add(imageId);
      selectedIds = new Set(selectedIds);
    }
  }

  function toggleAll() {
    if (selectedIds.size === images.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(images.map(img => img.id));
    }
  }

  function handleBatchUpdate(categoryName: string) {
    if (onBatchUpdateCategory && selectedIds.size > 0 && categoryName) {
      onBatchUpdateCategory(Array.from(selectedIds).map(id => parseInt(id, 10)).filter(id => !isNaN(id)), categoryName);
      selectedIds = new Set();
    }
  }

  async function handleBatchDownload() {
    const selectedImages = images.filter(img => selectedIds.has(img.id));

    if (downloadMode === 'zip') {
      await downloadAsZip(selectedImages);
    } else {
      for (const image of selectedImages) {
        try {
          await downloadImage(image);
          // 延迟一小段时间，避免浏览器同时处理太多下载
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error('下载失败:', image.id, error);
        }
      }
    }
  }

  async function downloadAsZip(images: Image[]) {
    const zip = new JSZip();
    let successCount = 0;
    let failCount = 0;

    for (const image of images) {
      try {
        const blob = await getImageBlob(image);
        const fileName = image.description || `image_${image.id}.${blob.type.split('/')[1] || 'png'}`;
        zip.file(fileName, blob);
        successCount++;
      } catch (error) {
        console.error('添加到ZIP失败:', image.id, error);
        failCount++;
      }
    }

    if (successCount === 0) {
      showMessage('没有成功添加任何文件到压缩包');
      return;
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `表情包_${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (failCount > 0) {
        showMessage(`成功打包 ${successCount} 个文件，失败 ${failCount} 个文件`);
      }
    } catch (error) {
      console.error('生成压缩包失�?', error);
      showMessage('生成压缩包失败，请重试');
    }
  }

  // 构建图片右键菜单
  function buildImageContextMenu(image: Image) {
    currentImage = image;
    contextMenuItems = [
      {
        label: '下载图片',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />',
        action: () => downloadImage(image)
      },
      {
        label: '复制图片',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />',
        action: () => copyImage(image)
      }
    ];

    // 管理操作（仅管理员可见）
    if (isAdmin && (onReplaceImage || onEditImage || onDeleteImage)) {
      contextMenuItems.push({ divider: true } as any);

      if (onReplaceImage) {
        contextMenuItems.push({
          label: '替换图片',
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />',
          action: () => onReplaceImage(image)
        });
      }

      if (onEditImage) {
        contextMenuItems.push({
          label: '编辑信息',
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />',
          action: () => onEditImage(image)
        });
      }

      if (onDeleteImage) {
        contextMenuItems.push({
          label: '删除图片',
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />',
          action: () => {
            if (confirm(`确定要删除"${image.description || '未命名表'}" 吗？`)) {
              onDeleteImage(image);
            }
          },
          danger: true
        });
      }
    }
  }

  // 处理右键事件
  function handleImageContextMenu(event: MouseEvent, image: Image) {
    buildImageContextMenu(image);
    contextMenu?.handleContextMenu(event);
  }

  // 处理长按事件
  function handleImageTouchStart(event: TouchEvent, image: Image) {
    buildImageContextMenu(image);
    contextMenu?.handleTouchStart(event);
  }
</script>

<ContextMenu bind:this={contextMenu} items={contextMenuItems} />

<div class="max-w-full mx-auto px-2 xs:px-3 sm:px-4 lg:px-8 py-3 xs:py-4 sm:py-6">
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if images.length === 0}
    <div class="text-center py-12">
      <div class="text-gray-400 text-lg mb-2">暂无表情</div>
      <div class="text-gray-500">试试调整筛选条件或上传新的表情</div>
    </div>
  {:else}
    <!-- 操作�?- 固定高度避免跳动 -->
    <div class="mb-4 min-h-[40px]">
      <div class="flex flex-wrap items-center gap-2">
        <!-- 全选按�?-->
        <button
          onclick={toggleAll}
          class="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg class="w-4 sm:w-5 h-4 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-gray-700">
            {selectedIds.size === images.length ? '取消' : '全选'}
          </span>
        </button>

        <!-- 批量操作 - 选中时显�?-->
        {#if selectedIds.size > 0}
          <span class="text-sm text-gray-700 whitespace-nowrap">
            {selectedIds.size}�?          </span>

          <!-- 下载方式选择 -->
          <Select
            bind:value={downloadMode}
            options={[
              { value: 'individual', label: '逐个' },
              { value: 'zip', label: '打包' }
            ]}
            class="w-20 sm:w-24"
          />

          <button
            onclick={handleBatchDownload}
            class="flex items-center gap-1 px-2 sm:px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title={downloadMode === 'zip' ? '打包下载' : '批量下载'}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span class="text-sm hidden sm:inline">
              {downloadMode === 'zip' ? '打包' : '下载'}
            </span>
          </button>

        {#if isAdmin}
          <Select
            value=""
            placeholder="改图�?.."
            options={categories.map(cat => ({ value: cat.name, label: cat.name }))}
            onChange={(value: string) => handleBatchUpdate(value)}
            class="w-24 sm:w-28"
          />
        {/if}

          <button
            onclick={() => selectedIds = new Set()}
            class="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="取消选择"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {#each images as image}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="group relative bg-white rounded-lg border-2 {selectedIds.has(image.id) ? 'border-blue-500' : 'border-gray-200'} overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          oncontextmenu={(e) => handleImageContextMenu(e, image)}
          ontouchstart={(e) => handleImageTouchStart(e, image)}
          ontouchend={() => contextMenu?.handleTouchEnd()}
          ontouchmove={() => contextMenu?.handleTouchMove()}
        >
          <!-- 选择�?-->
          <div class="absolute top-2 left-2 z-10">
            <button
              onclick={() => toggleSelect(image.id)}
              class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors xs:w-6 xs:h-6"
              class:border-blue-500={selectedIds.has(image.id)}
              class:border-gray-300={!selectedIds.has(image.id)}
              class:bg-blue-500={selectedIds.has(image.id)}
              class:bg-white={!selectedIds.has(image.id)}
            >
              {#if selectedIds.has(image.id)}
                <svg class="w-3.5 h-3.5 text-white xs:w-4 xs:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </button>
          </div>

          <!-- 图片 -->
          <div class="aspect-square relative bg-gray-50">
            <img
              src={image.url}
              alt={image.description || ''}
              class="w-full h-full object-cover"
              loading="lazy"
              draggable="false"
            />

            <!-- 悬停操作按钮 -->
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onclick={() => downloadImage(image)}
                class="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                title="下载"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onclick={() => copyImage(image)}
                class="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                title="复制图片"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 信息 -->
          <div class="p-2 xs:p-3">
            <div class="text-xs sm:text-sm font-medium text-gray-900 truncate mb-1">
              {image.description || '未命名表'}
            </div>

            <!-- 分类 -->
            {#if image.category}
              <div class="text-xs text-blue-600 mb-1">
                {image.category.name}
              </div>
            {/if}

            <!-- 标签 -->
            {#if image.tags && image.tags.length > 0}
              <div class="flex flex-wrap gap-1 mb-2">
                {#each image.tags.slice(0, 2) as tag}
                  <span class="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    {tag.name}
                  </span>
                {/each}
                {#if image.tags.length > 2}
                  <span class="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    +{image.tags.length - 2}
                  </span>
                {/if}
              </div>
            {/if}

            <!-- 元信�?-->
            <div class="flex justify-between items-center text-xs text-gray-500 xs:text-xs">
              <span>{formatDate(image.created_at)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
