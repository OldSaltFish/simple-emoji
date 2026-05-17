import { config } from '$lib/config/env';

export interface ChatModelSource {
  config_id: number;
  endpoint: string;
  api_key: string;
  api_type: string;
  key_note: string;
  endpoint_group: string;
  group: string;
  available_models: string[];
  unavailable_models: string[];
  disabled?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CUSTOM_MODELS_KEY = 'llm-chat-custom-models';

function loadCustomModels(): Record<number, string[]> {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomModel(configId: number, model: string) {
  const map = loadCustomModels();
  if (!map[configId]) map[configId] = [];
  if (!map[configId].includes(model)) {
    map[configId].push(model);
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(map));
  }
}

export function getCustomModels(configId: number): string[] {
  return loadCustomModels()[configId] || [];
}

class LlmChatApi {
  private base = '/llm-chat';

  async getAvailableModels(): Promise<ChatModelSource[]> {
    const res = await fetch(`${config.apiBaseUrl}${this.base}/available-models`);
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.msg);
    return json.data || [];
  }

  async *streamChat(
    configId: number,
    model: string,
    messages: ChatMessage[],
    sources: ChatModelSource[],
    overrideApiType?: 'openai' | 'claude',
  ): AsyncGenerator<string, void> {
    const src = sources.find((s) => s.config_id === configId);
    if (!src) throw new Error(`配置 ${configId} 不存在`);

    saveCustomModel(configId, model);

    const apiType = (overrideApiType || src.api_type || 'openai').toLowerCase();

    if (apiType === 'claude' || apiType === 'anthropic') {
      yield* this.streamClaude(src, model, messages);
    } else {
      yield* this.streamOpenAI(src, model, messages);
    }
  }

  private async *streamOpenAI(
    src: ChatModelSource,
    model: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string, void> {
    const url = `${src.endpoint}/v1/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${src.api_key}`,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`请求失败 (${resp.status}): ${errText.slice(0, 300)}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error));
          yield data;
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }

  private async *streamClaude(
    src: ChatModelSource,
    model: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string, void> {
    const url = `${src.endpoint}/v1/messages`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': src.api_key,
      'anthropic-version': '2023-06-01',
    };

    const claudeMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`请求失败 (${resp.status}): ${errText.slice(0, 300)}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'error') throw new Error(parsed.error?.message || JSON.stringify(parsed.error));

          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
            yield JSON.stringify({
              choices: [{ delta: { content: parsed.delta.text }, index: 0 }],
            });
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }
}

export const llmChatApi = new LlmChatApi();