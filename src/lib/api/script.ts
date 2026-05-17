import { apiClient } from './client';

export interface ScriptTag {
  name: string;
  kind: string | null;
}

export interface ScriptItem {
  id: number;
  title: string;
  description: string | null;
  content: string;
  author: string | null;
  status: 'pending' | 'approved' | 'rejected';
  tags: ScriptTag[];
  created_at: string;
  updated_at: string;
}

export interface ScriptListResponse {
  list: ScriptItem[];
  total: number;
}

class ScriptApi {
  private base = '/script';

  async list(
    page = 1,
    pageSize = 20,
    filters?: { tag?: string; kind?: string; status?: string; keyword?: string },
  ): Promise<ScriptListResponse> {
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (filters?.tag) params.tag = filters.tag;
    if (filters?.kind) params.kind = filters.kind;
    if (filters?.status) params.status = filters.status;
    if (filters?.keyword) params.keyword = filters.keyword;
    return apiClient.get(`${this.base}/list`, params);
  }

  async detail(id: number): Promise<ScriptItem> {
    return apiClient.get(`${this.base}/detail/${id}`);
  }

  async create(data: {
    title: string;
    content: string;
    description?: string;
    author?: string;
    tags?: (string | ScriptTag)[];
    status?: string;
  }): Promise<ScriptItem> {
    return apiClient.post(`${this.base}/create`, data);
  }

  async update(
    id: number,
    data: {
      title?: string;
      content?: string;
      description?: string;
      author?: string;
      tags?: (string | ScriptTag)[];
      status?: string;
    },
  ): Promise<ScriptItem> {
    return apiClient.put(`${this.base}/update/${id}`, data);
  }

  async review(id: number, status: 'approved' | 'rejected'): Promise<ScriptItem> {
    return apiClient.put(`${this.base}/review/${id}`, { status });
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete(`${this.base}/delete/${id}`);
  }

  async tags(kind?: string): Promise<ScriptTag[]> {
    const params: Record<string, string> = {};
    if (kind) params.kind = kind;
    return apiClient.get(`${this.base}/tags`, params);
  }

  async createTag(name: string, kind?: string): Promise<ScriptTag> {
    return apiClient.post(`${this.base}/tags/create`, { name, kind });
  }
}

export const scriptApi = new ScriptApi();

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  powershell: 'ps1',
  pwsh: 'ps1',
  bash: 'sh',
  shell: 'sh',
  python: 'py',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
};

export function getLanguageTag(tags: ScriptTag[]): ScriptTag | undefined {
  return tags.find((t) => t.kind === 'language');
}

export function getFileExtension(langTag: string): string {
  return LANGUAGE_EXTENSIONS[langTag.toLowerCase()] || 'txt';
}

export function wrapForRun(content: string, langTag: string): string {
  const lower = langTag.toLowerCase();
  if (lower === 'powershell' || lower === 'pwsh') {
    return `& {\n${content}\n}`;
  }
  if (lower === 'bash' || lower === 'shell') {
    return `bash -c '\n${content}\n'`;
  }
  return content;
}

export function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
