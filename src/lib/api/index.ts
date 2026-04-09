// 统一API入口
export { apiClient } from './client';
export { imageHostsApi } from './imageHosts';
export { imagesApi } from './images';
export { codeSnippetsApi } from './codeSnippets';
export { snippetTagsApi } from './snippetTags';

// 重新导出类型
export type { 
  CreateImageHostRequest, 
} from './imageHosts';
export type { 
  GetImagesParams,
  GetImagesResponse,
  CreateImageRequest,
  CreateCategoryRequest,
  CreateTagRequest
} from './images';
export type { CreateSnippetTagRequest } from './snippetTags';

// 为了向后兼容，保留原有的api对象
import { imagesApi } from './images';

export const api = {
  // 表情包相关
  getCategories: imagesApi.getCategories.bind(imagesApi),
  getTags: imagesApi.getTags.bind(imagesApi),
  getImages: async (filters: any = {}, page = 1, limit = 20) => {
    const result = await imagesApi.getImages({ ...filters, page, limit });
    return {
      images: result.images,
      total: result.total
    };
  },
  uploadImage: async (data: any) => {
    return await imagesApi.uploadImage(data);
  },
  createCategory: async (data: any) => {
    return await imagesApi.createCategory(data);
  },
  createTag: async (data: any) => {
    return await imagesApi.createTag(data);
  }
};