// 环境配置
export const config = {
  // API基础URL
  apiBaseUrl: getApiBaseUrl(),
  // 其他配置
  appName: '表情包网站'
};

function getApiBaseUrl(): string {
  // 在浏览器环境中
  // if (typeof window !== 'undefined') {
  // 检查环境变量
  const env = import.meta.env?.MODE || 'development';

  switch (env) {
    case 'production':
      return import.meta.env?.VITE_API_BASE_URL || 'https://api.yourdomain.com';
    case 'staging':
      return import.meta.env?.VITE_API_BASE_URL || 'https://staging-api.yourdomain.com';
    case 'development':
    default:
      return import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';
  }
  // }

  // 服务端渲染时的默认值
  // return 'http://localhost:8000';
}