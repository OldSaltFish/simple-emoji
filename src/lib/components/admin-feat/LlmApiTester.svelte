<script lang="ts">
  import { onMount } from 'svelte';
  import { showMessage } from '$lib/stores/messageStore';
  import { customConfirm } from '$lib/stores/dialogStore';
  import { llmConfigApi, type LlmConfig } from '$lib/api/llmConfig';
  import { llmModelCheckApi, type LlmModelCheck } from '$lib/api/llmModelCheck';
  import { llmChatApi, getCustomModels } from '$lib/api/llmChat';
  import type { ChatMessage, ChatModelSource } from '$lib/api/llmChat';

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
  let loading = $state(false);
  let showEditModal = $state(false);
  let isNew = $state(false);
  let saving = $state(false);

  let currentPage = $state(1);
  let total = $state(0);
  const PAGE_SIZE_OPTIONS = [4, 10, 20, 50];
  let pageSize = $state(4);

  let filterGroup = $state('');
  let filterEndpointGroup = $state('');
  let showDisabled = $state(false);
  let availableGroups = $state<string[]>([]);
  let availableEndpointGroups = $state<string[]>([]);

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

  interface ChatMsg { role: 'user' | 'assistant'; content: string; loading?: boolean; error?: string; }
  let showChatModal = $state(false);
  let chatSources = $state<ChatModelSource[]>([]);
  let chatConfigId = $state<number | null>(null);
  let chatModel = $state('');
  let chatShowUnavailable = $state(false);
  let chatShowDisabled = $state(false);
  let chatMessages = $state<ChatMsg[]>([]);
  let chatInput = $state('');
  let chatSending = $state(false);
  let chatEndEl: HTMLDivElement | undefined = $state();
  let chatConfigPickerOpen = $state(false);
  let chatModelPickerOpen = $state(false);
  let chatApiType = $state<'openai' | 'claude'>('openai');
  const CHAT_API_TYPES = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude/Anthropic' },
  ] as const;

  async function loadConfigs() {
    loading = true;
    try {
      const filters: { group?: string; endpoint_group?: string; disabled?: boolean } = {};
      if (filterGroup && filterGroup !== '__none__') filters.group = filterGroup;
      else if (filterGroup === '__none__') filters.group = '';
      if (filterEndpointGroup && filterEndpointGroup !== '__none__') filters.endpoint_group = filterEndpointGroup;
      else if (filterEndpointGroup === '__none__') filters.endpoint_group = '';
      if (!showDisabled) filters.disabled = false;
      const res = await llmConfigApi.list(currentPage, pageSize, filters);
      configs = res.list || [];
      total = res.total || 0;
    } catch {
      showMessage('加载配置失败', 'error');
    } finally {
      loading = false;
    }
  }

  async function loadFilterGroups() {
    try {
      const res = await llmConfigApi.getGroups();
      availableGroups = res.groups || [];
      availableEndpointGroups = res.endpoint_groups || [];
    } catch {}
  }

  onMount(async () => {
    await Promise.all([loadConfigs(), loadFilterGroups()]);
  });

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
      await Promise.all([loadConfigs(), loadFilterGroups()]);
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
      currentPage = 1;
      await Promise.all([loadConfigs(), loadFilterGroups()]);
    } catch (err: any) {
      showMessage('删除失败: ' + (err.message || '未知错误'), 'error');
    }
  }

  function onFilterChange() {
    currentPage = 1;
    loadConfigs();
  }

  function goToPage(page: number) {
    currentPage = page;
    loadConfigs();
  }

  function onPageSizeChange(val: number) {
    pageSize = val;
    currentPage = 1;
    loadConfigs();
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
        const saved = await llmModelCheckApi.upsert({
          llm_config_id: config.id!,
          available_models: available,
          unavailable_models: unavailable,
          total_count: models.length,
          available_count: available.length,
        });
        addLog('检测结果已保存', 'system');
        const idx = configs.findIndex(c => c.id === config.id);
        if (idx !== -1) configs[idx].check_history = saved;
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
    const history = config.check_history;
    if (!history) return;
    viewingHistory = history;
    viewingConfig = config;
    showHistoryModal = true;
  }

  let chatCurrentSource = $derived<ChatModelSource | undefined>(
    chatSources.find((s) => s.config_id === chatConfigId)
  );
  let chatDisplaySources = $derived(
    chatShowDisabled ? chatSources : chatSources.filter(s => !s.disabled)
  );
  let chatModelOptions = $derived<string[]>(
    chatCurrentSource
      ? (() => {
          const detected = chatShowUnavailable
            ? [...chatCurrentSource.available_models, ...chatCurrentSource.unavailable_models]
            : [...chatCurrentSource.available_models];
          const custom = getCustomModels(chatConfigId!);
          const merged = [...new Set([...detected, ...custom])];
          return merged.sort();
        })()
      : []
  );

  async function openChatModal(config: LlmConfig) {
    showChatModal = true;
    chatConfigPickerOpen = false;
    chatModelPickerOpen = false;
    const rawType = (config.api_type || 'openai').toLowerCase();
    chatApiType = (rawType === 'claude' || rawType === 'anthropic') ? 'claude' : 'openai';
    try {
      chatSources = await llmChatApi.getAvailableModels();
      chatConfigId = config.id!;
      chatShowUnavailable = false;
      chatMessages = [];
      autoSelectChatModel();
    } catch {}
  }

  function autoSelectChatModel() {
    const opts = chatModelOptions;
    if (opts.length > 0 && !opts.includes(chatModel)) chatModel = opts[0];
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatSending || !chatConfigId || !chatModel) return;
    chatMessages = [...chatMessages, { role: 'user', content: text }];
    chatMessages = [...chatMessages, { role: 'assistant', content: '', loading: true }];
    chatInput = '';
    chatSending = true;

    const history: ChatMessage[] = chatMessages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content }));

    try {
      for await (const chunk of llmChatApi.streamChat(chatConfigId!, chatModel, history, chatSources, chatApiType)) {
        const parsed = JSON.parse(chunk);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          const msgs = [...chatMessages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant') { last.content += delta; last.loading = false; }
          chatMessages = msgs;
        }
      }
      const msgs = [...chatMessages];
      const last = msgs[msgs.length - 1];
      if (last) last.loading = false;
      chatMessages = msgs;
    } catch (err: any) {
      const msgs = [...chatMessages];
      const last = msgs[msgs.length - 1];
      if (last) { last.error = err.message || '发送失败'; last.loading = false; }
      chatMessages = msgs;
    } finally {
      chatSending = false;
      requestAnimationFrame(() => chatEndEl?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  async function deleteCheckHistory(configId: number) {
    if (!(await customConfirm('确定要删除此检测记录吗？'))) return;
    try {
      await llmModelCheckApi.deleteByConfigId(configId);
      showMessage('检测记录已删除', 'success');
      const idx = configs.findIndex(c => c.id === configId);
      if (idx !== -1) configs[idx].check_history = undefined;
    } catch (err: any) {
      showMessage('删除失败: ' + (err.message || '未知错误'), 'error');
    }
  }

  async function toggleDisabled(configId: number) {
    try {
      const updated = await llmConfigApi.toggleDisabled(configId);
      const idx = configs.findIndex(c => c.id === configId);
      if (idx !== -1) configs[idx] = updated;
      showMessage(updated.disabled ? '已禁用' : '已启用', 'success');
    } catch (err: any) {
      showMessage('操作失败: ' + (err.message || '未知错误'), 'error');
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
    <div class="flex flex-wrap gap-3 mb-4">
      <select
        value={filterGroup}
        onchange={(e) => { filterGroup = (e.target as HTMLSelectElement).value; onFilterChange(); }}
        class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">全部密钥分组</option>
        <option value="__none__">(无)</option>
        {#each availableGroups as g}
          <option value={g}>{g}</option>
        {/each}
      </select>
      <select
        value={filterEndpointGroup}
        onchange={(e) => { filterEndpointGroup = (e.target as HTMLSelectElement).value; onFilterChange(); }}
        class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">全部站点分组</option>
        <option value="__none__">(无)</option>
        {#each availableEndpointGroups as eg}
          <option value={eg}>{eg}</option>
        {/each}
      </select>
      {#if filterGroup || filterEndpointGroup}
        <button
          onclick={() => { filterGroup = ''; filterEndpointGroup = ''; onFilterChange(); }}
          class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >清除筛选</button>
      {/if}
      <label class="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-500 cursor-pointer select-none self-center">
        <input type="checkbox" bind:checked={showDisabled} onchange={onFilterChange} class="rounded border-gray-300" />
        <span>显示已禁用</span>
      </label>
      <span class="ml-auto text-sm text-gray-400 self-center">共 {total} 条</span>
    </div>

    <div class="space-y-3">
      {#each configs as config (config.id)}
        {@const history = config.check_history}
        <div class="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors {config.disabled ? 'opacity-60' : ''}">
          <div class="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs font-semibold px-2 py-0.5 rounded {apiTypeColors[config.api_type]}">
                {apiTypeLabels[config.api_type]}
              </span>
              {#if config.disabled}
                <span class="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-600">已禁用</span>
              {/if}
              <a
                href={getEndpointUrl(config.endpoint)}
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate font-mono"
                title={config.endpoint}
              >{config.endpoint}</a>
              {#if config.endpoint_note}
                <span class="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{config.endpoint_note}</span>
              {/if}
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                onclick={() => copyToClipboard(config.endpoint, '端点')}
                class="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                title="复制端点"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
              <button
                onclick={() => addKeyToEndpoint(config)}
                class="text-gray-400 hover:text-emerald-600 p-1 rounded transition-colors"
                title="为此站点添加密钥"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
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
                  {#if config.endpoint_group}
                    <span class="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded">{config.endpoint_group}</span>
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
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    {:else}
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    {/if}
                  </button>
                  <button
                    onclick={() => copyToClipboard(config.api_key, '密钥')}
                    class="text-gray-400 hover:text-blue-600 flex-shrink-0 transition-colors"
                    title="复制密钥"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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
                    <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
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
                  onclick={() => toggleDisabled(config.id!)}
                  class="{config.disabled ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'} p-1.5 rounded-lg transition-colors"
                  title={config.disabled ? '启用' : '禁用'}
                >
                  {#if config.disabled}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  {/if}
                </button>
                <button
                  onclick={() => startModelCheck(config)}
                  disabled={checkRunning}
                  class="text-gray-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-40"
                  title="检测模型可用性"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button
                  onclick={() => openChatModal(config)}
                  class="text-gray-400 hover:text-purple-600 p-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                  title="与模型对话"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
                {#if history}
                  <button
                    onclick={() => deleteCheckHistory(config.id!)}
                    class="text-gray-400 hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                    title="删除检测记录"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                {/if}
                <button
                  onclick={() => openEditModal(config)}
                  class="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  title="编辑"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onclick={() => deleteConfig(config.id!)}
                  class="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="删除"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if total > pageSize}
      <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <div class="flex items-center gap-3 text-sm text-gray-500">
          <span>第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} 条，共 {total} 条</span>
          <select
            value={pageSize}
            onchange={(e) => onPageSizeChange(Number((e.target as HTMLSelectElement).value))}
            class="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {#each PAGE_SIZE_OPTIONS as opt}
              <option value={opt}>{opt} 条/页</option>
            {/each}
          </select>
        </div>
        <div class="flex items-center gap-1">
          <button
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >上一页</button>
          {#each Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1) as page}
            {#if page === currentPage || Math.abs(page - currentPage) <= 1 || page === 1 || page === Math.ceil(total / pageSize)}
              <button
                onclick={() => goToPage(page)}
                class="px-3 py-1.5 text-sm rounded-md transition-colors {page === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}"
              >{page}</button>
            {:else if page === currentPage - 2 || page === currentPage + 2}
              <span class="px-1 text-gray-400">...</span>
            {/if}
          {/each}
          <button
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= Math.ceil(total / pageSize)}
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >下一页</button>
        </div>
      </div>
    {/if}
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

{#if showChatModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) { showChatModal = false; chatConfigPickerOpen = false; chatModelPickerOpen = false; } }} onkeydown={(e) => { if (e.key === 'Escape') { showChatModal = false; chatConfigPickerOpen = false; chatModelPickerOpen = false; } }}>
    <div class="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col" style="max-height: 85vh;">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 class="text-base font-bold text-gray-900">模型对话</h3>
        <button onclick={() => { showChatModal = false; chatConfigPickerOpen = false; chatModelPickerOpen = false; }} class="text-gray-400 hover:text-gray-600 transition-colors" aria-label="关闭">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="flex" style="height: calc(85vh - 110px);">
        <!-- 左侧面板 -->
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="w-56 border-r border-gray-200 flex flex-col bg-gray-50/50" onclick={() => { chatConfigPickerOpen = false; chatModelPickerOpen = false; }} role="presentation">
          <!-- 端点选择（自定义下拉） -->
          <div class="p-3 space-y-2 border-b border-gray-200">
            {#if !chatConfigPickerOpen}
              <button
                onclick={(e) => { e.stopPropagation(); chatConfigPickerOpen = true; }}
                class="w-full text-left px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors flex items-center justify-between"
              >
                <span class="truncate font-medium {chatCurrentSource ? 'text-gray-800' : 'text-gray-400'}">{chatCurrentSource ? chatCurrentSource.endpoint : '选择端点'}</span>
                <svg class="w-3 h-3 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="relative" onclick={(e) => e.stopPropagation()} role="presentation">
                <div class="w-full px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg bg-white shadow-sm flex items-center justify-between">
                  <span class="truncate font-medium text-gray-800">{chatCurrentSource?.endpoint || '选择端点'}</span>
                  <svg class="w-3 h-3 text-blue-500 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                </div>
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                  {#each chatDisplaySources as src}
                    <button
                      onclick={() => { chatConfigId = src.config_id; chatModel = ''; autoSelectChatModel(); chatConfigPickerOpen = false; }}
                      class="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors {src.config_id === chatConfigId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}"
                    >
                      <div class="truncate font-medium">{src.endpoint}</div>
                      <div class="text-[10px] text-gray-400 mt-0.3">{src.api_type} · {src.available_models.length > 0 ? src.available_models.length + ' 可用' : '未检测'}</div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- 模型名称（手动输入） -->
            <input
              bind:value={chatModel}
              type="text"
              placeholder="输入模型名称"
              onclick={(e) => e.stopPropagation()}
              class="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono hover:border-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
            />

            {#if chatModelOptions.length > 0}
              <!-- 快捷选择 -->
              {#if !chatModelPickerOpen}
                <button
                  onclick={(e) => { e.stopPropagation(); chatModelPickerOpen = true; }}
                  class="w-full text-left px-2 py-1 text-[11px] text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors flex items-center gap-1"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  快速选择 ({chatModelOptions.length} 个)
                </button>
              {:else}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="relative" onclick={(e) => e.stopPropagation()} role="presentation">
                  <div class="w-full px-2 py-1 text-[11px] border border-blue-300 rounded-md bg-blue-50/50 text-blue-700 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                    选择模型
                  </div>
                  <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto z-20">
                    {#each chatModelOptions as m}
                      <button
                        onclick={() => { chatModel = m; chatModelPickerOpen = false; }}
                        class="w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors font-mono {m === chatModel ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'}"
                      >{m}</button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/if}

            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <label class="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500" onclick={(e) => e.stopPropagation()}>
              <input type="checkbox" bind:checked={chatShowUnavailable} onchange={autoSelectChatModel} class="rounded border-gray-300 w-3 h-3" />
              显示未通过测试的模型
            </label>
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <label class="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500" onclick={(e) => e.stopPropagation()}>
              <input type="checkbox" bind:checked={chatShowDisabled} class="rounded border-gray-300 w-3 h-3" />
              显示已禁用密钥
            </label>

            {#if chatCurrentSource}
              <div class="p-2 bg-white rounded-md text-[10px] space-y-1 border border-gray-100">
                <div class="flex items-center justify-between">
                  <span class="text-gray-500">请求格式</span>
                  <select
                    bind:value={chatApiType}
                    onclick={(e) => e.stopPropagation()}
                    class="text-[10px] font-medium border border-gray-200 rounded px-1 py-0.5 bg-white hover:border-gray-300 focus:outline-none"
                  >
                    {#each CHAT_API_TYPES as t}
                      <option value={t.value}>{t.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="truncate"><span class="text-gray-500">分组:</span> {chatCurrentSource.endpoint_group || '-'}</div>
              </div>
            {/if}
          </div>

          <!-- 快捷端点列表 -->
          <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            {#each chatSources as src}
              <button
                onclick={() => { chatConfigId = src.config_id; chatModel = ''; autoSelectChatModel(); }}
                class="w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors {src.config_id === chatConfigId
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100/80 text-gray-600'}"
              >{src.endpoint}</button>
            {/each}
          </div>
        </div>

        <!-- 右侧对话区 -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            {#if chatMessages.length === 0}
              <div class="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
                <svg class="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <p class="text-sm">选择模型后开始对话</p>
              </div>
            {:else}
              {#each chatMessages as msg}
                <div class="flex gap-2 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                  <div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm {msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}">
                    {#if msg.role === 'assistant' && msg.loading && !msg.content}
                      <div class="flex gap-1 py-1">
                        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                      </div>
                    {:else if msg.error}
                      <p class="text-red-500">{msg.error}</p>
                    {:else}
                      <div class="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                      {#if msg.role === 'assistant' && msg.loading}
                        <span class="inline-block w-1 h-3.5 bg-blue-500 ml-0.5 animate-pulse align-middle"></span>
                      {/if}
                    {/if}
                  </div>
                </div>
              {/each}
              <div bind:this={chatEndEl}></div>
            {/if}
          </div>

          <div class="border-t border-gray-200 p-3 flex gap-2 items-end">
            {#if chatModel}
              <div class="shrink-0 px-2 py-1.5 bg-purple-50 text-purple-700 text-[11px] font-mono rounded-lg max-w-[160px] truncate" title={chatModel}>{chatModel}</div>
            {/if}
            <textarea
              bind:value={chatInput}
              onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="{chatModel ? 'Enter 发送，Shift+Enter 换行' : '请先选择模型'}"
              rows="1"
              disabled={chatSending || !chatConfigId || !chatModel}
              class="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
              style="max-height: 80px; min-height: 36px;"
            ></textarea>
            <button
              onclick={sendChatMessage}
              disabled={chatSending || !chatInput.trim() || !chatConfigId || !chatModel}
              class="shrink-0 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {#if chatSending}
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              {:else}
                发送
              {/if}
            </button>
          </div>
        </div>
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
        {#each checkLogs as log}
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
