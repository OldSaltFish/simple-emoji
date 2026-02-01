export interface Category {
  name: string;
  description?: string;
}

export interface Image {
  id: string;
  category_name: string;
  description?: string;
  url: string;
  width?: number;
  height?: number;
  size: number; // KB
  created_at: string;
  updated_at?: string;
  category?: Category;
  tags?: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  kind: string;
}

export interface ImageTag {
  id: number;
  image_id: number;
  tag_id: number;
}

export interface FilterOptions {
  category?: string;
  tags?: string[];
  search?: string;
  sortBy?: 'created_at' | 'size' | 'name';
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