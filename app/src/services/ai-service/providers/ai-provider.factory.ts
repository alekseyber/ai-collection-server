import { ModelsGroupe } from '../../config/models-groupe.enum';
import { LoadConfig } from '../../config/config';
import { AiProvider, AiProviderFactory } from '../ai-provider.interface';
import { OpenRouterProvider } from './openrouter.provider';
import { OllamaProvider } from './ollama.provider';
import { TimewebProvider } from './timeweb.provider';
import { LlamaCppProvider } from './llamacpp.provider';
import { EmbeddingService } from '../embedding-service';
import { SiliconProvider } from './silicon.provider';

export class ConcreteAiProviderFactory implements AiProviderFactory {
  private providers: Map<
    ModelsGroupe,
    new (config: LoadConfig, embeddingService: EmbeddingService) => AiProvider
  >;
  private config: LoadConfig;
  private embeddingService: EmbeddingService;

  constructor(config: LoadConfig, embeddingService: EmbeddingService) {
    this.config = config;
    this.embeddingService = embeddingService;
    this.providers = new Map<
      ModelsGroupe,
      new (config: LoadConfig, embeddingService: EmbeddingService) => AiProvider
    >([
      [ModelsGroupe.OPEN_ROUTER, OpenRouterProvider],
      [ModelsGroupe.OLLAMA, OllamaProvider],
      [ModelsGroupe.LLAMA_CPP, LlamaCppProvider],
      [ModelsGroupe.TIMEWEB_CLOUD_AI, TimewebProvider],
      [ModelsGroupe.SILICON_CLOUD_AI, SiliconProvider],
    ]);
  }

  createProvider(type: ModelsGroupe): AiProvider | null {
    const ProviderClass = this.providers.get(type);
    if (!ProviderClass) return null;
    return new ProviderClass(this.config, this.embeddingService);
  }
}
