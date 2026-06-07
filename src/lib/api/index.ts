// 统一API入口
export { apiClient } from './client';
export { imageHostsApi } from './imageHosts';
export { imagesApi } from './images';
export { llmConfigApi } from './llmConfig';
export { checkInApi } from './checkIn';

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
export type { LlmConfig, LlmConfigListResponse } from './llmConfig';

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
