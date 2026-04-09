export interface Category {
  name: string;
  description?: string;
  cover_url?: string;
}

export interface Image {
  id: string;
  category_name: string;
  description?: string;
  url: string;
  created_at: string;
  updated_at?: string;
  category?: Category;
  tags?: Tag[];
}

export interface Tag {
  name: string;
  kind?: string;
}

export const TAG_KIND_OPTIONS = ['人物', '情绪', '颜色', '风格', '作品', '其他'] as const;
export type TagKind = string;

export interface SnippetTag {
  name: string;
  kind?: string;
}

export const SNIPPET_TAG_KIND_OPTIONS = ['语言', '框架', '工具', '库', '其他'] as const;

export interface ImageTag {
  id: number;
  image_id: number;
  tag_id: number;
}

export interface FilterOptions {
  category?: string;
  tags?: string[];
  framework?: string;
  search?: string;
  sortBy?: 'created_at' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ImageHost {
  id?: number;
  name: string;
  upload_url: string;
  file_field: string,
  url_path: string,
  header_params: Record<string, string>;
  form_params: Record<string, string>;
  no_head: boolean;

  is_enabled: boolean;
  max_limit: number;
  current_load?: number;
}

// 从 Entity 派生 Create DTO（排除 id 和敏感字段）
export type ImageHostDto = Omit<ImageHost, 'header_params' | 'form_params'> & {
  header_params: string;
  form_params: string;
};

export interface CodeSnippet {
  id: number;
  title: string;
  description?: string;
  url: string;
  cover_url?: string;
  tags?: SnippetTag[];
  created_at: string;
  updated_at?: string;
}
