import { apiClient } from './client';
import type { SnippetTag } from '$lib/types';

export interface CreateSnippetTagRequest {
  name: string;
  kind: string;
}

export class SnippetTagsApi {
  private endpoint = '/snippet-tags';

  async getTags(kind?: string): Promise<SnippetTag[]> {
    const params = kind ? { kind } : undefined;
    const data = await apiClient.get(this.endpoint, params);
    return data || [];
  }

  async getKinds(): Promise<string[]> {
    return await apiClient.get(`${this.endpoint}/kinds`);
  }

  async createTag(data: CreateSnippetTagRequest): Promise<SnippetTag> {
    return await apiClient.post(this.endpoint, data);
  }

  async updateTag(name: string, data: Partial<CreateSnippetTagRequest>): Promise<SnippetTag> {
    return await apiClient.put(this.endpoint, { ...data, name });
  }

  async deleteTag(name: string): Promise<void> {
    await apiClient.delete(this.endpoint, { name });
  }
}

export const snippetTagsApi = new SnippetTagsApi();
