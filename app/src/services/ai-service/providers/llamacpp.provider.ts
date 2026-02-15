import { LoadConfig } from "services/config/config";
import { AiProvider, Message } from "../ai-provider.interface";
import { EmbeddingService } from "../embedding-service";


export class LlamaCppProvider implements AiProvider {
    constructor(private config: LoadConfig) { }

    private formatHistory(messages: Message[]): string {
        return messages
            .map(m => {
                if (m.role === 'system') return `Инструкция: ${m.content}`;
                return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
            })
            .join('\n') + '\nAssistant:';
    }

    async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const prompt = this.formatHistory(messages);
            const api_url = this.config.MODELS_CONFIG[modelKey]?.api_url || this.config.MODEL_DEFAULT.api_url;

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
            return data.content || "Нет ответа от Llama.cpp";
        } catch (error) {
            console.error('Ошибка при обращении к Llama.cpp:', error);
            return this.config.ERROR_MODEL_MESSAGE;
        }
    }
}