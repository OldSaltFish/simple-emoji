import { apiClient } from './client';

export interface LlmConfig {
  id?: number;
  api_type: 'openai' | 'gemini' | 'claude';
  endpoint: string;
  api_key: string;
  group: string;
  key_note: string;
  endpoint_note: string;
  endpoint_group: string;
  created_at: string;
  updated_at: string;
}

export interface LlmConfigListResponse {
  list: LlmConfig[];
  total: number;
}

export type LlmConfigCreate = Omit<LlmConfig, 'id' | 'created_at' | 'updated_at'>;
export type LlmConfigUpdate = Partial<LlmConfigCreate>;

export class LlmConfigApi {
  private base = '/config/llm-config';

  async list(page = 1, pageSize = 50): Promise<LlmConfigListResponse> {
    return apiClient.get(`${this.base}/list-llm-config`, { page, page_size: pageSize });
  }

  async create(config: LlmConfigCreate): Promise<LlmConfig> {
    return apiClient.post(`${this.base}/create-llm-config`, config);
  }

  async update(id: number, config: LlmConfigUpdate): Promise<LlmConfig> {
    return apiClient.put(`${this.base}/update-llm-config`, config, { params: { id } });
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete(`${this.base}/delete-llm-config`, undefined, { params: { id } });
  }
}

export const llmConfigApi = new LlmConfigApi();
