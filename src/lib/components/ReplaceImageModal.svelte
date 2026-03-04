<script lang="ts">
  import type { Image } from '$lib/types';
  import { imagesApi } from '$lib/api/images';
  import { showMessage } from '$lib/stores/messageStore';
  import { config } from '$lib/config/env';

  let { image = $bindable<Image | null>(), onClose = $bindable(), onSuccess = $bindable() } = $props();

  let selectedFile = $state<File | null>(null);
  let uploading = $state(false);
  let previewUrl = $state('');

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showMessage('请选择图片文件', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showMessage('图片大小不能超过10MB', 'error');
        return;
      }
      selectedFile = file;
      previewUrl = URL.createObjectURL(file);
    }
  }

  async function handleReplace() {
    if (!selectedFile || !image) return;

    uploading = true;
    try {
      // 先上传到图床
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch(`${config.apiBaseUrl}/bing/imgUpload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('上传失败');
      }

      const data = await response.json();
      const imageUrl = data.data?.url || data.url;

      if (!imageUrl) {
        throw new Error('获取图片URL失败');
      }

      // 调用替换API
      await imagesApi.replaceImage(parseInt(image.id, 10), imageUrl);

      showMessage('图片替换成功', 'success');
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('替换图片失败:', error);
      showMessage('替换图片失败，请重试', 'error');
    } finally {
      uploading = false;
    }
  }

  function handleClose() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    selectedFile = null;
    previewUrl = '';
    onClose?.();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if image}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onclick={handleBackdropClick}
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
      <!-- 头部 -->
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900">替换图片</h3>
        <button
          onclick={handleClose}
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="p-6 space-y-4 overflow-y-auto flex-1">
        <!-- 原图预览 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">原图片</label>
          <div class="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={image.url}
              alt={image.description || '原图片'}
              class="w-full h-full object-contain"
            />
          </div>
        </div>

        <!-- 新图选择 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">新图片</label>
          {#if previewUrl}
            <div class="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-3">
              <img
                src={previewUrl}
                alt="预览"
                class="w-full h-full object-contain"
              />
            </div>
            <button
              onclick={() => { selectedFile = null; previewUrl = ''; }}
              class="text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              重新选择
            </button>
          {:else}
            <label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
              <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-sm text-gray-500">点击选择图片</span>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                onchange={handleFileSelect}
              />
            </label>
          {/if}
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onclick={handleClose}
          class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onclick={handleReplace}
          disabled={!selectedFile || uploading}
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {#if uploading}
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            上传中...
          {:else}
            确认替换
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
