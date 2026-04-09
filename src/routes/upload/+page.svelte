<script lang="ts">
  import { onMount } from 'svelte';
  import { imagesApi } from '$lib/api/images';
  import type { Category, Tag } from '$lib/types';
  import { imageHostsApi } from '$lib/api/imageHosts';
  import Select from '$lib/components/Select.svelte';
  import { adminStore } from '$lib/stores/admin';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { showMessage } from '$lib/stores/messageStore';

  let categories = $state<Category[]>([]);
  let tags = $state<Tag[]>([]);
  let uploading = $state(false);
  let isAdmin = $state(false);

  // 检查管理员权限（仅在浏览器端执行）
  adminStore.subscribe(state => {
    isAdmin = state.isAdmin;
    if (browser && !isAdmin) {
      goto('/');
    }
  });

  // 表单数据
  let selectedFiles = $state<File[]>([]);
  let selectedCategory = $state<string>('');
  let description = $state('');
  let selectedTags = $state<string[]>([]);
  let newCategoryName = $state('');
  let newCategoryDescription = $state('');
  let showNewCategoryForm = $state(false);

  // 批量上传进度
  let uploadProgress = $state<{ name: string; status: 'pending' | 'uploading' | 'success' | 'error'; message?: string }[]>([]);
  
  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      const [categoriesData, tagsData] = await Promise.all([
        imagesApi.getCategories(),
        imagesApi.getTags()
      ]);
      categories = categoriesData;
      tags = tagsData;
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        showMessage(`${file.name} 不是图片文件，已跳过`, 'error');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        showMessage(`${file.name} 超过10MB，已跳过`, 'error');
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const newProgress = validFiles.map(f => ({
      name: f.name,
      status: 'uploading' as const,
      message: '上传到图床中...'
    }));
    uploadProgress = [...uploadProgress, ...newProgress];
    selectedFiles = [...selectedFiles, ...validFiles];

    await uploadToImageHost(validFiles, uploadProgress.length - validFiles.length);
    target.value = '';
  }

  async function uploadToImageHost(files: File[], startIndex: number) {
    uploading = true;
    const uploadPromises = files.map(async (file, index) => {
      const progressIndex = startIndex + index;
      try {
        const imageHostResult = await imageHostsApi.upload(file);
        uploadProgress[progressIndex].status = 'success';
        uploadProgress[progressIndex].message = '已上传到图床';
        (file as any).uploadedUrl = imageHostResult.url;
      } catch (error) {
        uploadProgress[progressIndex].status = 'error';
        uploadProgress[progressIndex].message = error instanceof Error ? error.message : '上传失败';
      }
    });
    await Promise.all(uploadPromises);
    uploading = false;
  }

  async function retryUpload(index: number) {
    const file = selectedFiles[index];
    if (!file) return;
    uploadProgress[index].status = 'uploading';
    uploadProgress[index].message = '重新上传中...';
    try {
      const imageHostResult = await imageHostsApi.upload(file);
      uploadProgress[index].status = 'success';
      uploadProgress[index].message = '已上传到图床';
      (file as any).uploadedUrl = imageHostResult.url;
    } catch (error) {
      uploadProgress[index].status = 'error';
      uploadProgress[index].message = error instanceof Error ? error.message : '上传失败';
    }
  }

  async function retryAllFailed() {
    const failedIndexes: number[] = [];
    for (let i = 0; i < uploadProgress.length; i++) {
      if (uploadProgress[i]?.status === 'error') {
        failedIndexes.push(i);
      }
    }
    if (failedIndexes.length === 0) {
      showMessage('没有需要重传的失败文件', 'info');
      return;
    }
    uploading = true;
    const retryPromises = failedIndexes.map(async (index) => {
      uploadProgress[index].status = 'uploading';
      uploadProgress[index].message = '重新上传中...';
      const file = selectedFiles[index];
      try {
        const imageHostResult = await imageHostsApi.upload(file);
        uploadProgress[index].status = 'success';
        uploadProgress[index].message = '已上传到图床';
        (file as any).uploadedUrl = imageHostResult.url;
      } catch (error) {
        uploadProgress[index].status = 'error';
        uploadProgress[index].message = error instanceof Error ? error.message : '上传失败';
      }
    });
    await Promise.all(retryPromises);
    uploading = false;
    const stillFailed = uploadProgress.filter(p => p?.status === 'error').length;
    const successCount = failedIndexes.length - stillFailed;
    showMessage(`重传完成：成功 ${successCount} 个，失败 ${stillFailed} 个`, stillFailed > 0 ? 'info' : 'success');
  }

  function hasFailedUploads(): boolean {
    return uploadProgress.some(p => p?.status === 'error');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function toggleTag(tagName: string) {
    if (selectedTags.includes(tagName)) {
      selectedTags = selectedTags.filter(name => name !== tagName);
    } else {
      selectedTags = [...selectedTags, tagName];
    }
  }

  async function createNewCategory() {
    if (!newCategoryName.trim()) {
      showMessage('请输入分类名称', 'error');
      return;
    }
    try {
      const newCategory = await imagesApi.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim()
      });
      categories = [...categories, newCategory];
      selectedCategory = newCategory.name;
      newCategoryName = '';
      newCategoryDescription = '';
      showNewCategoryForm = false;
      showMessage('创建分类成功', 'success');
    } catch (error) {
      console.error('创建分类失败:', error);
      showMessage('创建分类失败', 'error');
    }
  }

  async function handleSubmit() {
    if (selectedFiles.length === 0) {
      showMessage('请选择要上传的图片', 'error');
      return;
    }
    if (!selectedCategory) {
      showMessage('请选择图集', 'error');
      return;
    }
    uploading = true;
    const filesToSave = selectedFiles.filter(file => (file as any).uploadedUrl);
    if (filesToSave.length === 0) {
      showMessage('没有已上传到图床的文件，请等待上传完成', 'error');
      uploading = false;
      return;
    }
    const imagesData = filesToSave.map(file => ({
      url: (file as any).uploadedUrl,
      category_name: selectedCategory,
      description: description || file.name,
      tags: selectedTags
    }));
    try {
      const result = await imagesApi.batchUploadImages({ images: imagesData });
      uploading = false;
      showMessage(`保存完成：成功 ${result.success_count} 个，失败 ${result.fail_count} 个`, result.fail_count > 0 ? 'info' : 'success');
      if (result.success_count === selectedFiles.length) {
        resetForm();
      }
    } catch (error) {
      uploading = false;
      console.error('批量保存失败:', error);
      showMessage('批量保存失败，请重试', 'error');
    }
  }

  function resetForm() {
    selectedFiles = [];
    selectedCategory = '';
    description = '';
    selectedTags = [];
    uploadProgress = [];
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }
  
  function removeSelectedFile(index: number) {
    selectedFiles.splice(index, 1);
    uploadProgress.splice(index, 1);
  }
</script>

<svelte:head>
  <title>上传表情包 - 表情包网站</title>
</svelte:head>

<div class="bg-gray-50 min-h-[calc(100vh-4rem)]">
  <main class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">上传表情包</h2>

      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div>
          <label for="file-input" class="block text-sm font-medium text-gray-700 mb-3">选择图片</label>
          <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all group">
            <input id="file-input" type="file" multiple accept="image/*" onchange={handleFileSelect} class="hidden" />
            <label for="file-input" class="cursor-pointer">
              <svg class="mx-auto h-12 w-12 text-gray-400 mb-3 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div class="text-gray-600 font-medium">点击选择图片或拖拽到此处</div>
              <div class="text-sm text-gray-500 mt-1">支持 JPG, PNG, GIF，最大 10MB，可多选</div>
            </label>
          </div>
        </div>

        {#if selectedFiles.length > 0}
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="block text-sm font-medium text-gray-700">待上传文件 ({selectedFiles.length} 个)</label>
              {#if hasFailedUploads()}
                <button onclick={retryAllFailed} disabled={uploading} class="text-sm text-blue-600 hover:text-blue-700 font-medium">一键重传失败项</button>
              {/if}
            </div>
            <div class="border border-gray-200 rounded-xl p-2 max-h-60 overflow-y-auto bg-gray-50">
              <div class="space-y-1">
                {#each selectedFiles as file, index}
                  <div class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-gray-400">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                        <div class="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      {#if uploadProgress[index]?.status === 'uploading'}<span class="text-xs text-blue-600 animate-pulse">上传中...</span>
                      {:else if uploadProgress[index]?.status === 'success'}<span class="text-xs text-green-600 font-medium">✓ 已完成</span>
                      {:else if uploadProgress[index]?.status === 'error'}
                        <button onclick={() => retryUpload(index)} class="p-1 text-blue-500 hover:bg-blue-50 rounded-full" title="重试">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      {/if}
                      <button onclick={() => removeSelectedFile(index)} class="p-1 text-gray-400 hover:text-red-500 rounded-full">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <div>
          <label for="category-select" class="block text-sm font-medium text-gray-700 mb-3">目标图集</label>
          {#if !showNewCategoryForm}
            <div class="space-y-3">
              <Select bind:value={selectedCategory} placeholder="请选择图集" options={categories.map(cat => ({ value: cat.name, label: cat.name }))} class="w-full" />
              <button onclick={() => showNewCategoryForm = true} class="text-sm text-blue-600 hover:text-blue-700 font-medium">+ 创建新图集</button>
            </div>
          {:else}
            <div class="border border-blue-100 bg-blue-50/30 rounded-xl p-4 space-y-3">
              <input type="text" placeholder="图集名称" bind:value={newCategoryName} class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea placeholder="图集描述（可选）" bind:value={newCategoryDescription} rows="2" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              <div class="flex gap-2">
                <button onclick={createNewCategory} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">创建</button>
                <button onclick={() => { showNewCategoryForm = false; newCategoryName = ''; newCategoryDescription = ''; }} class="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium">取消</button>
              </div>
            </div>
          {/if}
        </div>

        <div>
          <label for="description-textarea" class="block text-sm font-medium text-gray-700 mb-3">默认描述</label>
          <textarea id="description-textarea" placeholder="将作为所有图片的初始描述..." bind:value={description} rows="2" class="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">图片标签</label>
          <div class="flex flex-wrap gap-2">
            {#each tags as tag}
              <button onclick={() => toggleTag(tag.name)} class="px-3 py-1.5 text-sm rounded-full border transition-all {selectedTags.includes(tag.name) ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}">{tag.name}</button>
            {/each}
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <button onclick={handleSubmit} disabled={selectedFiles.length === 0 || !selectedCategory} class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-blue-100">
            {selectedFiles.length <= 1 ? '保存到数据库' : `批量保存 ${selectedFiles.length} 个表情包`}
          </button>
          <button onclick={resetForm} class="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-all">重置</button>
        </div>
      </div>
    </div>
  </main>
</div>
