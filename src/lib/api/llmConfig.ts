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
  disabled?: boolean;
  created_at: string;
  updated_at: string;
  check_history?: {
    id?: number;
    llm_config: number;
    available_models: string[];
    unavailable_models: { model: string; reason: string }[];
    total_count: number;
    available_count: number;
    created_at: string;
  };
}

export interface LlmConfigListResponse {
  list: LlmConfig[];
  total: number;
}

export type LlmConfigCreate = Omit<LlmConfig, 'id' | 'created_at' | 'updated_at'>;
export type LlmConfigUpdate = Partial<LlmConfigCreate>;

export interface LlmConfigGroups {
  groups: string[];
  endpoint_groups: string[];
}

export class LlmConfigApi {
  private base = '/config/llm-config';

  async list(
    page = 1,
    pageSize = 20,
    filters?: { group?: string; endpoint_group?: string; disabled?: boolean },
  ): Promise<LlmConfigListResponse> {
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (filters?.group !== undefined) params.group = filters.group;
    if (filters?.endpoint_group !== undefined) params.endpoint_group = filters.endpoint_group;
    if (filters?.disabled !== undefined) params.disabled = Number(filters.disabled);
    return apiClient.get(`${this.base}/list-llm-config`, params);
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

  async toggleDisabled(id: number): Promise<LlmConfig> {
    return apiClient.post(`${this.base}/toggle-llm-config/${id}`, undefined);
  }

  async getGroups(): Promise<LlmConfigGroups> {
    return apiClient.get(`${this.base}/groups`);
  }
}

export const llmConfigApi = new LlmConfigApi();
