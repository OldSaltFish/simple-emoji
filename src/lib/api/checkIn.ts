import { apiClient } from './client';

class CheckInApi {
  // Get all sites with today's status
  async getSites() {
    return apiClient.get('/check-in/sites');
  }

  // Get logs with filtering
  async getLogs(params: {
    page?: number;
    page_size?: number;
    site_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const requestParams: Record<string, string | number> = {};
    if (params.page !== undefined) requestParams.page = params.page;
    if (params.page_size !== undefined) requestParams.page_size = params.page_size;
    if (params.site_id !== undefined) requestParams.site_id = params.site_id;
    if (params.status !== undefined) requestParams.status = params.status;
    if (params.date_from !== undefined) requestParams.date_from = params.date_from;
    if (params.date_to !== undefined) requestParams.date_to = params.date_to;
    return apiClient.get('/check-in/logs', requestParams);
  }

  // Delete a single log
  async deleteLog(id: number) {
    return apiClient.delete(`/check-in/logs/${id}`);
  }

  // Manually execute check-in for a site
  async executeCheckIn(siteId: string) {
    return apiClient.post(`/check-in/execute/${siteId}`);
  }
}

export const checkInApi = new CheckInApi();
