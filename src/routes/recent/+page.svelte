<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import ImageGrid from '$lib/components/ImageGrid.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { imagesApi } from '$lib/api/images';
  import type { Category, Tag, Image, FilterOptions } from '$lib/types';
  import JSZip from 'jszip';
  import ReplaceImageModal from '$lib/components/ReplaceImageModal.svelte';
  import { showMessage } from '$lib/stores/messageStore';
  import { config } from '$lib/config/env';

  let categories = $state<Category[]>([]);
  let tags = $state<Tag[]>([]);
  let images = $state<Image[]>([]);
  let loading = $state(false);
  let updating = $state(false);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let total = $state(0);
  let filters = $state<FilterOptions>({});
  let replaceImageTarget = $state<Image | null>(null);

  // 从 URL 查询参数初始化状态
  function initFromUrl() {
    const params = $page.url.searchParams;

    // 解析页码
    const pageParam = params.get('page');
    currentPage = pageParam ? parseInt(pageParam, 10) : 1;

    // 解析筛选条件
    const categoryParam = params.get('category');
    const searchParam = params.get('search');
    const sortByParam = params.get('sortBy');
    const sortOrderParam = params.get('sortOrder');
    const tagsParam = params.get('tags');

    filters = {};
    if (categoryParam) filters.category = categoryParam;
    if (searchParam) filters.search = searchParam;
    if (sortByParam) filters.sortBy = sortByParam as 'created_at' | 'name';
    if (sortOrderParam) filters.sortOrder = sortOrderParam as 'asc' | 'desc';
    if (tagsParam) filters.tags = tagsParam.split(',');
  }

  // 更新 URL 查询参数
  function updateUrl() {
    const params = new URLSearchParams();

    // 更新页码
    if (currentPage > 1) params.set('page', currentPage.toString());

    // 更新筛选条件
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));

    // 更新 URL 但不触发导航
    const newUrl = `${$page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    replaceState(newUrl, $page.state);
  }

  onMount(async () => {
    initFromUrl();
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [categoriesData, tagsData, imagesData] = await Promise.all([
        imagesApi.getCategories(),
        imagesApi.getTags(),
        imagesApi.getImages({ ...filters, page: currentPage, page_size: 20 })
      ]);

      categories = categoriesData;
      tags = tagsData;
      images = imagesData.images;
      total = imagesData.total;
      totalPages = imagesData.total_pages;
    } catch (error) {
      console.error('加载数据失败:', error);
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

  async function handleBatchUpdateCategory(imageIds: number[], categoryName: string) {
    if (!categoryName) return;

    updating = true;
    try {
      await imagesApi.batchUpdateCategory({
        image_ids: imageIds,
        category_name: categoryName
      });
      await loadData();
    } catch (error) {
      console.error('批量更新失败:', error);
      showMessage('批量更新失败，请重试', 'error');
    } finally {
      updating = false;
    }
  }

  const imageBlobCache = new Map<string, Blob>();

  async function getImageBlob(image: Image): Promise<Blob> {
    if (imageBlobCache.has(image.url)) {
      return imageBlobCache.get(image.url)!;
    }

    let blob: Blob;

    const imgElement = document.querySelector(`img[src="${image.url}"]`) as HTMLImageElement;
    if (imgElement && imgElement.complete) {
      try {
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
        console.warn('Canvas获取失败，尝试fetch:', canvasError);
      }
    }

    try {
      const response = await fetch(image.url);
      blob = await response.blob();
      imageBlobCache.set(image.url, blob);
      return blob;
    } catch (fetchError) {
      console.warn('直接fetch失败，使用代理:', fetchError);
      const encodedUrl = encodeURIComponent(image.url);
      const proxyResponse = await fetch(`${config.apiBaseUrl}/bing/imgProxy?url=${encodedUrl}`);
      blob = await proxyResponse.blob();
      imageBlobCache.set(image.url, blob);
      return blob;
    }
  }

  async function handleDownloadCategory(categoryName: string) {
    try {
      const response = await imagesApi.getImages({
        category: categoryName,
        page: 1,
        page_size: 9999
      });

      if (!response.images || response.images.length === 0) {
        showMessage('该分类下没有图片', 'info');
        return;
      }

      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;

      for (const image of response.images) {
        try {
          const blob = await getImageBlob(image);
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
      link.download = `${categoryName}_表情包_${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showMessage(`成功打包 ${successCount} 个图片${failCount > 0 ? `，失败 ${failCount} 个` : ''}`, 'success');
    } catch (error) {
      console.error('下载图集失败:', error);
      showMessage('下载图集失败，请重试', 'error');
    }
  }

  function handleReplaceImage(image: Image) {
    replaceImageTarget = image;
  }

  function handleDeleteImage(image: Image) {
    console.log('删除图片:', image.id);
    showMessage('删除功能开发中...', 'info');
  }

  function handleEditImage(image: Image) {
    console.log('编辑图片:', image.id);
    showMessage('编辑功能开发中...', 'info');
  }

  function handleReplaceSuccess() {
    loadData();
  }
</script>

<svelte:head>
  <title>最近 - 表情包网站</title>
  <meta name="description" content="查看最近的表情包" />
</svelte:head>

<div class="bg-gray-50 flex flex-col" style="height: calc(100vh - 64px);">
  <FilterPanel
    {categories}
    {tags}
    {filters}
    onFilterChange={handleFilterChange}
    onDownloadCategory={handleDownloadCategory}
  />

  <main class="max-w-[1280px] mx-auto flex-1">
    <ImageGrid
      {images}
      {loading}
      {categories}
      onBatchUpdateCategory={handleBatchUpdateCategory}
      onReplaceImage={handleReplaceImage}
      onDeleteImage={handleDeleteImage}
      onEditImage={handleEditImage}
    />

    {#if totalPages > 1}
      <Pagination
        bind:currentPage
        {totalPages}
        onPageChange={handlePageChange}
      />
    {/if}
  </main>

  {#if !loading && total > 0}
    <div class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div class="text-center text-sm text-gray-500">
        共找到 {total} 个表情包
      </div>
    </div>
  {/if}
</div>

<ReplaceImageModal
  bind:image={replaceImageTarget}
  onClose={() => replaceImageTarget = null}
  onSuccess={handleReplaceSuccess}
/>
