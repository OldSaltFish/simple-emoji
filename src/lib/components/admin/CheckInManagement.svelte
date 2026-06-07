<script lang="ts">
  import { onMount } from 'svelte';
  import { checkInApi } from '$lib/api/checkIn';
  import { showMessage } from '$lib/stores/messageStore';
  import { customConfirm } from '$lib/stores/dialogStore';

  interface TodayLog {
    id: number;
    site_id: string;
    site_name: string;
    status: string;
    message: string;
    points: number | null;
    execution_type: string;
    created_at: string;
  }

  interface Site {
    id: string;
    name: string;
    description: string;
    today_log: TodayLog | null;
  }

  interface Log {
    id: number;
    site_id: string;
    site_name?: string;
    status: string;
    message?: string;
    detail?: string | null;
    points?: number | null;
    execution_type: string;
    created_at: string;
  }

  interface LogsResponse {
    logs: Log[];
    total: number;
    page: number;
    page_size: number;
  }

  // Sites state
  let sites = $state<Site[]>([]);
  let sitesInitialLoading = $state(false);
  let executingSiteId = $state<string | null>(null);
  let openMenuSiteId = $state<string | null>(null);

  // Logs state
  let logs = $state<Log[]>([]);
  let logsTotal = $state(0);
  let logsInitialLoading = $state(false);
  let currentPage = $state(1);
  let pageSize = $state(10);

  // Filter state
  let filterSiteId = $state('');
  let filterStatus = $state('');
  let filterDateFrom = $state('');
  let filterDateTo = $state('');

  // Delete confirmation
  let deletingLogId = $state<number | null>(null);

  // Detail expansion
  let expandedLogId = $state<number | null>(null);

  onMount(async () => {
    await Promise.all([loadSites(), loadLogs()]);
  });

  async function loadSites(showLoading = true) {
    if (showLoading) sitesInitialLoading = true;
    try {
      const data = await checkInApi.getSites();
      sites = data || [];
    } catch (error) {
      console.error('加载站点失败:', error);
    } finally {
      if (showLoading) sitesInitialLoading = false;
    }
  }

  async function loadLogs(showLoading = true) {
    if (showLoading) logsInitialLoading = true;
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: pageSize,
      };
      if (filterSiteId) params.site_id = filterSiteId;
      if (filterStatus) params.status = filterStatus;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;

      const data = await checkInApi.getLogs(params as any);
      logs = data?.list || [];
      logsTotal = data?.total || 0;
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      if (showLoading) logsInitialLoading = false;
    }
  }

  async function executeCheckIn(siteId: string) {
    executingSiteId = siteId;
    openMenuSiteId = null;
    try {
      await checkInApi.executeCheckIn(siteId);
      await loadSites(false);
      await loadLogs(false);
    } catch (error) {
      console.error('执行签到失败:', error);
    } finally {
      executingSiteId = null;
    }
  }

  async function deleteLog(id: number) {
    if (await customConfirm('确定要删除这条签到记录吗？')) {
      try {
        // 乐观移除：立即从列表中删除，避免闪烁
        logs = logs.filter(log => log.id !== id);
        logsTotal = Math.max(0, logsTotal - 1);
        await checkInApi.deleteLog(id);
        // 静默刷新确保数据一致，不显示 loading
        await loadLogs(false);
      } catch (error) {
        console.error('删除记录失败:', error);
        // 失败时恢复数据
        await loadLogs(false);
      }
    }
  }

  function resetFilters() {
    filterSiteId = '';
    filterStatus = '';
    filterDateFrom = '';
    filterDateTo = '';
    currentPage = 1;
  }

  function getStatusBadge(status: string | null | undefined): { text: string; class: string } {
    switch (status) {
      case 'success':
        return { text: '已签到', class: 'bg-green-100 text-green-700' };
      case 'already_signed':
        return { text: '已签到', class: 'bg-blue-100 text-blue-700' };
      case 'error':
        return { text: '失败', class: 'bg-red-100 text-red-700' };
      default:
        return { text: '未执行', class: 'bg-gray-100 text-gray-500' };
    }
  }

  function getExecutionTypeBadge(type: string): { text: string; class: string } {
    switch (type) {
      case 'scheduled':
        return { text: '定时', class: 'bg-purple-100 text-purple-700' };
      case 'manual':
        return { text: '手动', class: 'bg-amber-100 text-amber-700' };
      default:
        return { text: type, class: 'bg-gray-100 text-gray-600' };
    }
  }

  function formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  function truncateMessage(msg: string | undefined, maxLen: number = 40): string {
    if (!msg) return '-';
    return msg.length > maxLen ? msg.slice(0, maxLen) + '...' : msg;
  }

  let totalPages = $derived(Math.max(1, Math.ceil(logsTotal / pageSize)));

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }

  function handleClickOutside() {
    openMenuSiteId = null;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="space-y-6">
  <!-- Section 1: Site Status Cards -->
  <div class="bg-white rounded-xl shadow-sm">
    <div class="p-6 border-b border-gray-200">
      <h2 class="text-2xl font-bold text-gray-900">签到管理</h2>
      <p class="text-sm text-gray-500 mt-1">查看各站点签到状态，支持手动执行签到</p>
    </div>

    <div class="p-6">
      {#if sitesInitialLoading}
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-2 text-gray-600">加载中...</p>
        </div>
      {:else if sites.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-500">暂无签到站点</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each sites as site}
            {@const todayStatus = site.today_log?.status ?? null}
            {@const badge = getStatusBadge(todayStatus)}
            {@const isExecuting = executingSiteId === site.id}
            <div class="relative bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
              <!-- Three-dot menu -->
              <div class="absolute top-2 right-2">
                <button
                  onclick={(e) => {
                    e.stopPropagation();
                    openMenuSiteId = openMenuSiteId === site.id ? null : site.id;
                  }}
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  disabled={isExecuting}
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {#if openMenuSiteId === site.id}
                  <div class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onclick={(e) => { e.stopPropagation(); executeCheckIn(site.id); }}
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      立即签到
                    </button>
                  </div>
                {/if}
              </div>

              <!-- Card content -->
              <div class="pr-8">
                <h3 class="font-bold text-gray-900 truncate">{site.name}</h3>
                <p class="text-sm text-gray-500 mt-1 line-clamp-2">{site.description || '暂无描述'}</p>
              </div>

              <div class="mt-3 flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium {badge.class}">
                  {badge.text}
                </span>
                {#if isExecuting}
                  <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                {/if}
              </div>

              {#if site.today_log?.created_at}
                <p class="text-xs text-gray-400 mt-2">
                  上次执行: {formatDateTime(site.today_log.created_at)}
                </p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Section 2: Log History -->
  <div class="bg-white rounded-xl shadow-sm">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-bold text-gray-900">签到记录</h3>
    </div>

    <!-- Filter bar -->
    <div class="p-4 border-b border-gray-100">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[140px]">
          <label class="block text-xs font-medium text-gray-500 mb-1">开始日期</label>
          <input
            type="date"
            bind:value={filterDateFrom}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <div class="flex-1 min-w-[140px]">
          <label class="block text-xs font-medium text-gray-500 mb-1">结束日期</label>
          <input
            type="date"
            bind:value={filterDateTo}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <div class="flex-1 min-w-[140px]">
          <label class="block text-xs font-medium text-gray-500 mb-1">站点</label>
          <select
            bind:value={filterSiteId}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
          >
            <option value="">全部</option>
            {#each sites as site}
              <option value={site.id}>{site.name}</option>
            {/each}
          </select>
        </div>
        <div class="flex-1 min-w-[120px]">
          <label class="block text-xs font-medium text-gray-500 mb-1">状态</label>
          <select
            bind:value={filterStatus}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
          >
            <option value="">全部</option>
            <option value="success">成功</option>
            <option value="error">失败</option>
            <option value="already_signed">已签到</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button
            onclick={() => { currentPage = 1; loadLogs(); }}
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            查询
          </button>
          <button
            onclick={resetFilters}
            class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            重置
          </button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      {#if logsInitialLoading}
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-2 text-gray-600">加载中...</p>
        </div>
      {:else if logs.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-500">暂无签到记录</p>
        </div>
      {:else}
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">站点</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">消息</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">积分</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行方式</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each logs as log}
              {@const statusBadge = getStatusBadge(log.status)}
              {@const execBadge = getExecutionTypeBadge(log.execution_type)}
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.site_name || log.site_id}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium {statusBadge.class}">
                    {statusBadge.text}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-[200px]">
                  <div>
                    <span title={log.message || ''}>{truncateMessage(log.message)}</span>
                    {#if log.detail}
                      <button
                        onclick={() => expandedLogId = expandedLogId === log.id ? null : log.id}
                        class="ml-1 text-blue-500 hover:text-blue-700 text-xs underline"
                      >
                        {expandedLogId === log.id ? '收起' : '详情'}
                      </button>
                    {/if}
                  </div>
                  {#if expandedLogId === log.id && log.detail}
                    <pre class="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap break-all max-h-60 overflow-y-auto border border-gray-200">{log.detail}</pre>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {log.points != null ? log.points : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium {execBadge.class}">
                    {execBadge.text}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateTime(log.created_at)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onclick={() => deleteLog(log.id)}
                    class="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                    title="删除"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p class="text-sm text-gray-500">
            共 {logsTotal} 条记录
          </p>
          <div class="flex items-center gap-2">
            <button
              onclick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span class="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onclick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
