import OpenAI from 'openai';
import { ModelsGroupe } from './config/config';
import type { LoadConfig } from './config/config';
import { LlmDeepseekAgent } from './llm-deepseek-agent';
import { EmbeddingService } from './embedding-service';

export type RoleAiMessage = "function" | "developer" | "system" | "user" | "assistant" | "tool";

export interface ToolCalls {
    index: number;
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    }
}
export interface Message {
    role: RoleAiMessage;
    content: string;
    name?: string;
    tool_calls?: ToolCalls[];
    reasoning_content?: string;
}

export class AIService {
    private config: LoadConfig;
    private clientOpenRuter: OpenAI;
    private llmDeepseekAgent: LlmDeepseekAgent;

    private start() {
        this.llmDeepseekAgent = new LlmDeepseekAgent(this.config, new EmbeddingService(this.config, this));
    }

    constructor(config: LoadConfig) {
        this.config = config;
        this.clientOpenRuter = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: this.config.OPEN_AI_API_KEY,
        });

        this.start();
    }

    private formatMessagesFromOpenAi(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        return messages.map((message) => ({
            role: message.role,
            content: message.content,
            name: message.name,
        })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    }

    private async askOpenAi(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const model = this.config.MODELS_CONFIG[modelKey].key_api || this.config.MODELS_CONFIG.glm_4_5_air.key_api;
            if (!model) {
                throw new Error("Модель не найдена");
            }
            const completion = await this.clientOpenRuter.chat.completions.create({
                model,
                messages: this.formatMessagesFromOpenAi(messages),
            });
            return completion.choices[0].message?.content || "Ответ не пришел";
        } catch (error: any) {
            console.error('Ошибка при обращении к OpenAi', `${error.code}: ${error.message}`);
            return error.message;
        }
    }

    private async askOllama(history: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const model = this.config.MODELS_CONFIG[modelKey].key_api;
            const body = JSON.stringify({
                model,
                messages: this.formatMessagesFromOpenAi(history),
                stream: false,
                options: {
                    temperature: 0.2,
                    num_predict: 64
                },
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 159000);

            const res = await fetch("http://ollama:11434/api/chat", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await res.json();

            return data?.message?.content || "модель не прислала ответ";
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('Request timed out');
            } else {
                console.error('Ошибка при обращении к Ollama:', error.message);
            }
        }
    }
    public async preparationOllama(contentOut: string, promt: string) {
        try {
            const content = `
                                ${promt}
                                ${contentOut}
                            `.trim();
            return await this.askOllama([{
                role: "assistant",
                content,

            }], 0, "preparation_ollama");
        } catch (error: any) {
            throw error;
        }
    }

    public async askOllamaEmbeddings(input: string[]): Promise<number[][]> {
        try {
            const model = this.config.MODELS_CONFIG.embeddings_ollama.key_api;
            const body = JSON.stringify({
                model,
                input: input,
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 159000);

            const res = await fetch("http://ollama:11434/api/embed", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await res.json();

            if (Array.isArray(data.embeddings)) {
                return data.embeddings;       // массив векторов
            }
            if (Array.isArray(data.embedding)) {
                return [data.embedding];      // запасной случай для одиночного вектора
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('Request timed out');
            } else {
                console.error('Ошибка при обращении к Ollama:', error.message);
            }
        }
    }

    private async askLlamacpp(history: Message[] | string, userId: number, model: string): Promise<string> {
        try {
            const prompt = Array.isArray(history) ? this.formatHistoryLlamacpp(history) : history;
            const api_url = this.config.MODELS_CONFIG?.[model]?.api_url || this.config.MODEL_DEFAULT.api_url;

            const res = await fetch(api_url, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    n_predict: 512,
                    stream: false,
                    top_p: 0.7,
                    temperature: 0.2,
                    max_tokens: 512,
                })
            });

            const data = await res.json() as { content: string };
            return data.content;
        } catch (error) {
            console.error('Ошибка при обращении к Llamacpp:', error);
            return this.config.ERROR_MODEL_MESSAGE;
        }
    }

    private async askTimewebCloudAi(messages: Message[], userId: number, model: string): Promise<string> {
        try {
            return await this.llmDeepseekAgent.askTimewebCloudAi(messages, model);
        } catch (error) {
            return this.config.ERROR_MODEL_MESSAGE;
        }
    }

    public async preparationTimewebCloudAi(contentOut: string, promt: string) {
        return await this.llmDeepseekAgent.preparationTimewebCloudAi(contentOut, promt);
    }

    public async askModelRoute(userId: number, message: string, history: Message[], model: string): Promise<string> {
        try {
            const modelsGroupe = this.config.MODELS_CONFIG[model].modelsGroupe;

            switch (modelsGroupe) {
                case ModelsGroupe.OPEN_ROUTER:
                    return await this.askOpenAi(history, userId, model);

                case ModelsGroupe.LLAMA_CPP:
                    return await this.askLlamacpp(history, userId, model);

                case ModelsGroupe.OLLAMA:
                    return await this.askOllama(history, userId, model);
                case ModelsGroupe.TIMEWEB_CLOUD_AI:
                    return await this.askTimewebCloudAi(history, userId, model);

                default:
                    return this.config.ERROR_MODEL_MESSAGE;
            }
        } catch (error) {
            console.error('Ошибка при обращении', error);
            return this.config.ERROR_MODEL_MESSAGE;
        }
    }

    private formatHistoryLlamacpp(messages: Message[]): string {
        return messages
            .map(m => {
                if (m.role === 'system') return `Инструкция: ${m.content}`;
                return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
            })
            .join('\n') + '\nAssistant:';
    }
}