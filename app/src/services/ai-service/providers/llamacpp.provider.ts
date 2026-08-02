
import { LoadConfig } from '../../config/config';
import { AiProvider, Message } from '../ai-provider.interface';

export class LlamaCppProvider implements AiProvider {
  constructor(private config: LoadConfig) {}

  private formatPrompt(messages: Message[], jsonMode = false): string {
    const jsonInstr = jsonMode
      ? '\n\nCRITICAL: Respond ONLY with valid JSON. No text before or after.'
      : '';
    return messages
      .map(m => {
        if (m.role === 'system') return `System: ${m.content}${jsonInstr}`;
        return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
      })
      .join('\n') + '\nAssistant:';
  }

  async *askStream(messages: Message[], userId: number, modelKey: string): AsyncGenerator<string> {
    const modelConfig = this.config.MODELS_CONFIG[modelKey];
    const apiUrl = modelConfig?.api_url || this.config.MODEL_DEFAULT.api_url;
    const prompt = this.formatPrompt(messages, true);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stream: true, n_predict: 512, temperature: 0.1 }),
    });

    if (!res.ok) throw new Error(`Llama.cpp error: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n').filter(Boolean)) {
        try { const data = JSON.parse(line); if (data.content) yield data.content; } catch {}
      }
    }
  }

  async askJson<T>(messages: Message[], userId: number, modelKey: string, schema?: string): Promise<T> {
    const jsonInstr = schema
      ? `\n\nRespond ONLY with JSON matching this schema:\n${schema}`
      : '\n\nRespond ONLY with valid JSON. No text outside JSON.';

    const enhancedMessages = messages.map(m => {
      if (m.role === 'system') return { ...m, content: `${m.content}${jsonInstr}` };
      return m;
    });

    const prompt = this.formatPrompt(enhancedMessages, true);
    const apiUrl = this.config.MODELS_CONFIG[modelKey]?.api_url || this.config.MODEL_DEFAULT.api_url;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, n_predict: 1024, stream: false, temperature: 0.1 }),
    });

    const data = (await res.json()) as { content: string };
    const rawText = data.content || '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON not found in response');

    return JSON.parse(jsonMatch[0]) as T;
  }

  async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
    try {
      const prompt = this.formatPrompt(messages);
      const apiUrl = this.config.MODELS_CONFIG[modelKey]?.api_url || this.config.MODEL_DEFAULT.api_url;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, n_predict: 512, stream: false, temperature: 0.2 }),
      });

      const data = (await res.json()) as { content: string };
      return data.content || 'No response from Llama.cpp';
    } catch (error) {
      console.error('Llama.cpp error:', error);
      return this.config.ERROR_MODEL_MESSAGE;
    }
  }
}
