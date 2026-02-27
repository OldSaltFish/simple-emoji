import { apiClient as client } from './client';
import type { CodeSnippet, Tag } from '$lib/types';

export const codeSnippetsApi = {
  async getCodeSnippets(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    tags?: string;
    framework?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const requestParams: Record<string, string | number> = {};
    if (params) {
      if (params.page !== undefined) requestParams.page = params.page;
      if (params.page_size !== undefined) requestParams.page_size = params.page_size;
      if (params.search !== undefined) requestParams.search = params.search;
      if (params.tags !== undefined) requestParams.tags = params.tags;
      if (params.framework !== undefined) requestParams.framework = params.framework;
      if (params.sortBy !== undefined) requestParams.sortBy = params.sortBy;
      if (params.sortOrder !== undefined) requestParams.sortOrder = params.sortOrder;
    }
    return await client.get('/code-snippets', requestParams);
  },

  async getCodeSnippet(id: number) {
    return await client.get(`/code-snippets/${id}`);
  },

  async createCodeSnippet(data: {
    title: string;
    description?: string;
    url: string;
    cover_url?: string;
    tags?: string[];
  }) {
    return await client.post('/code-snippets', data);
  },

  async updateCodeSnippet(id: number, data: {
    title?: string;
    description?: string;
    url?: string;
    cover_url?: string;
    tags?: string[];
  }) {
    return await client.put(`/code-snippets/${id}`, data);
  },

  async deleteCodeSnippet(id: number) {
    return await client.delete(`/code-snippets/${id}`);
  },

  async addTagsToCodeSnippet(id: number, tags: string[]) {
    return await client.post(`/code-snippets/${id}/tags`, { tags });
  },
};
