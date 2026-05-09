const API_BASE_URL = import.meta.env.MODE === 'production'
  ? 'https://api.dreamsoul.cn:30000'
  : 'http://localhost:8000';

export const config = {
  apiBaseUrl: API_BASE_URL,
  appName: '表情包网站'
};