import { LoadConfig } from "services/config/config";
import { AiProvider, Message } from "../ai-provider.interface";
import { EmbeddingService } from "../embedding-service";


export class OllamaProvider implements AiProvider {
    constructor(private config: LoadConfig) { }

    async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const model = this.config.MODELS_CONFIG[modelKey].key_api;
            const body = JSON.stringify({
                model,
                messages: messages.map(m => ({ role: m.role, content: m.content, name: m.name })),
                stream: false,
                options: { temperature: 0.2, num_predict: 64 }
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

            if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

            const data = await res.json();
            return data?.message?.content || "модель не прислала ответ";
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('Request to Ollama timed out');
            } else {
                console.error('Ошибка при обращении к Ollama:', error.message);
            }
            return "Ошибка при обращении к Ollama";
        }
    }
}