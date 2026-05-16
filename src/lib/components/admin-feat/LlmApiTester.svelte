<script lang="ts">
  import { onMount } from 'svelte';
  import { showMessage } from '$lib/stores/messageStore';
  import { customConfirm } from '$lib/stores/dialogStore';
  import { llmConfigApi, type LlmConfig } from '$lib/api/llmConfig';
  import { llmModelCheckApi, type LlmModelCheck } from '$lib/api/llmModelCheck';

  type ApiType = 'openai' | 'gemini' | 'claude';

  const apiTypeLabels: Record<ApiType, string> = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    claude: 'Claude',
  };

  const apiTypeColors: Record<ApiType, string> = {
    openai: 'bg-green-100 text-green-700',
    gemini: 'bg-blue-100 text-blue-700',
    claude: 'bg-orange-100 text-orange-700',
  };

  let configs = $state<LlmConfig[]>([]);
  let checkHistoryMap = $state<Record<number, LlmModelCheck>>({});
  let loading = $state(false);
  let showEditModal = $state(false);
  let isNew = $state(false);
  let saving = $state(false);

  let editForm = $state({
    api_type: 'openai' as ApiType,
    endpoint: '',
    api_key: '',
    group: '',
    key_note: '',
    endpoint_note: '',
    endpoint_group: '',
  });

  let editingId = $state<number | null>(null);
  let showApiKeyMap = $state<Record<number, boolean>>({});

  let showCheckModal = $state(false);
  let checkMinimized = $state(false);
  let checkingConfig = $state<LlmConfig | null>(null);
  let checkLogs = $state<{ text: string; type: 'info' | 'ok' | 'fail' | 'system' }[]>([]);
  let checkRunning = $state(false);
  let checkProgress = $state({ done: 0, total: 0 });
  let checkAutoScroll = $state(true);
  let consoleEl: HTMLDivElement | undefined = $state();

  let showHistoryModal = $state(false);
  let viewingHistory = $state<LlmModelCheck | null>(null);
  let viewingConfig = $state<LlmConfig | null>(null);

  onMount(async () => {
    await loadConfigs();
  });

  async function loadConfigs() {
    loading = true;
    try {
      const res = await llmConfigApi.list();
      configs = res.list || [];
      await loadCheckHistory();
    } catch {
      showMessage('加载配置失败', 'error');
    } finally {
      loading = false;
    }
  }

  async function loadCheckHistory() {
    try {
      const res = await llmModelCheckApi.listAll();
      const map: Record<number, LlmModelCheck> = {};
      for (const item of res.list || []) {
        map[item.llm_config] = item;
      }
      checkHistoryMap = map;
    } catch {}
  }

  function openAddModal() {
    editForm = {
      api_type: 'openai',
      endpoint: '',
      api_key: '',
      group: '',
      key_note: '',
      endpoint_note: '',
      endpoint_group: '',
    };
    editingId = null;
    isNew = true;
    showEditModal = true;
  }

  function addKeyToEndpoint(config: LlmConfig) {
    editForm = {
      api_type: config.api_type,
      endpoint: config.endpoint,
      api_key: '',
      group: '',
      key_note: '',
      endpoint_note: config.endpoint_note || '',
      endpoint_group: config.endpoint_group || '',
    };
    editingId = null;
    isNew = true;
    showEditModal = true;
  }

  function openEditModal(config: LlmConfig) {
    editForm = {
      api_type: config.api_type,
      endpoint: config.endpoint,
      api_key: config.api_key,
      group: config.group || '',
      key_note: config.key_note || '',
      endpoint_note: config.endpoint_note || '',
      endpoint_group: config.endpoint_group || '',
    };
    editingId = config.id ?? null;
    isNew = false;
    showEditModal = true;
  }

  async function saveConfig() {
    if (!editForm.endpoint || !editForm.api_key) {
      showMessage('Endpoint 和 API Key 不能为空', 'error');
      return;
    }

    saving = true;
    try {
      const payload = { ...editForm };
      if (isNew) {
        await llmConfigApi.create(payload);
        showMessage('添加成功', 'success');
      } else if (editingId !== null) {
        await llmConfigApi.update(editingId, payload);
        showMessage('更新成功', 'success');
      }
      await loadConfigs();
      showEditModal = false;
    } catch (err: any) {
      showMessage('保存失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      saving = false;
    }
  }

  async function deleteConfig(id: number) {
    if (!(await customConfirm('确定要删除此密钥配置吗？关联的检测记录也会一并删除。'))) return;
    try {
      await llmConfigApi.delete(id);
      showMessage('删除成功', 'success');
      await loadConfigs();
    } catch (err: any) {
      showMessage('删除失败: ' + (err.message || '未知错误'), 'error');
    }
  }

  function maskKey(key: string) {
    if (!key || key.length <= 8) return key;
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  async function copyToClipboard(text: string, label: string = '内容') {
    try {
      await navigator.clipboard.writeText(text);
      showMessage(`${label}已复制`, 'success');
    } catch {
      showMessage('复制失败', 'error');
    }
  }

  function toggleKeyVisibility(id: number) {
    showApiKeyMap[id] = !showApiKeyMap[id];
  }

  function getEndpointUrl(endpoint: string) {
    if (!endpoint) return '#';
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
    return 'https://' + endpoint;
  }

  type EndpointGroup = {
    name: string;
    endpoints: Record<string, LlmConfig[]>;
  };

  const endpointGroups = $derived.by(() => {
    const map: Record<string, Record<string, LlmConfig[]>> = {};
    for (const config of configs) {
      const eg = config.endpoint_group || '未分组';
      if (!map[eg]) map[eg] = {};
      if (!map[eg][config.endpoint]) map[eg][config.endpoint] = [];
      map[eg][config.endpoint].push(config);
    }
    const groups: EndpointGroup[] = Object.entries(map)
      .sort(([a], [b]) => {
        if (a === '未分组') return 1;
        if (b === '未分组') return -1;
        return a.localeCompare(b);
      })
      .map(([name, endpoints]) => ({
        name,
        endpoints: Object.fromEntries(
          Object.entries(endpoints).sort(([a], [b]) => a.localeCompare(b))
        ),
      }));
    return groups;
  });

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function formatDateTime(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function addLog(text: string, type: 'info' | 'ok' | 'fail' | 'system' = 'info') {
    checkLogs = [...checkLogs, { text, type }];
    if (checkAutoScroll && consoleEl) {
      requestAnimationFrame(() => {
        consoleEl!.scrollTop = consoleEl!.scrollHeight;
      });
    }
  }

  async function startModelCheck(config: LlmConfig) {
    checkingConfig = config;
    checkLogs = [];
    checkRunning = true;
    checkMinimized = false;
    checkProgress = { done: 0, total: 0 };
    showCheckModal = true;

    addLog(`开始检测: ${config.endpoint}`, 'system');
    addLog(`API 类型: ${apiTypeLabels[config.api_type]}`, 'system');

    try {
      if (config.api_type !== 'openai') {
        addLog('当前仅支持 OpenAI 兼容接口的模型检测', 'system');
      }

      addLog('正在获取模型列表...', 'info');
      const modelsUrl = buildModelsUrl(config.endpoint, config.api_type);
      const headers: Record<string, string> = {};
      if (config.api_type === 'openai') {
        headers['Authorization'] = `Bearer ${config.api_key}`;
      } else if (config.api_type === 'gemini') {
        addLog('Gemini 模型检测暂不支持自动测试，仅获取模型列表', 'system');
      }

      const modelsResp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (!modelsResp.ok) {
        const errText = await modelsResp.text().catch(() => '');
        throw new Error(`获取模型列表失败: HTTP ${modelsResp.status} ${errText.slice(0, 100)}`);
      }

      const modelsData = await modelsResp.json();
      let models: string[] = [];
      if (config.api_type === 'openai' && modelsData.data) {
        models = modelsData.data.map((m: any) => m.id);
      } else if (config.api_type === 'gemini' && modelsData.models) {
        models = modelsData.models.map((m: any) => m.name.replace('models/', ''));
      }

      if (models.length === 0) {
        addLog('未发现任何模型', 'fail');
        checkRunning = false;
        return;
      }

      addLog(`共发现 ${models.length} 个模型，开始逐个检测...`, 'system');
      checkProgress = { done: 0, total: models.length };

      const available: string[] = [];
      const unavailable: { model: string; reason: string }[] = [];
      const MAX_CONCURRENT = 5;

      const queue = [...models];
      const workers: Promise<void>[] = [];

      for (let i = 0; i < MAX_CONCURRENT; i++) {
        workers.push((async () => {
          while (queue.length > 0) {
            const model = queue.shift();
            if (!model) break;

            try {
              const ok = await testSingleModel(config, model);
              if (ok) {
                available.push(model);
                addLog(`[OK]   ${model}`, 'ok');
              } else {
                unavailable.push({ model, reason: 'HTTP 非 200' });
                addLog(`[FAIL] ${model}`, 'fail');
              }
            } catch (err: any) {
              const reason = err.message?.slice(0, 80) || '未知错误';
              unavailable.push({ model, reason });
              addLog(`[FAIL] ${model} - ${reason}`, 'fail');
            }

            checkProgress = { done: checkProgress.done + 1, total: checkProgress.total };
          }
        })());
      }

      await Promise.all(workers);

      addLog('', 'info');
      addLog('─'.repeat(40), 'system');
      addLog(`检测完成: 共 ${models.length} 个模型，可用 ${available.length}，不可用 ${unavailable.length}`, 'system');

      if (available.length > 0) {
        addLog('', 'info');
        addLog(`可用模型 (${available.length}):`, 'ok');
        for (const m of available) addLog(`  ${m}`, 'ok');
      }

      try {
        await llmModelCheckApi.upsert({
          llm_config_id: config.id!,
          available_models: available,
          unavailable_models: unavailable,
          total_count: models.length,
          available_count: available.length,
        });
        addLog('检测结果已保存', 'system');
        await loadCheckHistory();
      } catch (err: any) {
        addLog(`保存检测结果失败: ${err.message}`, 'fail');
      }
    } catch (err: any) {
      addLog(`检测出错: ${err.message}`, 'fail');
    } finally {
      checkRunning = false;
      if (checkMinimized) {
        showMessage(
          `模型检测完成: ${checkingConfig?.endpoint ?? ''} — 可用 ${checkProgress.done > 0 ? '' : ''}${checkLogs.filter(l => l.type === 'ok').length} 个`,
          'success',
          0
        );
      }
    }
  }

  function buildModelsUrl(endpoint: string, apiType: ApiType): string {
    let url = endpoint.replace(/\/+$/, '');
    if (apiType === 'openai') {
      url += '/v1/models';
    } else if (apiType === 'gemini') {
      return url;
    }
    return url;
  }

  async function testSingleModel(config: LlmConfig, model: string): Promise<boolean> {
    const url = config.endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.api_type === 'openai') {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    return resp.ok;
  }

  function viewCheckHistory(config: LlmConfig) {
    const history = checkHistoryMap[config.id ?? 0];
    if (!history) return;
    viewingHistory = history;
    viewingConfig = config;
    showHistoryModal = true;
  }

  async function deleteCheckHistory(configId: number) {
    if (!(await customConfirm('确定要删除此检测记录吗？'))) return;
    try {
      await llmModelCheckApi.deleteByConfigId(configId);
      showMessage('检测记录已删除', 'success');
      await loadCheckHistory();
    } catch (err: any) {
      showMessage('删除失败: ' + (err.message || '未知错误'), 'error');
    }
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">LLM 密钥管理</h1>
      <p class="text-sm text-gray-500 mt-1">管理你的 AI API 密钥与端点配置</p>
    </div>
    <button
      onclick={openAddModal}
      class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
    >
      <span class="text-lg leading-none">+</span>
      <span>添加密钥</span>
    </button>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">加载中...</p>
    </div>
  {:else if configs.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🔑</div>
      <p class="text-gray-500">暂无密钥配置</p>
      <p class="text-sm">点击上方"添加密钥"开始配置</p>
    </div>
  {:else}
    {#each endpointGroups as eg}
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="text-base font-semibold text-gray-700">{eg.name}</h2>
          <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {Object.values(eg.endpoints).reduce((s, v) => s + v.length, 0)}
          </span>
        </div>
        <div class="space-y-4">
          {#each Object.entries(eg.endpoints) as [endpoint, cfgs]}
            <div class="border border-gray-200 rounded-xl overflow-hidden">
              <div class="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-xs font-semibold px-2 py-0.5 rounded {apiTypeColors[cfgs[0].api_type]}">
                    {apiTypeLabels[cfgs[0].api_type]}
                  </span>
                  <a
                    href={getEndpointUrl(endpoint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate font-mono"
                    title={endpoint}
                  >{endpoint}</a>
                  {#if cfgs[0].endpoint_note}
                    <span class="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{cfgs[0].endpoint_note}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    onclick={() => copyToClipboard(endpoint, '端点')}
                    class="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                    title="复制端点"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onclick={() => addKeyToEndpoint(cfgs[0])}
                    class="text-gray-400 hover:text-emerald-600 p-1 rounded transition-colors"
                    title="为此站点添加密钥"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <span class="text-xs text-gray-400 ml-1">{cfgs.length} 个密钥</span>
                </div>
              </div>
              <div class="divide-y divide-gray-100">
                {#each cfgs as config (config.id)}
                  {@const history = checkHistoryMap[config.id ?? 0]}
                  <div class="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                          {#if config.group}
                            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{config.group}</span>
                          {/if}
                          {#if config.key_note}
                            <span class="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{config.key_note}</span>
                          {/if}
                        </div>

                        <div class="flex items-center gap-2 text-sm">
                          <span class="text-gray-400 w-10 flex-shrink-0 text-xs">密钥</span>
                          <code class="text-gray-700 bg-gray-50 px-2 py-0.5 rounded text-xs font-mono truncate">
                            {showApiKeyMap[config.id ?? 0] ? config.api_key : maskKey(config.api_key)}
                          </code>
                          <button
                            onclick={() => toggleKeyVisibility(config.id ?? 0)}
                            class="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
                            title={showApiKeyMap[config.id ?? 0] ? '隐藏密钥' : '显示密钥'}
                          >
                            {#if showApiKeyMap[config.id ?? 0]}
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            {:else}
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            {/if}
                          </button>
                          <button
                            onclick={() => copyToClipboard(config.api_key, '密钥')}
                            class="text-gray-400 hover:text-blue-600 flex-shrink-0 transition-colors"
                            title="复制密钥"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>

                        {#if history}
                          <button
                            onclick={() => viewCheckHistory(config)}
                            class="flex items-center gap-2 text-xs mt-1.5 group cursor-pointer"
                            title="点击查看检测详情"
                          >
                            <span class="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium group-hover:bg-emerald-100 transition-colors">
                              {history.available_count}/{history.total_count} 可用
                            </span>
                            <span class="text-gray-400 group-hover:text-gray-600 transition-colors">检测于 {formatDateTime(history.created_at)}</span>
                            <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        {/if}

                        {#if config.created_at && !history}
                          <div class="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            <span>添加于 {formatDate(config.created_at)}</span>
                          </div>
                        {/if}
                      </div>

                      <div class="flex items-center gap-1 flex-shrink-0">
                        <button
                          onclick={() => startModelCheck(config)}
                          disabled={checkRunning}
                          class="text-gray-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-40"
                          title="检测模型可用性"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {#if history}
                          <button
                            onclick={() => deleteCheckHistory(config.id!)}
                            class="text-gray-400 hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                            title="删除检测记录"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        {/if}
                        <button
                          onclick={() => openEditModal(config)}
                          class="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="编辑"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onclick={() => deleteConfig(config.id!)}
                          class="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="删除"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

{#if showEditModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showEditModal = false; }}>
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
      <h3 class="text-xl font-bold mb-5">{isNew ? '添加密钥' : '编辑密钥'}</h3>
      <div class="space-y-4">
        <div>
          <label for="edit-api-type" class="block text-sm font-medium text-gray-700 mb-1">API 类型</label>
          <div id="edit-api-type" class="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {#each (['openai', 'gemini', 'claude'] as const) as type}
              <button
                type="button"
                class="flex-1 py-2 text-sm font-medium rounded-md transition-all
                  {editForm.api_type === type ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => (editForm.api_type = type)}
              >
                {apiTypeLabels[type]}
              </button>
            {/each}
          </div>
        </div>

        <div>
          <label for="edit-endpoint" class="block text-sm font-medium text-gray-700 mb-1">端点 (Endpoint)</label>
          <input
            id="edit-endpoint"
            bind:value={editForm.endpoint}
            type="text"
            placeholder="https://api.openai.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label for="edit-api-key" class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            id="edit-api-key"
            bind:value={editForm.api_key}
            type="text"
            placeholder="sk-..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="edit-key-note" class="block text-sm font-medium text-gray-700 mb-1">密钥备注</label>
            <input
              id="edit-key-note"
              bind:value={editForm.key_note}
              type="text"
              placeholder="密钥用途说明"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label for="edit-endpoint-note" class="block text-sm font-medium text-gray-700 mb-1">端点备注</label>
            <input
              id="edit-endpoint-note"
              bind:value={editForm.endpoint_note}
              type="text"
              placeholder="端点来源说明"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="edit-group" class="block text-sm font-medium text-gray-700 mb-1">密钥分组</label>
            <input
              id="edit-group"
              bind:value={editForm.group}
              type="text"
              placeholder="如：个人、公司、备用"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label for="edit-endpoint-group" class="block text-sm font-medium text-gray-700 mb-1">站点分组</label>
            <input
              id="edit-endpoint-group"
              bind:value={editForm.endpoint_group}
              type="text"
              placeholder="如：QQ群签到、自建、官方"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <button
          onclick={() => (showEditModal = false)}
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveConfig}
          disabled={saving}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCheckModal && !checkMinimized}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style="max-height: 80vh;">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div class="flex items-center gap-2">
          <div class="flex gap-1.5">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div class="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span class="text-gray-400 text-sm ml-2 font-mono">
            {checkingConfig?.endpoint ?? ''} — 模型检测
          </span>
        </div>
        <div class="flex items-center gap-3">
          {#if checkRunning}
            <span class="text-xs text-gray-500 font-mono">
              {checkProgress.done}/{checkProgress.total}
            </span>
          {/if}
          {#if checkRunning}
            <button
              onclick={() => { checkMinimized = true; }}
              class="text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="最小化"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
            </button>
          {/if}
          <button
            onclick={() => { showCheckModal = false; checkMinimized = false; }}
            class="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="关闭"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        bind:this={consoleEl}
        class="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
      >
        {#each checkLogs as log, i}
          <div
            class="whitespace-pre-wrap break-all
              {log.type === 'ok' ? 'text-emerald-400' : ''}
              {log.type === 'fail' ? 'text-red-400' : ''}
              {log.type === 'system' ? 'text-sky-400' : ''}
              {log.type === 'info' ? 'text-gray-300' : ''}"
          >
            {log.text || '\u00A0'}
          </div>
        {/each}
        {#if checkRunning}
          <div class="text-gray-500 animate-pulse">▌</div>
        {/if}
      </div>

      {#if !checkRunning && checkLogs.length > 0}
        <div class="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button
            onclick={() => {
              const text = checkLogs.map(l => l.text).join('\n');
              copyToClipboard(text, '检测日志');
            }}
            class="text-gray-400 hover:text-gray-200 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            复制日志
          </button>
          <button
            onclick={() => { showCheckModal = false; checkMinimized = false; }}
            class="bg-gray-700 text-gray-200 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-600 transition-colors"
          >
            关闭
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if checkMinimized && showCheckModal}
  <button
    onclick={() => { checkMinimized = false; }}
    class="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white pl-4 pr-3 py-2.5 rounded-full shadow-lg hover:bg-gray-800 transition-colors group"
    aria-label="恢复检测窗口"
  >
    {#if checkRunning}
      <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
      <span class="text-sm font-mono">{checkProgress.done}/{checkProgress.total}</span>
    {:else}
      <div class="w-2 h-2 rounded-full bg-sky-400"></div>
      <span class="text-sm">检测完成</span>
    {/if}
    <svg class="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  </button>
{/if}

{#if showHistoryModal && viewingHistory && viewingConfig}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) showHistoryModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showHistoryModal = false; }}>
    <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col" style="max-height: 80vh;">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 class="text-lg font-bold text-gray-900">模型检测记录</h3>
          <p class="text-xs text-gray-500 mt-0.5 font-mono">{viewingConfig.endpoint}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={() => copyToClipboard((viewingHistory!.available_models || []).join('\n'), '可用模型列表')}
            class="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            title="复制可用模型列表"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onclick={() => { showHistoryModal = false; }}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-sm">
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="text-emerald-700 font-semibold">{viewingHistory.available_count} 可用</span>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-400"></span>
          <span class="text-red-600 font-semibold">{viewingHistory.total_count - viewingHistory.available_count} 不可用</span>
        </span>
        <span class="text-gray-400">|</span>
        <span class="text-gray-500">共 {viewingHistory.total_count} 个模型</span>
        <span class="text-gray-400">|</span>
        <span class="text-gray-400">{formatDateTime(viewingHistory.created_at)}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        {#if (viewingHistory.available_models || []).length > 0}
          <div class="mb-5">
            <h4 class="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              可用模型 ({viewingHistory.available_count})
            </h4>
            <div class="space-y-0.5">
              {#each [...(viewingHistory.available_models || [])].sort((a, b) => a.localeCompare(b)) as model}
                <div class="text-xs font-mono text-emerald-700 bg-emerald-50/50 px-2 py-1 rounded hover:bg-emerald-50 transition-colors">
                  {model}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if (viewingHistory.unavailable_models || []).length > 0}
          <div>
            <h4 class="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              不可用模型 ({viewingHistory.total_count - viewingHistory.available_count})
            </h4>
            <div class="space-y-0.5">
              {#each [...(viewingHistory.unavailable_models || [])].sort((a, b) => a.model.localeCompare(b.model)) as item}
                <div class="flex items-baseline gap-2 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">
                  <span class="text-red-400 flex-shrink-0">✕</span>
                  <span class="font-mono text-gray-700">{item.model}</span>
                  <span class="text-gray-400 truncate" title={item.reason}>{item.reason}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if (viewingHistory.available_models || []).length === 0 && (viewingHistory.unavailable_models || []).length === 0}
          <div class="text-center py-8 text-gray-400">
            <p>暂无模型数据</p>
          </div>
        {/if}
      </div>

      <div class="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
        <button
          onclick={async () => {
            showHistoryModal = false;
            await deleteCheckHistory(viewingConfig!.id!);
          }}
          class="text-red-400 hover:text-red-600 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          删除记录
        </button>
        <button
          onclick={() => { showHistoryModal = false; }}
          class="bg-gray-100 text-gray-700 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
{/if}
