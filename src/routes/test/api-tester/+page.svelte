<script lang="ts">
  type ApiType = 'openai' | 'gemini' | 'claude';

  let apiType = $state<ApiType>('openai');
  let endpoint = $state('https://api.openai.com');
  let apiKey = $state('');
  let model = $state('gpt-3.5-turbo');
  let availableModels = $state<string[]>([]);
  let prompt = $state('Hello, who are you?');
  let loading = $state(false);
  let fetchingModels = $state(false);
  let isStreaming = $state(true);
  let result = $state<any>(null);
  let streamingText = $state('');
  let error = $state<string | null>(null);
  import { showMessage } from '$lib/stores/messageStore';

  const apiTypes = [
    { label: 'OpenAI (Compatible)', value: 'openai' },
    { label: 'Google Gemini', value: 'gemini' },
    { label: 'Anthropic Claude', value: 'claude' },
  ];

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

  const fetchModels = async () => {
    fetchingModels = true;
    error = null;
    try {
      let url = endpoint;
      let headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}` };
      
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
        if (data.models) availableModels = data.models.map((m: any) => m.name.replace('models/', ''));
      } else if (apiType === 'claude') {
        availableModels = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2.1'];
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
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any = {};

      if (apiType === 'openai') {
        url = url.endsWith('/') ? url + 'v1/chat/completions' : url + '/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          stream: isStreaming,
        };
      } else if (apiType === 'gemini') {
        url = url.endsWith('/') ? url : url + '/';
        const method = isStreaming ? 'streamGenerateContent' : 'generateContent';
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
        throw new Error(data.error?.message || data.error || JSON.stringify(data));
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
            const lines = chunkValue.split('\n').filter(line => line.trim() !== '');
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
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                streamingText += content;
              }
            } catch (e) {
               if (chunkValue.includes('"text":')) {
                  const match = chunkValue.match(/"text":\s*"([^"]+)"/);
                  if (match) streamingText += match[1].replace(/\\n/g, '\n');
               }
            }
          } else if (apiType === 'claude') {
            const lines = chunkValue.split('\n').filter(line => line.trim() !== '');
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
    const textToCopy = isStreaming ? streamingText : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(textToCopy);
    showMessage('Copied to clipboard!');
  };
</script>

<div class="api-tester-container">
  <div class="header-section">
    <h1>LLM API Tester</h1>
    <p class="subtitle">Quickly verify if your AI API keys and endpoints are working.</p>
  </div>

  <div class="main-layout">
    <!-- Left Column: Configuration -->
    <div class="config-column">
      <div class="card">
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
            <input 
              type="checkbox" 
              bind:checked={isStreaming} 
            />
            <span class="toggle-label">Enable Streaming</span>
          </label>
        </div>

        <div class="form-group">
          <label for="prompt">Test Prompt</label>
          <textarea
            id="prompt"
            bind:value={prompt}
            rows={3}
          ></textarea>
        </div>

        <button class="test-btn" onclick={testApi} disabled={loading}>
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
      </div>
    </div>

    <!-- Right Column: Results -->
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
            <button class="copy-btn" onclick={copyResult} disabled={!streamingText && !result}>Copy Output</button>
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
          <p>Configure the API and click "Test Connection" to see the response here.</p>
        </div>
      {/if}
    </div>
  </div>

  <footer class="footer">
    <p>Supported: OpenAI, Google Gemini, Anthropic Claude</p>
  </footer>
</div>

<style>
  .api-tester-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem 1.5rem;
    height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    color: #eee;
  }

  .header-section {
    flex-shrink: 0;
    margin-bottom: 1rem;
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  .header-section h1 {
    margin: 0;
    color: #646cff;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .subtitle {
    color: #666;
    margin: 0;
    font-size: 0.85rem;
  }

  .main-layout {
    display: grid;
    grid-template-columns: 420px 1fr;
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
    background-color: #161616;
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    border: 1px solid #222;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto; /* Restore scrolling for the card content */
  }

  /* Scrollbar for card */
  .card::-webkit-scrollbar {
    width: 6px;
  }
  .card::-webkit-scrollbar-track {
    background: transparent;
  }
  .card::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 3px;
  }

  .form-group {
    margin-bottom: 0.85rem;
    flex-shrink: 0; /* Prevent form groups from shrinking */
  }

  .form-group label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: 600;
    font-size: 0.8rem;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tabs {
    display: flex;
    gap: 2px;
    background: #000;
    padding: 3px;
    border-radius: 6px;
    border: 1px solid #222;
  }

  .tabs button {
    flex: 1;
    background: transparent;
    border: none;
    padding: 0.4rem;
    color: #777;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tabs button.active {
    background: #646cff;
    color: white;
  }

  input:not([type="checkbox"]), textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 6px;
    color: #eee;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 0.9rem;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: #646cff;
  }

  .model-input-group {
    display: flex;
    gap: 0.4rem;
  }

  .fetch-btn {
    background: #222;
    border: 1px solid #333;
    color: #999;
    padding: 0 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.7rem;
  }

  .fetch-btn:hover:not(:disabled) {
    background: #333;
    color: white;
  }

  .toggle-group {
    margin-top: 0.25rem;
    padding: 0.5rem;
    background: #0a0a0a;
    border-radius: 6px;
    border: 1px solid #222;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
    color: #888;
  }

  .toggle input[type="checkbox"] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0;
    cursor: pointer;
    flex-shrink: 0;
  }

  .test-btn {
    width: 100%;
    padding: 0.8rem;
    background-color: #646cff;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem; /* Better spacing for auto-bottom */
    flex-shrink: 0;
  }

  .test-btn:hover:not(:disabled) {
    background-color: #535bf2;
  }

  .result-column {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: #080808;
    border-radius: 10px;
    border: 1px solid #222;
    padding: 1.25rem;
    box-sizing: border-box;
  }

  .result-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #1a1a1a;
  }

  .result-header h3 {
    margin: 0;
    color: #646cff;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .preview-text {
    background: #000;
    padding: 1rem;
    border-radius: 6px;
    white-space: pre-wrap;
    font-family: 'Fira Code', monospace;
    font-size: 0.95rem;
    line-height: 1.5;
    flex: 1;
    color: #4ade80;
    overflow-y: auto;
    border: 1px solid #111;
  }

  .copy-btn {
    background: #1a1a1a;
    color: #aaa;
    border: 1px solid #333;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .error-box {
    background-color: #2c1a1a;
    border: 1px solid #4a1a1a;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .error-box h3 { margin: 0 0 0.5rem 0; color: #f87171; font-size: 0.9rem; }
  .error-box pre { white-space: pre-wrap; word-break: break-all; color: #fecaca; font-size: 0.85rem; margin: 0; }

  .raw-json {
    background: #050505;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    margin: 0.5rem 0 0 0;
    color: #52525b;
    border: 1px solid #111;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
    font-style: italic;
  }

  details { margin-top: 1rem; }
  summary { cursor: pointer; color: #444; font-size: 0.8rem; }

  .footer {
    margin-top: 1rem;
    text-align: center;
    color: #333;
    font-size: 0.8rem;
    padding-top: 0.75rem;
    border-top: 1px solid #111;
  }

  @media (max-width: 1024px) {
    .main-layout { grid-template-columns: 1fr; }
    .api-tester-container { height: auto; overflow: visible; }
    .card { height: auto; overflow: visible; }
  }
</style>
