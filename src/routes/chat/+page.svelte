<script lang="ts">
  import { llmChatApi, getCustomModels } from '$lib/api/llmChat';
  import type { ChatMessage, ChatModelSource } from '$lib/api/llmChat';

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
  let configPickerOpen = $state(false);
  let modelPickerOpen = $state(false);
  let apiType = $state<'openai' | 'claude'>('openai');
  const API_TYPE_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude/Anthropic' },
  ] as const;

  let currentSource = $derived<ChatModelSource | undefined>(
    sources.find((s) => s.config_id === selectedConfigId)
  );

  let displaySources = $derived(
    showDisabled ? sources : sources.filter(s => !s.disabled)
  );

  let modelOptions = $derived<string[]>(
    currentSource
      ? (() => {
          const detected = showUnavailable
            ? [...currentSource.available_models, ...currentSource.unavailable_models]
            : [...currentSource.available_models];
          const custom = getCustomModels(selectedConfigId!);
          return [...new Set([...detected, ...custom])].sort();
        })()
      : []
  );

  let configOptions = $derived<ChatModelSource[]>(displaySources);

  async function loadSources() {
    try {
      sources = await llmChatApi.getAvailableModels();
      if (sources.length > 0 && !selectedConfigId) {
        const first = displaySources[0] || sources[0];
        selectedConfigId = first.config_id;
        const raw = (first.api_type || 'openai').toLowerCase();
        apiType = (raw === 'claude' || raw === 'anthropic') ? 'claude' : 'openai';
      }
      autoSelectModel();
    } catch {}
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
    if (src) {
      const raw = (src.api_type || 'openai').toLowerCase();
      apiType = (raw === 'claude' || raw === 'anthropic') ? 'claude' : 'openai';
    }
    autoSelectModel();
  }

  function onToggleUnavailable() {
    showUnavailable = !showUnavailable;
    autoSelectModel();
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

  loadSources();
</script>

<svelte:head>
  <title>模型聊天 - 魂祈梦</title>
</svelte:head>

<div class="h-[calc(100vh-4rem)] flex bg-gray-50" onclick={() => { configPickerOpen = false; modelPickerOpen = false; }}>
  <!-- 左侧面板 -->
  <div class="w-72 bg-white border-r border-gray-200 flex flex-col">
    <div class="p-4 border-b border-gray-200 space-y-3">
      <h2 class="text-sm font-bold text-gray-900">配置选择</h2>

      {#if !configPickerOpen}
        <button
          onclick={(e) => { e.stopPropagation(); configPickerOpen = true; }}
          class="w-full text-left px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors flex items-center justify-between"
        >
          <span class="truncate font-medium {currentSource ? 'text-gray-800' : 'text-gray-400'}">{currentSource ? currentSource.endpoint : '选择端点'}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
      {:else}
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <div class="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg bg-white shadow-sm flex items-center justify-between">
            <span class="truncate font-medium text-gray-800">{currentSource?.endpoint || '选择端点'}</span>
            <svg class="w-3.5 h-3.5 text-blue-500 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
          </div>
          <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto z-20">
            {#each configOptions as src}
              <button
                onclick={() => { onConfigChange(src.config_id); configPickerOpen = false; }}
                class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors {src.config_id === selectedConfigId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}"
              >
                <div class="truncate font-medium">{src.endpoint}</div>
                <div class="text-xs text-gray-400 mt-0.3">{src.api_type} · {src.available_models.length} 可用</div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 模型名称（手动输入） -->
      <input
        bind:value={selectedModel}
        type="text"
        placeholder="输入模型名称"
        onclick={(e) => e.stopPropagation()}
        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-mono hover:border-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
      />

      {#if modelOptions.length > 0}
        {#if !modelPickerOpen}
          <button
            onclick={(e) => { e.stopPropagation(); modelPickerOpen = true; }}
            class="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors flex items-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            快速选择 ({modelOptions.length} 个)
          </button>
        {:else}
          <div class="relative" onclick={(e) => e.stopPropagation()}>
            <div class="w-full px-3 py-1.5 text-xs border border-blue-300 rounded-md bg-blue-50/50 text-blue-700 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              选择模型
            </div>
            <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-20">
              {#each modelOptions as m}
                <button
                  onclick={() => { selectedModel = m; modelPickerOpen = false; }}
                  class="w-full text-left px-3 py-1.5 text-sm hover:bg-purple-50 transition-colors font-mono {m === selectedModel ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'}"
                >{m}</button>
              {/each}
            </div>
          </div>
        {/if}
      {/if}

      <label class="flex items-center gap-2 cursor-pointer select-none" onclick={(e) => e.stopPropagation()}>
        <input type="checkbox" bind:checked={showUnavailable} onchange={onToggleUnavailable} class="rounded border-gray-300" />
        <span class="text-xs text-gray-500">显示未通过测试的模型</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer select-none" onclick={(e) => e.stopPropagation()}>
        <input type="checkbox" bind:checked={showDisabled} class="rounded border-gray-300" />
        <span class="text-xs text-gray-500">显示已禁用密钥</span>
      </label>

      {#if currentSource}
        <div class="p-2 bg-gray-50 rounded-lg text-xs space-y-1 border border-gray-100">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">请求格式</span>
            <select
              bind:value={apiType}
              onclick={(e) => e.stopPropagation()}
              class="text-xs font-medium border border-gray-200 rounded px-1.5 py-0.5 bg-white hover:border-gray-300 focus:outline-none"
            >
              {#each API_TYPE_OPTIONS as t}
                <option value={t.value}>{t.label}</option>
              {/each}
            </select>
          </div>
          <div class="truncate text-gray-500"><span class="font-medium text-gray-600">分组:</span> {currentSource.endpoint_group || '-'}</div>
        </div>
      {/if}

      <button
        onclick={clearMessages}
        class="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-lg transition-colors"
      >清空对话</button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">可用来源 ({configOptions.length})</h3>
      <div class="space-y-1.5">
        {#each configOptions as src}
          <button
            onclick={() => onConfigChange(src.config_id)}
            class="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors {src.config_id === selectedConfigId
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'}"
          >
            <div class="font-medium truncate">{src.endpoint}</div>
            <div class="text-gray-400 mt-0.5">{src.available_models.length} 可用 / {src.unavailable_models.length} 不可用</div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- 右侧对话区 -->
  <div class="flex-1 flex flex-col min-w-0">
    <div class="flex-1 overflow-y-auto p-6 space-y-4">
      {#if messages.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
          <svg class="w-16 h-16 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <p class="text-sm">选择模型后开始对话</p>
        </div>
      {:else}
        {#each messages as msg, i}
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
          placeholder="{selectedModel ? '输入消息，Enter 发送，Shift+Enter 换行' : '请先选择密钥和模型'}"
          rows="1"
          disabled={sending || !selectedConfigId || !selectedModel}
          class="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm hover:border-gray-400 focus:border-gray-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 placeholder:text-gray-400 transition-colors"
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
  </div>
</div>