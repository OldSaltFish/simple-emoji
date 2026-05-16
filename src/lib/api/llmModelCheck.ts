import { apiClient } from './client';

export interface LlmModelCheck {
  id?: number;
  llm_config: number;
  available_models: string[];
  unavailable_models: { model: string; reason: string }[];
  total_count: number;
  available_count: number;
  created_at: string;
}

export class LlmModelCheckApi {
  private base = '/config/llm-model-check';

  async getByConfigId(llmConfigId: number): Promise<LlmModelCheck | null> {
    return apiClient.get(`${this.base}/get-by-config/${llmConfigId}`, undefined, { useStandardFormat: true });
  }

  async listAll(): Promise<{ list: LlmModelCheck[] }> {
    return apiClient.get(`${this.base}/list-all`);
  }

  async upsert(data: {
    llm_config_id: number;
    available_models: string[];
    unavailable_models: { model: string; reason: string }[];
    total_count: number;
    available_count: number;
  }): Promise<LlmModelCheck> {
    return apiClient.post(`${this.base}/upsert`, data);
  }

  async deleteByConfigId(llmConfigId: number): Promise<void> {
    return apiClient.delete(`${this.base}/delete-by-config/${llmConfigId}`);
  }
}

export const llmModelCheckApi = new LlmModelCheckApi();
