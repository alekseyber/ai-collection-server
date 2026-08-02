import { LoadConfig } from '../config/config';
import { AiProviderFactory, Message } from './ai-provider.interface';
import { EmbeddingService } from './embedding-service';
import { ConcreteAiProviderFactory } from './providers/ai-provider.factory';
import { EmbeddingProvider } from './providers/embedding-provider';
import { ReActAgent } from './agents/react-agent';

export class AIService {
  private config: LoadConfig;
  public embeddingService: EmbeddingService;
  private providerFactory: AiProviderFactory;
  reactAgent: ReActAgent;  // public — доступен из handlers

  constructor(config: LoadConfig) {
    this.config = config;
    this.embeddingService = new EmbeddingService(new EmbeddingProvider(config));
    this.providerFactory = new ConcreteAiProviderFactory(config, this.embeddingService);
    this.reactAgent = new ReActAgent(config, this.embeddingService, this.providerFactory);
  }

  public async askModelRoute(
    userId: number,
    message: string,
    history: Message[],
    model: string,
  ): Promise<string> {
    try {
      const modelConfig = this.config.MODELS_CONFIG[model];
      if (!modelConfig) {
        return this.config.ERROR_MODEL_MESSAGE + ' -askModelRoute';
      }

      let fullAnswer = '';
      for await (const step of this.reactAgent.runStream(history, message, model)) {
        if (step.type === 'final') {
          fullAnswer = step.answer;
        }
      }

      return fullAnswer || 'Ответ не получен';
    } catch (error) {
      console.error('Ошибка при обращении к модели:', error);
      return this.config.ERROR_MODEL_MESSAGE;
    }
  }
}
