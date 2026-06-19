<script lang="ts">
  import { llmChatApi, getCustomModels } from '$lib/api/llmChat';
  import type { ChatMessage, ChatModelSource } from '$lib/api/llmChat';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
    loading?: boolean;
    error?: string;
    images?: string[];
  }

  let sources = $state<ChatModelSource[]>([]);
  let selectedConfigId = $state<number | null>(null);
  let selectedModel = $state('');
  let showUnavailable = $state(false);
  let showDisabled = $state(false);
  let messages = $state<Message[]>([]);
  let inputText = $state('');
  let pendingImages = $state<string[]>([]);
  let sending = $state(false);
  let dragOver = $state(false);
  let chatEndEl: HTMLDivElement | undefined = $state();
  let apiType = $state<'openai' | 'claude'>('openai');
  let imageInputEl: HTMLInputElement | undefined = $state();
  const API_TYPE_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude/Anthropic' },
  ] as const;

  let sourcePopoverOpen = $state(false);

  // --- derived ---

  let currentSource = $derived<ChatModelSource | undefined>(
    sources.find((s) => s.config_id === selectedConfigId)
  );

  let displaySources = $derived(
    showDisabled ? sources : sources.filter(s => !s.disabled)
  );

  let modelOptions = $state<string[]>([]);

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
  }

  // --- 图片处理 ---
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function triggerImageInput() {
    if (imageInputEl) imageInputEl.value = '';
    imageInputEl?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (pendingImages.length >= 10) break;
      const base64 = await fileToBase64(file);
      pendingImages = [...pendingImages, base64];
    }
    scrollToBottom();
  }

  function removeImage(idx: number) {
    pendingImages = pendingImages.filter((_, i) => i !== idx);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  // --- 发送 ---
  async function sendMessage() {
    const text = inputText.trim();
    const hasImages = pendingImages.length > 0;
    if ((!text && !hasImages) || sending || !selectedConfigId || !selectedModel) return;

    const newMsg: Message = { role: 'user', content: text, images: hasImages ? [...pendingImages] : undefined };
    messages = [...messages, newMsg];
    messages = [...messages, { role: 'assistant', content: '', loading: true }];
    inputText = '';
    pendingImages = [];
    sending = true;

    const history: ChatMessage[] = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map((m) => ({ role: m.role, content: m.content, images: m.images }));

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
  }

  function onApiTypeChange(val: string) {
    apiType = val as 'openai' | 'claude';
  }

  loadSources();
</script>

<!-- 隐藏的文件选择框 -->
<input bind:this={imageInputEl} type="file" accept="image/*" multiple class="hidden" onchange={() => handleFiles(imageInputEl?.files ?? null)} />

<div class="flex h-full relative flex-col" onclick={closeModelDropdown} ondrop={handleDrop} ondragover={handleDragOver} ondragleave={handleDragLeave}>
  <!-- 拖拽遮罩 -->
  {#if dragOver}
    <div class="absolute inset-0 z-30 bg-indigo-500/10 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none rounded-xl border-2 border-dashed border-indigo-400 transition-all duration-200">
      <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-3">
        <svg class="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 6 0 00-2-2H6a2 6 0 00-2 2v12a2 6 0 002 2z"/></svg>
      </div>
      <span class="text-indigo-600 font-medium text-sm">松开以上传图片</span>
    </div>
  {/if}

  <!-- ===== 消息区 ===== -->
  <div class="flex-1 overflow-y-auto min-h-0">
    <div class="max-w-3xl mx-auto px-4 py-3 space-y-3">
      {#if messages.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
          <p class="text-sm text-gray-400">选择模型后开始对话</p>
          <p class="text-xs mt-0.5 text-gray-300">支持粘贴或拖拽图片</p>
        </div>
      {:else}
        {#each messages as msg}
          <div class="flex gap-2 {msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150">
            {#if msg.role === 'assistant'}
              <div class="shrink-0 w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center mt-1.5">
                <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 6 0 00-2-2H6a2 6 0 00-2 2v10a2 6 0 002 2z"/></svg>
              </div>
            {/if}
            <div class="max-w-[85%] {msg.role === 'user'
              ? 'bg-indigo-600 text-white rounded-xl rounded-br-sm'
              : 'bg-white text-gray-800 rounded-xl rounded-bl-sm shadow-sm border border-gray-100/60'}"
            >
              {#if msg.images && msg.images.length > 0}
                <div class="flex flex-wrap gap-1 p-1.5">
                  {#each msg.images as img}
                    <img src={img} alt="" class="max-w-[180px] max-h-[140px] rounded-lg object-cover {msg.role === 'user' ? 'border border-white/20' : 'border border-gray-100'}" />
                  {/each}
                </div>
              {/if}
              {#if msg.role === 'assistant' && msg.loading && !msg.content}
                <div class="flex gap-1 px-3 py-2">
                  <span class="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                  <span class="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 160ms"></span>
                  <span class="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 320ms"></span>
                </div>
              {:else if msg.error}
                <p class="text-red-400 text-xs py-2 px-3">{msg.error}</p>
              {:else}
                <div class="px-3 py-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{msg.content}</div>
                {#if msg.role === 'assistant' && msg.loading}
                  <span class="inline-block w-1 h-3.5 bg-indigo-500 ml-0.5 align-middle animate-pulse rounded-full"></span>
                {/if}
              {/if}
            </div>
          </div>
        {/each}
        <div bind:this={chatEndEl}></div>
      {/if}
    </div>
  </div>

  <!-- ===== 输入区（固定高度，不抖动） ===== -->
  <div class="shrink-0 bg-white border-t border-gray-200">
    <div class="max-w-3xl mx-auto px-3 py-1.5">
      <div class="rounded-xl border border-gray-200 shadow-xs focus-within:border-indigo-400 focus-within:shadow-sm focus-within:shadow-indigo-100/40 transition-all overflow-visible">

        <!-- 输入行 -->
        <div class="flex items-end gap-1.5 px-2 py-1.5">
          <!-- 图片预览（固定占位） -->
          <div class="shrink-0 flex gap-1 self-end">
            {#if pendingImages.length > 0}
              {#each pendingImages.slice(0, 4) as img, idx}
                <div class="relative group">
                  <img src={img} alt="" class="w-8 h-8 rounded-md object-cover border border-indigo-200" />
                  <button type="button" onclick={() => removeImage(idx)} class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-700/80 backdrop-blur-sm text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all cursor-pointer">&times;</button>
                </div>
              {/each}
              {#if pendingImages.length > 4}
                <div class="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[9px] font-medium text-indigo-600">+{pendingImages.length - 4}</div>
              {/if}
              {#if pendingImages.length < 10}
                <div class="w-8 h-8 rounded-md border border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer transition-colors" onclick={() => triggerImageInput()}><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg></div>
              {/if}
            {:else}
              <div class="w-8 h-8 rounded-md border border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer transition-colors" onclick={() => triggerImageInput()} title="添加图片">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 6 0 00-2-2H6a2 6 0 00-2 2v12a2 6 0 002 2z"/></svg>
              </div>
            {/if}
          </div>

          <!-- 输入框 -->
          <textarea bind:value={inputText} onkeydown={handleKeydown} placeholder="{selectedModel ? '输入消息…' : '先选择模型'}" rows="1" disabled={sending || !selectedConfigId || !selectedModel} class="flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] leading-relaxed text-gray-800 placeholder:text-gray-400 disabled:text-gray-300 focus:outline-none max-h-[100px] min-h-[34px]"></textarea>

          <!-- 操作按钮 -->
          <div class="flex gap-1 shrink-0 items-end pb-0.5">
            <button type="button" onclick={() => triggerImageInput()} disabled={sending || !selectedConfigId || !selectedModel} class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-350 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="添加图片">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 6 0 00-2-2H6a2 6 0 00-2 2v12a2 6 0 002 2z"/></svg>
            </button>
            <button onclick={sendMessage} disabled={sending || (!inputText.trim() && pendingImages.length === 0) || !selectedConfigId || !selectedModel} class="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm" title="发送">
              {#if sending}<svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>{:else}<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L20 7"/></svg>{/if}
            </button>
          </div>
        </div>

        <!-- 底部栏（固定高度，常驻，不抖动） -->
        <div class="border-t border-gray-100/80 px-2 py-1 flex items-center gap-2">
          <!-- 模型选择框（常驻） -->
          <div class="flex-1 relative min-w-0" onclick={(e) => e.stopPropagation()}>
            <div class="flex items-center gap-1">
              <input bind:value={selectedModel} type="text" placeholder="选择或输入模型 ID" onclick={toggleModelDropdown} class="flex-1 min-w-0 px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white font-mono hover:border-gray-300 focus:border-indigo-400 focus:outline-none transition-colors placeholder:text-gray-300" />
              {#if modelOptions.length > 0}
                <button type="button" onclick={toggleModelDropdown} class="shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                  <svg class="w-3 h-3 {modelDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
              {/if}
            </div>
            <!-- 模型下拉：向上弹出，防溢出屏幕 -->
            {#if modelDropdownOpen}
              <div class="absolute left-0 right-0 bottom-full mb-0.5 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-0.5">
                {#each modelOptions as m}
                  <button type="button" onclick={() => onModelSelect(m)} class="w-full text-left px-2 py-0.5 text-[11px] hover:bg-indigo-50 transition-colors font-mono truncate {m === selectedModel ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-600'}">{m}</button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- API 格式 -->
          <select value={apiType} onchange={(e) => onApiTypeChange((e.target as HTMLSelectElement).value)} class="shrink-0 text-[11px] border border-gray-200 rounded-md px-1.5 py-1 bg-white hover:border-gray-300 focus:outline-none focus:border-indigo-300 transition-colors text-gray-600">
            {#each API_TYPE_OPTIONS as t}<option value={t.value}>{t.label}</option>{/each}
          </select>

          <!-- 来源 + 清空 -->
          <div class="shrink-0 flex items-center gap-1.5 text-[10px] text-gray-400 pl-1 border-l border-gray-200">
            <div class="relative" onclick={(e) => e.stopPropagation()}>
              <button type="button" onclick={() => (sourcePopoverOpen = !sourcePopoverOpen)} class="hover:text-indigo-600 transition-colors max-w-[120px] truncate" title={currentSource?.endpoint || '切换来源'}>
                {currentSource ? currentSource.endpoint.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : '无来源'}
              </button>
              {#if sourcePopoverOpen}
                <div class="absolute right-0 bottom-full mb-0.5 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto z-50 py-0.5 min-w-[180px]">
                  {#each displaySources as src}
                    <button type="button" onclick={() => { onConfigChange(src.config_id); sourcePopoverOpen = false; }} class="w-full text-left px-2 py-1 text-[10px] truncate transition-colors {src.config_id === selectedConfigId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}" title={src.endpoint}>
                      <span class="inline-block w-1 h-1 rounded-full mr-1 align-middle {src.disabled ? 'bg-red-300' : src.available_models.length > 0 ? 'bg-emerald-400' : 'bg-gray-300'}"></span>
                      {src.endpoint.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            {#if messages.length > 0}
              <span class="text-gray-200">|</span>
              <button type="button" onclick={clearMessages} class="hover:text-red-500 transition-colors">清空</button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
