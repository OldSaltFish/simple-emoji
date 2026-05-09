import { imagesApi } from '$lib/api/images';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const category = url.searchParams.get('category') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const sortBy = (url.searchParams.get('sortBy') || undefined) as 'created_at' | 'name' | undefined;
  const sortOrder = (url.searchParams.get('sortOrder') || undefined) as 'asc' | 'desc' | undefined;
  const tagsParam = url.searchParams.get('tags') || undefined;
  const tags = tagsParam ? tagsParam.split(',') : undefined;

  const [categories, tagsData, imagesData] = await Promise.all([
    imagesApi.getCategories(),
    imagesApi.getTags(),
    imagesApi.getImages({ page, page_size: 20, category, search, sortBy, sortOrder, tags })
  ]);

  return {
    categories,
    tags: tagsData,
    images: imagesData.images,
    total: imagesData.total,
    totalPages: imagesData.total_pages,
    currentPage: page,
    filters: { category, search, sortBy, sortOrder, tags }
  };
};