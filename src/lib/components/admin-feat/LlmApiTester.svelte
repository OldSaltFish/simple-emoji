<script lang="ts">
  import { onMount } from 'svelte';
  import { showMessage } from '$lib/stores/messageStore';
  import { llmConfigApi, type LlmConfig } from '$lib/api/llmConfig';

  type ApiType = 'openai' | 'gemini' | 'claude';

  let configs = $state<LlmConfig[]>([]);
  let selectedConfigId = $state<number | null>(null);
  let apiType = $state<ApiType>('openai');
  let endpoint = $state('https://api.openai.com');
  let apiKey = $state('');
  let model = $state('gpt-3.5-turbo');
  let availableModels = $state<string[]>([]);
  let prompt = $state('Hello, who are you?');
  let loading = $state(false);
  let fetchingModels = $state(false);
  let saving = $state(false);
  let deleting = $state(false);
  let isStreaming = $state(true);
  let result = $state<any>(null);
  let streamingText = $state('');
  let error = $state<string | null>(null);

  const apiTypes = [
    { label: 'OpenAI (Compatible)', value: 'openai' },
    { label: 'Google Gemini', value: 'gemini' },
    { label: 'Anthropic Claude', value: 'claude' },
  ];

  const typeLabels: Record<ApiType, string> = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    claude: 'Claude',
  };

  const isEditing = $derived(selectedConfigId !== null);

  onMount(async () => {
    await loadConfigs();
  });

  const loadConfigs = async () => {
    try {
      const res = await llmConfigApi.list();
      configs = res.list || [];
      if (configs.length > 0 && !selectedConfigId) {
        selectConfig(configs[0]);
      }
    } catch {}
  };

  const selectConfig = (config: LlmConfig) => {
    selectedConfigId = config.id ?? null;
    apiType = config.api_type;
    endpoint = config.endpoint;
    apiKey = config.api_key;
    if (config.api_type === 'openai') model = 'gpt-3.5-turbo';
    else if (config.api_type === 'gemini') model = 'gemini-pro';
    else if (config.api_type === 'claude') model = 'claude-3-haiku-20240307';
  };

  const resetForm = () => {
    selectedConfigId = null;
    apiType = 'openai';
    endpoint = 'https://api.openai.com';
    apiKey = '';
    model = 'gpt-3.5-turbo';
    availableModels = [];
  };

  const handleTypeChange = (type: ApiType) => {
    apiType = type;
    availableModels = [];
    streamingText = '';
    result = null;
    if (type === 'openai') {
      endpoint = 'https://api.openai.com';
      model = 'gpt-3.5-turbo';
    } else if (type === 'gemini') {
      endpoint = 'https://generativelanguage.googleapis.com';
      model = 'gemini-pro';
    } else if (type === 'claude') {
      endpoint = 'https://api.anthropic.com';
      model = 'claude-3-haiku-20240307';
    }
  };

  const saveConfig = async () => {
    saving = true;
    try {
      const payload = { api_type: apiType, endpoint, api_key: apiKey };
      if (isEditing && selectedConfigId !== null) {
        await llmConfigApi.update(selectedConfigId, payload);
      } else {
        await llmConfigApi.create(payload);
      }
      await loadConfigs();
    } catch (err: any) {
      showMessage('保存失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      saving = false;
    }
  };

  const deleteConfig = async () => {
    if (selectedConfigId === null) return;
    deleting = true;
    try {
      await llmConfigApi.delete(selectedConfigId);
      selectedConfigId = null;
      await loadConfigs();
      if (configs.length > 0) {
        selectConfig(configs[0]);
      } else {
        resetForm();
      }
    } catch (err: any) {
      showMessage('删除失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      deleting = false;
    }
  };

  const fetchModels = async () => {
    fetchingModels = true;
    error = null;
    try {
      let url = endpoint;
      let headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
      };

      if (apiType === 'openai') {
        url = url.endsWith('/') ? url + 'v1/models' : url + '/v1/models';
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data.data) availableModels = data.data.map((m: any) => m.id);
      } else if (apiType === 'gemini') {
        url = url.endsWith('/') ? url : url + '/';
        url += `v1beta/models?key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.models)
          availableModels = data.models.map((m: any) =>
            m.name.replace('models/', ''),
          );
      } else if (apiType === 'claude') {
        availableModels = [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
          'claude-2.1',
        ];
      }
    } catch (err: any) {
      error = 'Failed to fetch models: ' + err.message;
    } finally {
      fetchingModels = false;
    }
  };

  const testApi = async () => {
    loading = true;
    result = null;
    streamingText = '';
    error = null;

    try {
      let url = endpoint;
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      let body: any = {};

      if (apiType === 'openai') {
        url = url.endsWith('/')
          ? url + 'v1/chat/completions'
          : url + '/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          stream: isStreaming,
        };
      } else if (apiType === 'gemini') {
        url = url.endsWith('/') ? url : url + '/';
        const method = isStreaming
          ? 'streamGenerateContent'
          : 'generateContent';
        url += `v1beta/models/${model}:${method}?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: prompt }] }] };
      } else if (apiType === 'claude') {
        url = url.endsWith('/') ? url + 'v1/messages' : url + '/v1/messages';
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        body = {
          model: model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
          stream: isStreaming,
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error?.message || data.error || JSON.stringify(data),
        );
      }

      if (isStreaming && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value);

          if (apiType === 'openai') {
            const lines = chunkValue
              .split('\n')
              .filter((line) => line.trim() !== '');
            for (const line of lines) {
              const message = line.replace(/^data: /, '');
              if (message === '[DONE]') break;
              try {
                const parsed = JSON.parse(message);
                const content = parsed.choices?.[0]?.delta?.content || '';
                streamingText += content;
              } catch (e) {}
            }
          } else if (apiType === 'gemini') {
            try {
              const cleanChunk = chunkValue.trim().replace(/^\[|,|\]$/g, '');
              if (cleanChunk) {
                const parsed = JSON.parse(cleanChunk);
                const content =
                  parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                streamingText += content;
              }
            } catch (e) {
              if (chunkValue.includes('"text":')) {
                const match = chunkValue.match(/"text":\s*"([^"]+)"/);
                if (match) streamingText += match[1].replace(/\\n/g, '\n');
              }
            }
          } else if (apiType === 'claude') {
            const lines = chunkValue
              .split('\n')
              .filter((line) => line.trim() !== '');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (data.type === 'content_block_delta') {
                    streamingText += data.delta.text;
                  }
                } catch (e) {}
              }
            }
          }
        }
      } else {
        const data = await response.json();
        result = data;
      }
    } catch (err: any) {
      error = err.message || 'Unknown error';
    } finally {
      loading = false;
    }
  };

  const copyResult = () => {
    const textToCopy = isStreaming
      ? streamingText
      : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(textToCopy);
    showMessage('Copied to clipboard!');
  };

  const maskKey = (key: string) => {
    if (!key || key.length <= 8) return key;
    return key.slice(0, 4) + '****' + key.slice(-4);
  };
</script>

<div class="api-tester-container">
  <div class="header-section">
    <h1>LLM API Tester</h1>
    <p class="subtitle">Quickly verify if your AI API keys and endpoints are working.</p>
  </div>

  <div class="main-layout">
    <div class="config-column">
      <div class="card">
        <div class="form-group">
          <label>Saved Configs</label>
          <div class="config-selector">
            <select
              onchange={(e) => {
                const id = Number((e.target as HTMLSelectElement).value);
                const c = configs.find((c) => c.id === id);
                if (c) selectConfig(c);
              }}
            >
              {#if configs.length === 0}
                <option value="">No saved configs</option>
              {:else}
                {#each configs as c}
                  <option value={c.id} selected={c.id === selectedConfigId}>
                    {typeLabels[c.api_type]} - {maskKey(c.api_key)}
                  </option>
                {/each}
              {/if}
            </select>
            <div class="config-actions">
              <button
                class="action-btn new-btn"
                onclick={resetForm}
                title="New config"
              >+</button>
              {#if isEditing}
                <button
                  class="action-btn delete-btn"
                  onclick={deleteConfig}
                  disabled={deleting}
                  title="Delete config"
                >🗑</button>
              {/if}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="api-format">API Format</label>
          <div class="tabs" id="api-format">
            {#each apiTypes as type}
              <button
                class:active={apiType === type.value}
                onclick={() => handleTypeChange(type.value as ApiType)}
              >
                {type.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label for="endpoint">Base Endpoint</label>
          <input
            id="endpoint"
            type="text"
            bind:value={endpoint}
            placeholder="https://api.example.com"
          />
        </div>

        <div class="form-group">
          <label for="api-key">API Key</label>
          <input
            id="api-key"
            type="password"
            bind:value={apiKey}
            placeholder="sk-..."
          />
        </div>

        <div class="form-group">
          <label for="model-name">Model Name</label>
          <div class="model-input-group">
            <input
              id="model-name"
              type="text"
              list="models-list"
              bind:value={model}
              placeholder="gpt-3.5-turbo"
            />
            <datalist id="models-list">
              {#each availableModels as m}
                <option value={m}></option>
              {/each}
            </datalist>
            <button
              class="fetch-btn"
              onclick={fetchModels}
              disabled={fetchingModels || !apiKey}
            >
              {fetchingModels ? '...' : 'Fetch'}
            </button>
          </div>
        </div>

        <div class="form-group toggle-group">
          <label class="toggle">
            <span class="toggle-label">Enable Streaming</span>
            <input type="checkbox" bind:checked={isStreaming} />
            <span class="toggle-track" class:active={isStreaming}></span>
          </label>
        </div>

        <div class="form-group">
          <label for="prompt">Test Prompt</label>
          <textarea id="prompt" bind:value={prompt} rows={3}></textarea>
        </div>

        <div class="btn-row">
          <button class="save-btn" onclick={saveConfig} disabled={saving || !apiKey}>
            {saving ? 'Saving...' : isEditing ? '💾 Update' : '💾 Save New'}
          </button>
          <button class="test-btn" onclick={testApi} disabled={loading}>
            {loading ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>
    </div>

    <div class="result-column">
      {#if error}
        <div class="error-box">
          <h3>Error</h3>
          <pre>{error}</pre>
          <p class="hint">Check endpoint URL or browser CORS restrictions.</p>
        </div>
      {/if}

      {#if result || streamingText || loading}
        <div class="result-box">
          <div class="result-header">
            <h3>Response</h3>
            <button
              class="copy-btn"
              onclick={copyResult}
              disabled={!streamingText && !result}>Copy Output</button
            >
          </div>
          <div class="response-content">
            <div class="preview-text">
              {#if isStreaming}
                {streamingText || (loading ? 'Waiting for stream...' : '')}
              {:else if result}
                {#if apiType === 'openai'}
                  {result.choices?.[0]?.message?.content}
                {:else if apiType === 'gemini'}
                  {result.candidates?.[0]?.content?.parts?.[0]?.text}
                {:else if apiType === 'claude'}
                  {result.content?.[0]?.text}
                {/if}
              {/if}
            </div>
            {#if !isStreaming && result}
              <details open>
                <summary>Raw JSON Response</summary>
                <pre class="raw-json">{JSON.stringify(result, null, 2)}</pre>
              </details>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-state-icon">⚡</div>
          <p>Configure the API and click "Test Connection"</p>
          <p class="empty-sub">Response will appear here</p>
        </div>
      {/if}
    </div>
  </div>

  <footer class="footer">
    <p>Supported: OpenAI, Google Gemini, Anthropic Claude</p>
  </footer>
</div>

<style>
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
    50% {
      box-shadow: 0 0 16px 2px rgba(99, 102, 241, 0.2);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .api-tester-container {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      sans-serif;
    height: 100%;
  }

  .header-section {
    flex-shrink: 0;
    margin-bottom: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-section h1 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .subtitle {
    color: #94a3b8;
    margin: 0;
    font-size: 0.85rem;
    font-weight: 400;
  }

  .main-layout {
    display: grid;
    grid-template-columns: 440px 1fr;
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
  }

  .config-column {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .card {
    background: #ffffff;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.06),
      0 4px 16px rgba(0, 0, 0, 0.04);
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .card::-webkit-scrollbar {
    width: 5px;
  }
  .card::-webkit-scrollbar-track {
    background: transparent;
  }
  .card::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  .card::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .form-group {
    margin-bottom: 1rem;
    flex-shrink: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.45rem;
    font-weight: 600;
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .config-selector {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .config-selector select {
    flex: 1;
    padding: 0.65rem 0.85rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #1e293b;
    font-family: inherit;
    font-size: 0.88rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    appearance: auto;
  }

  .config-selector select:hover {
    border-color: #c7d2fe;
  }

  .config-selector select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: #ffffff;
  }

  .config-actions {
    display: flex;
    gap: 0.35rem;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .new-btn:hover {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #6366f1;
  }

  .delete-btn:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .delete-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tabs {
    display: flex;
    gap: 3px;
    background: #f1f5f9;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }

  .tabs button {
    flex: 1;
    background: transparent;
    border: none;
    padding: 0.5rem 0.25rem;
    color: #64748b;
    cursor: pointer;
    border-radius: 7px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    position: relative;
  }

  .tabs button:hover:not(.active) {
    color: #334155;
    background: rgba(255, 255, 255, 0.7);
  }

  .tabs button.active {
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  input:not([type='checkbox']),
  textarea {
    width: 100%;
    padding: 0.65rem 0.85rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #1e293b;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 0.88rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  input:not([type='checkbox']):hover,
  textarea:hover {
    border-color: #c7d2fe;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: #ffffff;
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }

  .model-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .model-input-group input {
    flex: 1;
  }

  .fetch-btn {
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    color: #6366f1;
    padding: 0 1rem;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .fetch-btn:hover:not(:disabled) {
    background: #e0e7ff;
    border-color: #a5b4fc;
    color: #4f46e5;
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.1);
  }

  .fetch-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-group {
    margin-top: 0.25rem;
    padding: 0.65rem 0.85rem;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 0.85rem;
    color: #475569;
    user-select: none;
  }

  .toggle input[type='checkbox'] {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .toggle-track {
    position: relative;
    width: 40px;
    height: 22px;
    background: #cbd5e1;
    border-radius: 11px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .toggle-track.active {
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
  }

  .toggle-track.active::after {
    transform: translateX(18px);
    background: white;
  }

  .toggle-label {
    font-weight: 500;
  }

  .btn-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
    flex-shrink: 0;
  }

  .save-btn {
    padding: 0.85rem 1.25rem;
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .save-btn:hover:not(:disabled) {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #6366f1;
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .test-btn {
    flex: 1;
    padding: 0.85rem;
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    letter-spacing: 0.02em;
    position: relative;
    overflow: hidden;
  }

  .test-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.15),
      transparent
    );
    background-size: 200% 100%;
    animation: shimmer 3s infinite;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .test-btn:hover:not(:disabled)::before {
    opacity: 1;
  }

  .test-btn:hover:not(:disabled) {
    box-shadow:
      0 4px 20px rgba(99, 102, 241, 0.35),
      0 0 40px rgba(99, 102, 241, 0.08);
    transform: translateY(-1px);
  }

  .test-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.25);
  }

  .test-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    animation: pulse-glow 2s infinite;
  }

  .result-column {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    padding: 1.5rem;
    box-sizing: border-box;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.06),
      0 4px 16px rgba(0, 0, 0, 0.04);
  }

  .result-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    animation: fade-in 0.3s ease-out;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .result-header h3 {
    margin: 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .response-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .preview-text {
    background: #0f172a;
    padding: 1.15rem;
    border-radius: 12px;
    white-space: pre-wrap;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.9rem;
    line-height: 1.65;
    flex: 1;
    color: #34d399;
    overflow-y: auto;
    border: 1px solid #1e293b;
    animation: fade-in 0.3s ease-out;
  }

  .preview-text::-webkit-scrollbar {
    width: 5px;
  }
  .preview-text::-webkit-scrollbar-track {
    background: transparent;
  }
  .preview-text::-webkit-scrollbar-thumb {
    background: rgba(52, 211, 153, 0.2);
    border-radius: 10px;
  }
  .preview-text::-webkit-scrollbar-thumb:hover {
    background: rgba(52, 211, 153, 0.35);
  }

  .copy-btn {
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .copy-btn:hover:not(:disabled) {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #6366f1;
  }

  .copy-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 1.15rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    animation: fade-in 0.3s ease-out;
  }

  .error-box h3 {
    margin: 0 0 0.5rem 0;
    color: #dc2626;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .error-box pre {
    white-space: pre-wrap;
    word-break: break-all;
    color: #991b1b;
    font-size: 0.82rem;
    margin: 0;
    line-height: 1.5;
  }

  .error-box .hint {
    margin: 0.65rem 0 0 0;
    color: #94a3b8;
    font-size: 0.75rem;
    font-style: italic;
  }

  .raw-json {
    background: #f8fafc;
    padding: 1rem;
    border-radius: 10px;
    font-size: 0.78rem;
    margin: 0.75rem 0 0 0;
    color: #64748b;
    border: 1px solid #e2e8f0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    line-height: 1.6;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .empty-state-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #eef2ff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6366f1;
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  .empty-state p {
    color: #64748b;
    font-size: 0.88rem;
    margin: 0;
  }

  .empty-state .empty-sub {
    color: #94a3b8;
    font-size: 0.78rem;
  }

  details {
    margin-top: 0.75rem;
  }

  summary {
    cursor: pointer;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 500;
    padding: 0.35rem 0;
    transition: color 0.2s;
    user-select: none;
  }

  summary:hover {
    color: #334155;
  }

  .footer {
    margin-top: 1.25rem;
    text-align: center;
    color: #94a3b8;
    font-size: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
    letter-spacing: 0.02em;
  }

  @media (max-width: 1024px) {
    .main-layout {
      grid-template-columns: 1fr;
    }
    .api-tester-container {
      overflow: visible;
    }
    .result-column {
      min-height: 400px;
    }
  }
</style>
