import OpenAI from 'openai';
import { AiProvider, Message } from '../ai-provider.interface';
import { LoadConfig, PROVIDER_BASE_URLS } from '../../config/config';
import { ChatCompletionMessageParam } from 'openai/resources/index';

export class OllamaProvider implements AiProvider {
    private client: OpenAI;
    constructor(private config: LoadConfig) {
        this.client = new OpenAI({
            baseURL: PROVIDER_BASE_URLS['ollama'],
            apiKey: 'ollama',
        });
    }

    async *askStream(messages: Message[], userId: number, modelKey: string): AsyncGenerator<string> {
        const model = this.config.MODELS_CONFIG[modelKey]?.key_api;
        if (!model) throw new Error("Model not found");
        const stream = await this.client.chat.completions.create({
            model, stream: true, temperature: 0.1,
            messages: messages.map(m => ({ role: m.role as ChatCompletionMessageParam["role"], content: m.content })) as ChatCompletionMessageParam[],
        });
        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) yield delta;
        }
    }

    async askJson<T>(messages: Message[], userId: number, modelKey: string, schema?: string): Promise<T> {
        const model = this.config.MODELS_CONFIG[modelKey]?.key_api;
        if (!model) throw new Error("Model not found");
        const instr = schema ? '\nRespond ONLY with valid JSON matching this schema:\n' + schema : '\nRespond ONLY with valid JSON.';
        const msgs = messages.map(m => m.role === 'system' ? { ...m, content: m.content + instr } : m);
        if (!msgs.some(m => m.role === 'system')) msgs.unshift({ role: 'system', content: 'You are a JSON agent.' + instr });
        const response = await this.client.chat.completions.create({
            model, temperature: 0.1,
            response_format: { type: 'json_object' } as const,
            messages: msgs.map(m => ({ role: m.role as ChatCompletionMessageParam["role"], content: m.content })) as ChatCompletionMessageParam[],
        });
        return JSON.parse(response.choices[0]?.message?.content || '{}') as T;
    }

    async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const model = this.config.MODELS_CONFIG[modelKey]?.key_api;
            if (!model) throw new Error("Model not found");
            const response = await this.client.chat.completions.create({
                model,
                messages: messages.map(m => ({ role: m.role as ChatCompletionMessageParam["role"], content: m.content })) as ChatCompletionMessageParam[],
            });
            return response.choices[0]?.message?.content || "No response";
        } catch (error: any) {
            console.error('ollama error:', error.message);
            return error.message;
        }
    }
}
