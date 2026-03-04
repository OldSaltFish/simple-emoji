import { apiClient } from './client';
import type { Image, Category, Tag } from '$lib/types';

export interface GetImagesParams {
  page?: number;
  page_size?: number;
  category?: string | 'none';
  tags?: string[];
  search?: string;
  sortBy?: 'created_at' | 'size' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface GetImagesResponse {
  images: Image[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateImageRequest {
  category_name: string;
  description?: string;
  url: string;
  tags?: string[];
}

export interface UpdateImageRequest {
  category_name?: string;
  description?: string;
}

export interface BatchUpdateCategoryRequest {
  image_ids: number[];
  category_name: string;
}

export interface BatchCreateImageRequest {
  images: CreateImageRequest[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface CreateTagRequest {
  name: string;
  kind: string;
}

export class ImagesApi {
  private imagesEndpoint = '/images';
  private categoriesEndpoint = '/categories';
  private tagsEndpoint = '/tags';

  // 获取表情包列表
  async getImages(params: GetImagesParams = {}): Promise<GetImagesResponse> {
    const requestParams: Record<string, string | number> = {};

    if (params.page !== undefined) requestParams.page = params.page;
    if (params.page_size !== undefined) requestParams.page_size = params.page_size;
    if (params.category !== undefined) {
      // category 为 'none' 时传递空字符串表示无分类
      // category 为 '' 时不传递参数表示全部分类
      if (params.category === 'none') {
        requestParams.category = '';
      } else if (params.category !== '') {
        requestParams.category = params.category;
      }
      // category === '' 时,不传递参数,后端会视为全部分类
    }
    if (params.search !== undefined) requestParams.search = params.search;
    if (params.sortBy !== undefined) requestParams.sortBy = params.sortBy;
    if (params.sortOrder !== undefined) requestParams.sortOrder = params.sortOrder;
    if (params.tags && params.tags.length > 0) {
      requestParams.tags = params.tags.join(',');
    }

    return await apiClient.get(this.imagesEndpoint, requestParams);
  }

  // 上传表情包(保存到数据库)
  async uploadImage(data: CreateImageRequest): Promise<Image> {
    return await apiClient.post(this.imagesEndpoint, {
      category_name: data.category_name,
      description: data.description,
      url: data.url,
      tags: data.tags
    });
  }

  // 更新表情包
  async updateImage(id: number, data: UpdateImageRequest): Promise<Image> {
    return await apiClient.put(`${this.imagesEndpoint}/update`, {
      image_id: id,
      ...data
    });
  }

  // 批量更新分类
  async batchUpdateCategory(data: BatchUpdateCategoryRequest): Promise<void> {
    await apiClient.put(`${this.imagesEndpoint}/batch-update-category`, data);
  }

  // 批量上传表情包(保存到数据库)
  async batchUploadImages(data: BatchCreateImageRequest): Promise<{ success_count: number; fail_count: number }> {
    return await apiClient.post(`${this.imagesEndpoint}/batch`, data);
  }

  // 替换图片（重新上传图片替换原有图片）
  async replaceImage(imageId: number, url: string): Promise<Image> {
    return await apiClient.put(`${this.imagesEndpoint}/${imageId}/replace`, { url });
  }

  // 删除表情包
  async deleteImage(id: string): Promise<void> {
    await apiClient.delete(`${this.imagesEndpoint}/${id}`);
  }

  // 获取分类列表
  async getCategories(): Promise<Category[]> {
    const data = await apiClient.get(this.categoriesEndpoint);
    return data || [];
  }

  // 创建分类
  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return await apiClient.post(this.categoriesEndpoint, data);
  }

  // 更新分类
  async updateCategory(id: number, data: Partial<CreateCategoryRequest>): Promise<Category> {
    return await apiClient.put(`${this.categoriesEndpoint}/${id}`, data);
  }

  // 删除分类
  async deleteCategory(id: number): Promise<void> {
    const response = await apiClient.delete(`${this.categoriesEndpoint}/${id}`);
  }

  // 删除分类（通过名称）
  async deleteCategoryByName(name: string): Promise<void> {
    await apiClient.delete<void>(`${this.categoriesEndpoint}?name=${encodeURIComponent(name)}`);
  }

  // 更新分类（通过原名称查找）
  async updateCategoryByName(originalName: string, data: Partial<CreateCategoryRequest>): Promise<Category> {
    return await apiClient.put(`${this.categoriesEndpoint}`, {
      original_name: originalName,
      ...data
    });
  }

  // 获取标签列表
  async getTags(kind?: string): Promise<Tag[]> {
    const params = kind ? { kind } : undefined;
    const data = await apiClient.get(this.tagsEndpoint, params);
    return data || [];
  }

  // 创建标签
  async createTag(data: CreateTagRequest): Promise<Tag> {
    return await apiClient.post(this.tagsEndpoint, data);
  }

  // 更新标签
  async updateTag(name: string, data: Partial<CreateTagRequest>): Promise<Tag> {
    return await apiClient.put(this.tagsEndpoint, { ...data, name });
  }

  // 删除标签
  async deleteTag(name: string): Promise<void> {
    await apiClient.delete(this.tagsEndpoint, { name });
  }
}

// 导出单例实例
export const imagesApi = new ImagesApi();