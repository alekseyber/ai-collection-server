import { LoadConfig } from '../../config/config';
import { AiProvider, Message } from '../ai-provider.interface';

/**
 * Провайдер для любого OpenAI-совместимого сервера, у которого свой адрес в конфиге.
 *
 * Зачем отдельный класс: LlamaCppProvider шлёт legacy {prompt, n_predict} на /completion
 * и всегда добавляет JSON-инструкцию, а OllamaProvider игнорирует api_url и ходит
 * в нативный /api/chat по адресу из PROVIDER_BASE_URLS. Для локальных chat-моделей
 * (llama-server, vLLM, LM Studio) нужен честный /v1/chat/completions с messages.
 */
export class OpenAICompatProvider implements AiProvider {
  constructor(private config: LoadConfig) {}

  private buildBody(messages: Message[], modelKey: string, stream: boolean) {
    const cfg = this.config.MODELS_CONFIG[modelKey];
    // Системная инструкция модели важнее общего стартового промпта бота:
    // для LoRA-модели стиля это «перепиши в моей манере», а не «ты полезный ассистент».
    const sys = (cfg as unknown as { system_prompt?: string })?.system_prompt;
    const msgs = sys
      ? [{ role: 'system', content: sys }, ...messages.filter(m => m.role !== 'system')]
      : messages.filter(m => m.role !== 'tool' && m.role !== 'function');
    return {
      model: cfg?.key_api || modelKey,
      messages: msgs.map(m => ({ role: m.role, content: m.content })),
      stream,
      temperature: 0.7,
      max_tokens: 512,
    };
  }

  /** Ключ провайдера: имя поля конфига задаётся в модели (api_key_env). */
  private authHeader(modelKey: string): Record<string, string> {
    const cfg = this.config.MODELS_CONFIG[modelKey] as unknown as { api_key_env?: string };
    const name = cfg?.api_key_env;
    const key = (name ? (this.config as unknown as Record<string, string>)[name] : '') ||
      (name ? process.env[name] : '') ||
      process.env.STYLE_API_KEY ||
      '';
    return key ? { Authorization: `Bearer ${key}` } : {};
  }

  private url(modelKey: string): string {
    return this.config.MODELS_CONFIG[modelKey]?.api_url || this.config.MODEL_DEFAULT.api_url;
  }

  async ask(messages: Message[], _userId: number, modelKey: string): Promise<string> {
    const res = await fetch(this.url(modelKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Ключ: либо api_key_env модели (облако), либо STYLE_API_KEY (локальный стенд)
        ...this.authHeader(modelKey),
      },
      body: JSON.stringify(this.buildBody(messages, modelKey, false)),
    });
    if (!res.ok) throw new Error(`OpenAI-compat error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content || '';
  }

  async *askStream(messages: Message[], _userId: number, modelKey: string): AsyncGenerator<string> {
    const res = await fetch(this.url(modelKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeader(modelKey),
      },
      body: JSON.stringify(this.buildBody(messages, modelKey, true)),
    });
    if (!res.ok) throw new Error(`OpenAI-compat error: ${res.status} ${await res.text()}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const chunk = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
          const piece = chunk.choices?.[0]?.delta?.content;
          if (piece) yield piece;
        } catch {
          // неполный JSON в потоке — пропускаем, следующая итерация дополнит буфер
        }
      }
    }
  }

  async askJson<T>(messages: Message[], userId: number, modelKey: string): Promise<T> {
    const text = await this.ask(messages, userId, modelKey);
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('JSON не найден в ответе модели');
    return JSON.parse(text.slice(start, end + 1)) as T;
  }
}
