import { LoadConfig } from '../config/config';
import { AiProviderFactory, Message } from './ai-provider.interface';
import { EmbeddingService } from './embedding-service';
import { ConcreteAiProviderFactory } from './providers/ai-provider.factory';
import { EmbeddingProvider } from './providers/embedding-provider';

export class AIService {
    private config: LoadConfig;
    public embeddingService: EmbeddingService;
    private providerFactory: AiProviderFactory;

    constructor(config: LoadConfig) {
        this.config = config;
        this.embeddingService = new EmbeddingService(new EmbeddingProvider(config))
        this.providerFactory = new ConcreteAiProviderFactory(config, this.embeddingService);
    }

    public async askModelRoute(
        userId: number,
        message: string,
        history: Message[],
        model: string
    ): Promise<string> {
        try {
            const modelConfig = this.config.MODELS_CONFIG[model];
            if (!modelConfig) {
                return this.config.ERROR_MODEL_MESSAGE;
            }

            const provider = this.providerFactory.createProvider(modelConfig.modelsGroupe);
            if (!provider) {
                return this.config.ERROR_MODEL_MESSAGE;
            }

            return await provider.ask(history, userId, model);
        } catch (error) {
            console.error('Ошибка при обращении к модели:', error);
            return this.config.ERROR_MODEL_MESSAGE;
        }
    }

    // // Специфичные методы остаются, но могут быть вынесены при необходимости
    // public async preparationOllama(contentOut: string, promt: string) {
    //     try {
    //         // const content = `${promt}\n${contentOut}`.trim();
    //         // const provider = new OllamaProvider(this.config);
    //         // return await provider.ask([{
    //         //     role: "assistant",
    //         //     content,
    //         // }], 0, "preparation_ollama");
    //     } catch (error: any) {
    //         throw error;
    //     }
    // }

    // public async preparationTimewebCloudAi(contentOut: string, promt: string) {
    //    // return await this.llmDeepseekAgent.preparationTimewebCloudAi(contentOut, promt);
    // }
}