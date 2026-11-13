import { AiProvider, Message } from '../ai-provider.interface';
import { AIModel, LoadConfig, PROVIDER_BASE_URLS } from '../../config/config';

/**
 * Нативный endpoint Ollama. Только он понимает параметр `think`: OpenAI-совместимый
 * `/v1/chat/completions` его игнорирует, и thinking-модель (qwen3 и подобные) тратит
 * 50+ секунд на ответ в три строки, потому что весь бюджет уходит в рассуждение.
 */
const NATIVE_CHAT_URL = PROVIDER_BASE_URLS['ollama'].replace(/\/v1\/?$/, '') + '/api/chat';

type OllamaChatResponse = {
    message?: { role?: string; content?: string; thinking?: string };
    done?: boolean;
    eval_count?: number;
    eval_duration?: number;
};

function extractFirstJson(text: string): any {
  try {
    const start = text.indexOf('{');
    if (start === -1) return { type: 'final', answer: 'Пустой ответ модели' };
    let depth = 0, inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') { i++; continue; }
        if (ch === '"') inString = false; continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch { return { type: 'final', answer: 'Ошибка парсинга JSON' }; }
        }
      }
    }
    return { type: 'final', answer: 'JSON не найден в ответе модели' };
  } catch { return { type: 'final', answer: 'Ошибка в extractFirstJson' }; }
}

export class OllamaProvider implements AiProvider {
    constructor(private config: LoadConfig) {}

    private modelConfig(modelKey: string): AIModel {
        const cfg = this.config.MODELS_CONFIG[modelKey];
        if (!cfg?.key_api) throw new Error('Model not found');
        return cfg;
    }

    /**
     * Общая часть запроса. `think` по умолчанию выключен: для диалога рассуждение даёт
     * десятикратную задержку без выигрыша в ответе. Включается полем `think: true`
     * у модели в MODELS_CONFIG — для задач, где рассуждение действительно нужно.
     */
    private payload(modelKey: string, messages: Message[], extra: Record<string, unknown>) {
        const cfg = this.modelConfig(modelKey);
        return {
            model: cfg.key_api as string,
            messages: messages.map(m => ({
                role: m.role === 'developer' ? 'system' : m.role,
                content: m.content,
            })),
            think: cfg.think ?? false,
            options: { temperature: 0.1 },
            ...extra,
        };
    }

    private async post(payload: Record<string, unknown>): Promise<Response> {
        const res = await fetch(NATIVE_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
        }
        return res;
    }

    async *askStream(messages: Message[], _userId: number, modelKey: string): AsyncGenerator<string> {
        const res = await this.post({ ...this.payload(modelKey, messages, {}), stream: true });
        const reader = res.body?.getReader();
        if (!reader) throw new Error('Ollama: пустой поток ответа');

        const decoder = new TextDecoder();
        let buffer = '';
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // ответ приходит NDJSON: один объект на строку
                let nl: number;
                while ((nl = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, nl).trim();
                    buffer = buffer.slice(nl + 1);
                    if (!line) continue;
                    let chunk: OllamaChatResponse;
                    try { chunk = JSON.parse(line); } catch { continue; }
                    if (chunk.message?.content) yield chunk.message.content;
                    if (chunk.done) return;
                }
            }
            const tail = buffer.trim();
            if (tail) {
                const chunk = JSON.parse(tail) as OllamaChatResponse;
                if (chunk.message?.content) yield chunk.message.content;
            }
        } finally {
            reader.releaseLock?.();
        }
    }

    async askJson<T = Record<string, unknown>>(messages: Message[], _userId: number, modelKey: string, schema?: string): Promise<T> {
        try {
            const instr = schema ? '\nRespond ONLY with valid JSON matching this schema:\n' + schema : '\nRespond ONLY with valid JSON.';
            const msgs = messages.map(m => m.role === 'system' ? { ...m, content: m.content + instr } : m);
            if (!msgs.some(m => m.role === 'system')) msgs.unshift({ role: 'system', content: 'You are a JSON agent.' + instr });
            const res = await this.post({
                ...this.payload(modelKey, msgs, { format: 'json' }),
                stream: false,
            });
            const data = (await res.json()) as OllamaChatResponse;
            return extractFirstJson(data.message?.content || '{}') as T;
        } catch (e: any) {
            return { type: 'final', answer: 'Ошибка: ' + (e.message || 'неизвестная') } as T;
        }
    }

    async ask(messages: Message[], _userId: number, modelKey: string): Promise<string> {
        try {
            const res = await this.post({ ...this.payload(modelKey, messages, {}), stream: false });
            const data = (await res.json()) as OllamaChatResponse;
            return data.message?.content || 'No response';
        } catch (error: any) { console.error('ollama error:', error.message); return error.message; }
    }
}