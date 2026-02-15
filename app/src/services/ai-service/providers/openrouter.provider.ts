import OpenAI from 'openai';
import { AiProvider, Message } from '../ai-provider.interface';
import { LoadConfig } from '../../config/config';
import { ChatCompletionMessageParam } from 'openai/resources/index';


export class OpenRouterProvider implements AiProvider {
    private client: OpenAI;

    constructor(private config: LoadConfig) {
        this.client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: this.config.OPEN_AI_API_KEY,
        });
    }

    async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const model = this.config.MODELS_CONFIG[modelKey]?.key_api || this.config.MODELS_CONFIG.glm_4_5_air.key_api;
            if (!model) throw new Error("Модель не найдена");

            const response = await this.client.chat.completions.create({
                model,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    name: m.name,
                })) as ChatCompletionMessageParam[],
            });

            return response.choices[0]?.message?.content || "Ответ не пришел";
        } catch (error: any) {
            console.error('Ошибка при обращении к OpenRouter', `${error.code}: ${error.message}`);
            return error.message;
        }
    }
}