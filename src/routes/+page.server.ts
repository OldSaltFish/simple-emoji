import { imagesApi } from '$lib/api/images';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const categories = await imagesApi.getCategories();
  return { categories };
};