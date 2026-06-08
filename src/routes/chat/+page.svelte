<script lang="ts">
  import { llmChatApi, getCustomModels } from '$lib/api/llmChat';
  import type { ChatMessage, ChatModelSource } from '$lib/api/llmChat';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
    loading?: boolean;
    error?: string;
  }

  let sources = $state<ChatModelSource[]>([]);
  let selectedConfigId = $state<number | null>(null);
  let selectedModel = $state('');
  let showUnavailable = $state(false);
  let showDisabled = $state(false);
  let messages = $state<Message[]>([]);
  let inputText = $state('');
  let sending = $state(false);
  let chatEndEl: HTMLDivElement | undefined = $state();
  let apiType = $state<'openai' | 'claude'>('openai');
  const API_TYPE_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude/Anthropic' },
  ] as const;

  // --- derived ---

  let currentSource = $derived<ChatModelSource | undefined>(
    sources.find((s) => s.config_id === selectedConfigId)
  );

  let displaySources = $derived(
    showDisabled ? sources : sources.filter(s => !s.disabled)
  );

  let modelOptions = $state<string[]>([]);

  // 显式追踪依赖更新模型列表
  $effect(() => {
    const src = sources.find((s) => s.config_id === selectedConfigId);
    if (src) {
      const detected = showUnavailable
        ? [...src.available_models, ...src.unavailable_models]
        : [...src.available_models];
      const custom = getCustomModels(selectedConfigId!);
      modelOptions = [...new Set([...detected, ...custom])].sort();
    } else {
      modelOptions = [];
    }
  });

  let modelDropdownOpen = $state(false);

  // ===== URL 同步逻辑 =====
  function syncUrl() {
    const params = new URLSearchParams();
    if (selectedConfigId) params.set('config', selectedConfigId.toString());
    if (selectedModel) params.set('model', encodeURIComponent(selectedModel));
    if (apiType !== 'openai') params.set('api', apiType);
    const newUrl = `${page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    replaceState(newUrl, page.state);
  }

  function initFromUrl() {
    const params = page.url.searchParams;
    const configParam = params.get('config');
    if (configParam) {
      const id = parseInt(configParam);
      if (!isNaN(id)) selectedConfigId = id;
    }
    const modelParam = params.get('model');
    if (modelParam) selectedModel = decodeURIComponent(modelParam);
    const apiParam = params.get('api');
    if (apiParam === 'claude') apiType = 'claude';
  }

  // --- actions ---

  async function loadSources() {
    try {
      sources = await llmChatApi.getAvailableModels();
      if (sources.length > 0 && !selectedConfigId) {
        const first = displaySources[0] || sources[0];
        selectedConfigId = first.config_id;
        syncApiType(first);
      }
      autoSelectModel();
    } catch {}
  }

  function syncApiType(src: ChatModelSource) {
    const raw = (src.api_type || 'openai').toLowerCase();
    apiType = (raw === 'claude' || raw === 'anthropic') ? 'claude' : 'openai';
  }

  function autoSelectModel() {
    const opts = modelOptions;
    if (opts.length > 0 && !opts.includes(selectedModel)) {
      selectedModel = opts[0];
    }
  }

  function onConfigChange(val: number) {
    selectedConfigId = val;
    selectedModel = '';
    const src = sources.find((s) => s.config_id === val);
    if (src) syncApiType(src);
    autoSelectModel();
    syncUrl();
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || sending || !selectedConfigId || !selectedModel) return;

    messages = [...messages, { role: 'user', content: text }];
    messages = [...messages, { role: 'assistant', content: '', loading: true }];
    inputText = '';
    sending = true;

    const history: ChatMessage[] = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      for await (const chunk of llmChatApi.streamChat(selectedConfigId!, selectedModel, history, sources, apiType)) {
        const parsed = JSON.parse(chunk);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          const msgs = [...messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant') {
            last.content += delta;
            last.loading = false;
          }
          messages = msgs;
        }
      }
      const msgs = [...messages];
      const last = msgs[msgs.length - 1];
      if (last) last.loading = false;
      messages = msgs;
    } catch (err: any) {
      const msgs = [...messages];
      const last = msgs[msgs.length - 1];
      if (last) {
        last.error = err.message || '发送失败';
        last.loading = false;
      }
      messages = msgs;
    } finally {
      sending = false;
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatEndEl?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function clearMessages() {
    messages = [];
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function toggleModelDropdown() {
    modelDropdownOpen = !modelDropdownOpen && modelOptions.length > 0;
  }

  function closeModelDropdown() {
    modelDropdownOpen = false;
  }

  function onModelSelect(m: string) {
    selectedModel = m;
    modelDropdownOpen = false;
    syncUrl();
  }

  function onApiTypeChange(val: string) {
    apiType = val as 'openai' | 'claude';
    syncUrl();
  }

  initFromUrl();
  loadSources();
</script>

<svelte:head>
  <title>模型聊天 - 魂祈梦</title>
</svelte:head>

<div class="h-[calc(100vh-4rem)] flex bg-gray-50" onclick={closeModelDropdown}>
  <!-- ====== 左侧面板 ====== -->
  <aside class="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
    <!-- 来源列表：固定最大高度 -->
    <div class="overflow-y-auto" style="max-height: 40%;">
      <div class="p-3 border-b border-gray-100">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          可用来源 ({displaySources.length})
        </h3>
        <div class="space-y-1">
          {#each displaySources as src}
            <button
              onclick={() => onConfigChange(src.config_id)}
              class="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors group {src.config_id === selectedConfigId
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'hover:bg-gray-50 text-gray-600 border border-transparent'}"
            >
              <div class="font-medium truncate">{src.endpoint}</div>
              <div class="text-gray-400 mt-0.5">
                {src.available_models.length} 可用
                {#if src.unavailable_models.length > 0}
                  / <span class="text-orange-400">{src.unavailable_models.length} 不可用</span>
                {/if}
                {#if src.disabled}
                  <span class="ml-1 text-red-400">(已禁用)</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- 操作区：固定底部，无需滚动 -->
    {#if currentSource}
      <div class="flex-1 flex flex-col min-h-0 p-3 space-y-3 overflow-y-auto">

          <!-- 模型选择（combobox） -->
          <div>
            <label class="text-xs font-medium text-gray-500 mb-1 block">模型</label>
            <div class="relative" onclick={(e) => e.stopPropagation()}>
              <!-- 触发器：输入框 + 下拉按钮 -->
              <div class="flex gap-1">
                <input
                  bind:value={selectedModel}
                  type="text"
                  placeholder="输入或选择模型"
                  onclick={toggleModelDropdown}
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-mono hover:border-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 transition-colors"
                />
                {#if modelOptions.length > 0}
                  <button
                    type="button"
                    onclick={toggleModelDropdown}
                    class="px-2.5 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-400 transition-colors shrink-0"
                    title="选择模型"
                  >
                    <svg class="w-4 h-4 {modelDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                {/if}
              </div>

              {#if modelDropdownOpen}
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-20">
                  {#each modelOptions as m}
                    <button
                      type="button"
                      onclick={() => onModelSelect(m)}
                      class="w-full text-left px-3 py-1.5 text-sm hover:bg-purple-50 transition-colors font-mono {m === selectedModel ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'}"
                    >{m}</button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- API 类型 -->
          <div>
            <label class="text-xs font-medium text-gray-500 mb-1 block">请求格式</label>
            <select
              value={apiType}
              onchange={(e) => onApiTypeChange((e.target as HTMLSelectElement).value)}
              class="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:border-blue-300 transition-colors"
            >
              {#each API_TYPE_OPTIONS as t}
                <option value={t.value}>{t.label}</option>
              {/each}
            </select>
          </div>

          <!-- 显示选项 -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-500">
              <input type="checkbox" bind:checked={showUnavailable} class="rounded border-gray-300" />
              显示未通过测试的模型
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-500">
              <input type="checkbox" bind:checked={showDisabled} class="rounded border-gray-300" />
              显示已禁用密钥
            </label>
          </div>

          <!-- 当前来源信息 -->
          <div class="p-2 bg-gray-50 rounded-lg text-xs space-y-1 border border-gray-100">
            <div><span class="text-gray-400">端点分组:</span> <span class="font-medium text-gray-600">{currentSource.endpoint_group || '-'}</span></div>
            <div><span class="text-gray-400">API 类型:</span> <span class="font-medium text-gray-600">{currentSource.api_type || 'openai'}</span></div>
          </div>

          <!-- 清空对话 -->
          <button
            onclick={clearMessages}
            class="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
          >清空对话</button>
      </div>
    {/if}
  </aside>

  <!-- ====== 右侧对话区 ====== -->
  <main class="flex-1 flex flex-col min-w-0">
    <!-- 消息区 -->
    <div class="flex-1 overflow-y-auto p-6 space-y-4">
      {#if messages.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
          <svg class="w-16 h-16 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <p class="text-sm">选择模型后开始对话</p>
        </div>
      {:else}
        {#each messages as msg}
          <div class="flex gap-3 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[75%] rounded-2xl px-4 py-3 {msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-md'}">
              {#if msg.role === 'assistant' && msg.loading && !msg.content}
                <div class="flex gap-1 py-1">
                  <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                  <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                  <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                </div>
              {:else if msg.error}
                <p class="text-red-500 text-sm">{msg.error}</p>
              {:else}
                <div class="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</div>
                {#if msg.role === 'assistant' && msg.loading}
                  <span class="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle"></span>
                {/if}
              {/if}
            </div>
          </div>
        {/each}
        <div bind:this={chatEndEl}></div>
      {/if}
    </div>

    <!-- 输入栏 -->
    <div class="border-t border-gray-200 bg-white p-4">
      <div class="max-w-4xl mx-auto flex gap-3 items-end">
        {#if selectedModel}
          <div class="shrink-0 px-2.5 py-2 bg-blue-50 text-blue-700 text-xs font-mono rounded-lg max-w-[200px] truncate" title={selectedModel}>
            {selectedModel}
          </div>
        {/if}
        <textarea
          bind:value={inputText}
          onkeydown={handleKeydown}
          placeholder="{selectedModel ? '输入消息，Enter 发送，Shift+Enter 换行' : '请先在左侧选择密钥和模型'}"
          rows="1"
          disabled={sending || !selectedConfigId || !selectedModel}
          class="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm hover:border-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 placeholder:text-gray-400 transition-colors"
          style="max-height: 120px; min-height: 42px;"
        ></textarea>
        <button
          onclick={sendMessage}
          disabled={sending || !inputText.trim() || !selectedConfigId || !selectedModel}
          class="shrink-0 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {#if sending}
            <span class="inline-flex gap-1">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              发送中
            </span>
          {:else}
            发送
          {/if}
        </button>
      </div>
    </div>
  </main>
</div>
