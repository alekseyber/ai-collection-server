import { LoadConfig } from '../../config/config';
import { AiProvider, Message } from '../ai-provider.interface';
import { LlmDeepseekAgent } from '../llm-deepseek-agent';
import { EmbeddingService } from '../embedding-service';



export class TimewebProvider implements AiProvider {
    private llmAgent: LlmDeepseekAgent;

    constructor(config: LoadConfig, embeddingService: EmbeddingService) {
        this.llmAgent = new LlmDeepseekAgent(config, embeddingService); 
    }

    async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            return await this.llmAgent.askTimewebCloudAi(messages, modelKey);
        } catch (error) {
            throw error;
        }
    }
}