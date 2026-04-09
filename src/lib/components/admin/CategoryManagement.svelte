<script lang="ts">
  import { onMount } from 'svelte';
  import { imagesApi } from '$lib/api/images';
  import type { Category, Image } from '$lib/types';
  import { showMessage } from '$lib/stores/messageStore';
  import { customConfirm } from '$lib/stores/dialogStore';

  let categories = $state<Category[]>([]);
  let loading = $state(false);
  let showEditModal = $state(false);
  let showSelectCoverModal = $state(false);
  let editingCategory = $state<Partial<Category>>({});
  let isNew = $state(false);
  let categoryImages = $state<Image[]>([]);
  let loadingImages = $state(false);
  let batchProcessing = $state(false);

  onMount(async () => {
    await loadCategories();
  });

  async function loadCategories() {
    loading = true;
    try {
      categories = await imagesApi.getCategories();
    } catch (error) {
      console.error('加载分类失败:', error);
      showMessage('加载分类失败', 'error');
    } finally {
      loading = false;
    }
  }

  function openAddModal() {
    editingCategory = { name: '', description: '', cover_url: '' };
    isNew = true;
    showEditModal = true;
  }

  function openEditModal(category: Category) {
    editingCategory = { ...category };
    isNew = false;
    showEditModal = true;
  }

  async function saveCategory() {
    if (!editingCategory.name) {
      showMessage('请输入分类名称', 'error');
      return;
    }

    try {
      if (isNew) {
        await imagesApi.createCategory(editingCategory as any);
        showMessage('创建分类成功', 'success');
      } else {
        await imagesApi.updateCategoryByName(editingCategory.name!, editingCategory);
        showMessage('更新分类成功', 'success');
      }
      await loadCategories();
      showEditModal = false;
    } catch (error) {
      console.error('保存分类失败:', error);
      showMessage('保存分类失败', 'error');
    }
  }

  async function deleteCategory(name: string) {
    if (await customConfirm(`确定要删除分类 "${name}" 吗？`)) {
      try {
        await imagesApi.deleteCategoryByName(name);
        showMessage('删除分类成功', 'success');
        await loadCategories();
      } catch (error) {
        console.error('删除分类失败:', error);
        showMessage('删除分类失败', 'error');
      }
    }
  }

  async function handleCoverUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !editingCategory.name) return;

    try {
      const result = await imagesApi.uploadCategoryCover(editingCategory.name, file);
      editingCategory.cover_url = result.cover_url;
      showMessage('封面上传成功', 'success');
    } catch (error) {
      console.error('上传封面失败:', error);
      showMessage('上传封面失败', 'error');
    }
  }

  async function openSelectCoverModal() {
    if (!editingCategory.name) return;
    showSelectCoverModal = true;
    loadingImages = true;
    try {
      const response = await imagesApi.getImages({ category: editingCategory.name, page_size: 100 });
      categoryImages = response.images;
    } catch (error) {
      console.error('加载图片失败:', error);
      showMessage('加载图片失败', 'error');
    } finally {
      loadingImages = false;
    }
  }

  async function selectCover(imageUrl: string) {
    if (!editingCategory.name) return;
    try {
      await imagesApi.setCategoryCover(editingCategory.name, imageUrl);
      editingCategory.cover_url = imageUrl;
      showMessage('封面设置成功', 'success');
      showSelectCoverModal = false;
    } catch (error) {
      console.error('设置封面失败:', error);
      showMessage('设置封面失败', 'error');
    }
  }

  async function batchAutoSetCovers() {
    const categoriesWithoutCover = categories.filter(c => !c.cover_url);
    if (categoriesWithoutCover.length === 0) {
      showMessage('所有图集都已有封面', 'info');
      return;
    }

    if (!(await customConfirm(`确定要为 ${categoriesWithoutCover.length} 个未设置封面的图集自动匹配第一张图片作为封面吗？`))) {
      return;
    }

    batchProcessing = true;
    let successCount = 0;
    let skipCount = 0;

    try {
      for (const category of categoriesWithoutCover) {
        const response = await imagesApi.getImages({ category: category.name, page_size: 1 });
        if (response.images && response.images.length > 0) {
          await imagesApi.setCategoryCover(category.name, response.images[0].url);
          successCount++;
        } else {
          skipCount++;
        }
      }
      
      showMessage(`处理完成：成功设置 ${successCount} 个封面${skipCount > 0 ? `，${skipCount} 个图集为空已跳过` : ''}`, 'success');
      await loadCategories();
    } catch (error) {
      console.error('批量设置封面失败:', error);
      showMessage('批量处理过程中出现错误', 'error');
    } finally {
      batchProcessing = false;
    }
  }
</script>

<div class="bg-white rounded-lg shadow">
  <div class="p-6 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
    <h2 class="text-2xl font-bold text-gray-900">图集管理</h2>
    <div class="flex gap-3">
      <button
        onclick={batchAutoSetCovers}
        disabled={batchProcessing || loading}
        class="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {#if batchProcessing}
          <div class="w-4 h-4 border-2 border-green-700 border-t-transparent animate-spin rounded-full"></div>
          处理中...
        {:else}
          <span>🪄 批量自动设置封面</span>
        {/if}
      </button>
      <button
        onclick={openAddModal}
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        添加图集
      </button>
    </div>
  </div>

  <div class="p-6">
    {#if loading}
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600">加载中...</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each categories as category}
          <div class="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
            <div class="aspect-video bg-gray-100 relative">
              {#if category.cover_url}
                <img src={category.cover_url} alt={category.name} class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              {/if}
            </div>
            <div class="p-4 flex-1">
              <h3 class="text-lg font-bold text-gray-900">{category.name}</h3>
              <p class="text-gray-600 text-sm mt-1 line-clamp-2">{category.description || '暂无描述'}</p>
            </div>
            <div class="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onclick={() => openEditModal(category)}
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                编辑
              </button>
              <button
                onclick={() => deleteCategory(category.name)}
                class="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                删除
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showEditModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold mb-4">{isNew ? '添加图集' : '编辑图集'}</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">名称</label>
          <input
            bind:value={editingCategory.name}
            type="text"
            readonly={!isNew}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
            class:bg-white={isNew}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            bind:value={editingCategory.description}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">封面</label>
          <div class="flex flex-col gap-2">
            {#if editingCategory.cover_url}
              <img src={editingCategory.cover_url} alt="预览" class="w-full aspect-video object-cover rounded-lg" />
            {/if}
            <div class="flex gap-2">
              <label class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm text-center cursor-pointer transition-colors">
                上传新封面
                <input type="file" accept="image/*" class="hidden" onchange={handleCoverUpload} />
              </label>
              {#if !isNew}
                <button
                  onclick={openSelectCoverModal}
                  class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  从图库选取
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>
      <div class="mt-6 flex justify-end gap-3">
        <button
          onclick={() => showEditModal = false}
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveCategory}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showSelectCoverModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
      <div class="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-xl font-bold">选择封面图</h3>
        <button onclick={() => showSelectCoverModal = false} class="text-gray-500 hover:text-gray-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="p-6 overflow-y-auto flex-1">
        {#if loadingImages}
          <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        {:else if categoryImages.length === 0}
          <p class="text-center text-gray-500 py-8">该分类下暂无图片</p>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {#each categoryImages as image}
              <button
                onclick={() => selectCover(image.url)}
                class="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all focus:outline-none"
              >
                <img src={image.url} alt="" class="w-full h-full object-cover" />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
