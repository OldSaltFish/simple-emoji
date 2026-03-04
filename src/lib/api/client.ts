import { config } from '$lib/config/env';
import { showMessage } from '$lib/stores/messageStore';


// HTTP方法类型
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// API请求配置
interface ApiRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number>;
  timeout?: number;
  useStandardFormat?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  // 构建完整URL
  private buildUrl(endpoint: string, params?: Record<string, string | number>): string {
    const url = new URL(endpoint.startsWith('/') ? endpoint.slice(1) : endpoint, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  // 发送请求
  private async request<T = any>(
    endpoint: string,
    config: ApiRequestConfig = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      timeout = 30000,
      useStandardFormat = true
    } = config;

    try {
      const url = this.buildUrl(endpoint, params);

      // 构建请求头
      const requestHeaders = {
        ...this.defaultHeaders,
        ...headers
      };

      // 构建请求体
      let requestBody: string | FormData | undefined;
      if (body) {
        if (body instanceof FormData) {
          // FormData不需要设置Content-Type，浏览器会自动设置
          delete requestHeaders['Content-Type'];
          requestBody = body;
        } else {
          requestBody = JSON.stringify(body);
        }
      }

      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 204 No Content 响应直接返回
      if (response.status === 204) {
        return undefined as T;
      }

      // 尝试解析JSON响应
      let data;
      try {
        data = await response.json();
      } catch {
        // 如果不是JSON响应，返回文本或null
        const text = await response.text();
        data = text as any;
      }
      if (!useStandardFormat) {
        return data;
      }
      if(data.msg){
        showMessage(data.msg,data.status);
      }
      return data.data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('请求超时');
        }
        throw new Error(`网络错误: ${error.message}`);
      }
      throw new Error('未知错误');
    }
  }

  // GET请求
  async get<T = any>(endpoint: string, params?: Record<string, string | number>, options?: ApiRequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      params,
      ...options
    });
  }

  // POST请求
  async post<T = any>(endpoint: string, body?: any, options?: ApiRequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body,
      ...options
    });
  }

  // PUT请求
  async put<T = any>(endpoint: string, body?: any, options?: ApiRequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body,
      ...options
    });
  }

  // DELETE请求
  async delete<T = any>(endpoint: string, body?: any, options?: ApiRequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body,
      ...options
    });
  }

  // PATCH请求
  async patch<T = any>(endpoint: string, body?: any, options?: ApiRequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body,
      ...options
    });
  }

  // 文件上传
  async upload<T = any>(endpoint: string, formData: FormData, options?: ApiRequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      ...options
    });
  }
}

// 导出单例实例
export const apiClient = new ApiClient();