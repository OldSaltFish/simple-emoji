import { apiClient } from './client';
import type { ImageHost, ImageHostDto } from '$lib/types';

export interface CreateImageHostRequest {
  name: string;
  upload_url: string;
  header_params: Record<string, string>;
  file_field: string;
  form_params: Record<string, string>;
  url_path: string;
  no_head: boolean;
  is_enabled: boolean;
  max_limit: number;
}

export class ImageHostsApi {
  private endpoint = '/image-hosts/';

  // 获取所有图片托管接口
  getAll(): Promise<ImageHostDto[]> {
    return apiClient.get(this.endpoint);     
  }

  // 获取启用的图片托管接口
  async getEnabled(): Promise<ImageHostDto[]> {
    const response = await apiClient.get('/image-hosts/enabled');

    // 同样需要解析JSON字符串
    const hosts = (response.data || []).map((host: any) => ({
      ...host,
      header_params: typeof host.header_params === 'string'
        ? JSON.parse(host.header_params)
        : host.header_params,
      form_params: typeof host.form_params === 'string'
        ? JSON.parse(host.form_params)
        : host.form_params
    }));

    return hosts;
  }

  // 创建新的图片托管接口 - 使用PUT方法，路径参数为apiName
  async create(data: CreateImageHostRequest): Promise<void> {
    const response = await apiClient.post(`${this.endpoint}`, data);
  }

  // 更新图片托管接口 - 使用PUT方法，查询参数为apiName
  async update(apiName: string, data: Partial<CreateImageHostRequest>): Promise<void> {
    await apiClient.put(`${this.endpoint}update?host_name=${encodeURIComponent(apiName)}`, data);
  }

  // 删除图片托管接口 - 查询参数为apiName
  async delete(apiName: string): Promise<void> {
    const response = await apiClient.delete(`${this.endpoint}delete?host_name=${encodeURIComponent(apiName)}`);
  }

  // 切换接口启用状态 - 使用PUT方法，需要传入apiName
  async toggleStatus(apiName: string, is_enabled: boolean): Promise<void> {
    const response = await apiClient.put(`${this.endpoint}update?host_name=${encodeURIComponent(apiName)}`, { is_enabled });
  }

  // 获取API信息
  getApi() {
    return apiClient.get(`${this.endpoint}next`);
  }

  // 上传图片到图床(后端自行轮询)
  async upload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload(`${this.endpoint}upload`, formData);
  }
  tranDtoToEntity(dto: ImageHostDto): ImageHost {
    return {
      ...dto,
      header_params: typeof dto.header_params === 'string' ? JSON.parse(dto.header_params) : dto.header_params,
      form_params: typeof dto.form_params === 'string' ? JSON.parse(dto.form_params) : dto.form_params,
    };
  }


}

// 导出单例实例
export const imageHostsApi = new ImageHostsApi();