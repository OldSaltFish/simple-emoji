<script lang="ts">
  import { onMount } from 'svelte';
  import { imagesApi } from '$lib/api/images';
  import type { Category, Tag } from '$lib/types';
  import { imageHostsApi } from '$lib/api/imageHosts';
  import Select from '$lib/components/Select.svelte';
  import { adminStore } from '$lib/stores/admin';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

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
    // 后端会自行轮询,不需要前端获取API配置
    await loadData();
  });
  async function loadData() {
    try {
      const [categoriesData, tagsData] = await Promise.all([
        imagesApi.getCategories(),
        imagesApi.getTags()
      ]);
      console.log('初始化数据',categoriesData,tagsData)
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

    // 支持多文件选择
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} 不是图片文件，已跳过`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} 超过10MB，已跳过`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // 统一添加到 selectedFiles
    const newProgress = validFiles.map(f => ({
      name: f.name,
      status: 'uploading' as const,
      message: '上传到图床中...'
    }));
    uploadProgress = [...uploadProgress, ...newProgress];
    selectedFiles = [...selectedFiles, ...validFiles];

    // 立即开始上传到图床
    await uploadToImageHost(validFiles, uploadProgress.length - validFiles.length);

    // 重置文件输入
    target.value = '';
  }

  async function uploadToImageHost(files: File[], startIndex: number) {
    uploading = true;

    // 所有文件并发上传到图床
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
    // 找出所有上传失败的文件索引
    const failedIndexes: number[] = [];
    for (let i = 0; i < uploadProgress.length; i++) {
      if (uploadProgress[i]?.status === 'error') {
        failedIndexes.push(i);
      }
    }

    if (failedIndexes.length === 0) {
      alert('没有需要重传的失败文件');
      return;
    }

    uploading = true;

    // 并发重传所有失败的文件
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

    // 统计结果
    const stillFailed = uploadProgress.filter(p => p?.status === 'error').length;
    const successCount = failedIndexes.length - stillFailed;
    alert(`重传完成：成功 ${successCount} 个，失败 ${stillFailed} 个`);
  }

  function hasFailedUploads(): boolean {
    return uploadProgress.some(p => p?.status === 'error');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
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
      alert('请输入分类名称');
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
    } catch (error) {
      console.error('创建分类失败:', error);
      alert('创建分类失败');
    }
  }

  async function handleSubmit() {
    if (selectedFiles.length === 0) {
      alert('请选择要上传的图片');
      return;
    }

    if (!selectedCategory) {
      alert('请选择图集');
      return;
    }

    uploading = true;

    // 过滤出已经上传到图床成功的文件
    const filesToSave = selectedFiles.filter(file => (file as any).uploadedUrl);

    if (filesToSave.length === 0) {
      alert('没有已上传到图床的文件，请等待上传完成');
      uploading = false;
      return;
    }

    // 构建批量上传请求数据
    const imagesData = filesToSave.map(file => ({
      url: (file as any).uploadedUrl,
      category_name: selectedCategory,
      description: description || file.name,
      tags: selectedTags
    }));

    try {
      // 使用批量接口保存到数据库
      const result = await imagesApi.batchUploadImages({ images: imagesData });

      uploading = false;

      alert(`保存完成：成功 ${result.success_count} 个，失败 ${result.fail_count} 个`);

      if (result.success_count === selectedFiles.length) {
        resetForm();
      }
    } catch (error) {
      uploading = false;
      console.error('批量保存失败:', error);
      alert('批量保存失败，请重试');
    }
  }

  function resetForm() {
    selectedFiles = [];
    selectedCategory = '';
    description = '';
    selectedTags = [];
    uploadProgress = [];

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
  
  function removeSelectedFile(index: number) {
    selectedFiles.splice(index, 1);
    uploadProgress.splice(index, 1);
  }
</script>

<svelte:head>
  <title>上传表情包 - 表情包网站</title>
  <meta name="description" content="上传你的表情包分享给大家" />
</svelte:head>

<div class="bg-gray-50">
  <!-- 主内容 -->
  <main class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">上传表情包</h2>

      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <!-- 文件上传 -->
        <div>
          <label for="file-input" class="block text-sm font-medium text-gray-700 mb-3">选择图片</label>

          <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <input
              id="file-input"
              type="file"
              multiple
              accept="image/*"
              onchange={handleFileSelect}
              class="hidden"
            />
            <label for="file-input" class="cursor-pointer">
              <svg class="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div class="text-gray-600">点击选择图片或拖拽到此处</div>
              <div class="text-sm text-gray-500 mt-1">支持 JPG、PNG、GIF 格式，最大 10MB，可多选</div>
            </label>
          </div>
        </div>

        <!-- 批量文件列表 -->
        {#if selectedFiles.length > 0}
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="block text-sm font-medium text-gray-700">待上传文件 ({selectedFiles.length} 个)</label>
              {#if hasFailedUploads()}
                <button
                  onclick={retryAllFailed}
                  disabled={uploading}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  一键重传失败项
                </button>
              {/if}
            </div>
            <div class="border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
              <div class="space-y-2">
                {#each selectedFiles as file, index}
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <div class="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                        <div class="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-2 flex-shrink-0">
                      {#if uploadProgress[index]?.status === 'pending'}
                        <span class="text-xs text-gray-500">等待上传</span>
                      {:else if uploadProgress[index]?.status === 'uploading'}
                        <span class="text-xs text-blue-600">上传中...</span>
                      {:else if uploadProgress[index]?.status === 'success'}
                        <span class="text-xs text-green-600">✓ 上传成功</span>
                      {:else if uploadProgress[index]?.status === 'error'}
                        <span class="text-xs text-red-600">✗ {uploadProgress[index]?.message}</span>
                        <button
                          onclick={() => retryUpload(index)}
                          disabled={uploading}
                          class="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="重新上传"
                          title="重新上传"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      {/if}

                      <button
                        onclick={() => removeSelectedFile(index)}
                        disabled={uploading}
                        class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="移除文件"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <!-- 图集选择 -->
        <div>
          <label for="category-select" class="block text-sm font-medium text-gray-700 mb-3">图集</label>
          
          {#if !showNewCategoryForm}
            <div class="space-y-3">
              <Select
                bind:value={selectedCategory}
                placeholder="请选择图集"
                options={categories.map(cat => ({ value: cat.name, label: cat.name }))}
                class="w-full"
              />
              
              <button
                onclick={() => showNewCategoryForm = true}
                class="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                + 创建新图集
              </button>
            </div>
          {:else}
            <div class="border border-gray-200 rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="图集名称"
                bind:value={newCategoryName}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
              />
              <textarea
                placeholder="图集描述（可选）"
                bind:value={newCategoryDescription}
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
              ></textarea>
              <div class="flex gap-2">
                <button
                  onclick={createNewCategory}
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  创建
                </button>
                <button
                  onclick={() => {
                    showNewCategoryForm = false;
                    newCategoryName = '';
                    newCategoryDescription = '';
                  }}
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- 描述 -->
        <div>
          <label for="description-textarea" class="block text-sm font-medium text-gray-700 mb-3">描述</label>
          <textarea
            id="description-textarea"
            placeholder="为这个表情包添加描述..."
            bind:value={description}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400"
          ></textarea>
        </div>

        <!-- 标签 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">标签</label>
          <div class="flex flex-wrap gap-2" role="group" aria-label="标签选择">
            {#each tags as tag}
              <button
                onclick={() => toggleTag(tag.name)}
                class="px-3 py-1.5 text-sm rounded-full border transition-colors"
                class:bg-blue-500={selectedTags.includes(tag.name)}
                class:text-white={selectedTags.includes(tag.name)}
                class:bg-white={!selectedTags.includes(tag.name)}
                class:border-gray-300={!selectedTags.includes(tag.name)}
                class:border-blue-500={selectedTags.includes(tag.name)}
                class:text-gray-700={!selectedTags.includes(tag.name)}
                class:hover:bg-gray-50={!selectedTags.includes(tag.name)}
                aria-pressed={selectedTags.includes(tag.name)}
              >
                {tag.name}
              </button>
            {/each}
          </div>
        </div>

        <!-- 提交按钮 -->
        <div class="flex gap-3 pt-4">
          <button
            onclick={handleSubmit}
            disabled={selectedFiles.length === 0 || !selectedCategory}
            class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {selectedFiles.length === 1
              ? '保存 1 个表情包到数据库'
              : `保存 ${selectedFiles.length} 个表情包到数据库`
            }
          </button>
          <button
            onclick={resetForm}
            class="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  </main>
</div>