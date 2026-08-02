import { LoadConfig } from '../../config/config';
import { AiEmbeddingProvider } from '../ai-provider.interface';

export class EmbeddingProvider implements AiEmbeddingProvider {
  constructor(private config: LoadConfig) {}

  async ask(input: string[]): Promise<number[][]> {
    try {
      // const model = this.config.MODELS_CONFIG.embeddings_ollama.key_api;
      const model = this.config.MODELS_CONFIG.silicone_embeddings.key_api;
      const body = JSON.stringify({ model, input });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 159000);

      // const res = await fetch("http://ollama:11434/api/embed", {
      //     method: "POST",
      //     headers: { 'Content-Type': 'application/json' },
      //     body,
      //     signal: controller.signal
      // });

      const res = await fetch('http://ollama:11434/api/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.SILICON_FLOW_AI_API_KEY}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (Array.isArray(data.embeddings)) return data.embeddings;
      if (Array.isArray(data.embedding)) return [data.embedding];
      return [];
    } catch (error: any) {
      console.error('Ошибка при обращении к Ollama embeddings:', error.message);
      return [];
    }
  }
}
