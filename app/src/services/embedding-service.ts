import { AIService } from "./ai-service";
import { LoadConfig } from "./config/config";
import { PgClientService, RowSimilar } from "./pg-client-service";

/**
 * Разбивает текст на чанки фиксированного размера с overlap.
 * @param text      исходный текст
 * @param size      максимальный размер чанка в символах (например, 1000)
 * @param overlap   перекрытие между чанками в символах (например, 150)
 */
function splitToChunks(
    text: string,
    size: number = 1000,
    overlap: number = 150
): string[] {
    const chunks: string[] = [];
    const cleaned = text.trim().replace(/\s+\n/g, '\n'); // немного чистим

    if (!cleaned) return chunks;

    let start = 0;

    while (start < cleaned.length) {
        let end = start + size;

        if (end >= cleaned.length) {
            chunks.push(cleaned.slice(start).trim());
            break;
        }

        // Пытаемся разорвать по границе предложения, ближе к концу чанка
        let boundary = cleaned.lastIndexOf('.', end);
        const minBoundary = start + Math.floor(size * 0.7); // не слишком рано

        if (boundary < minBoundary) {
            boundary = cleaned.lastIndexOf('\n', end);
        }
        if (boundary < minBoundary) {
            boundary = end; // не нашли удобную границу — рвём как есть
        }

        const chunk = cleaned.slice(start, boundary).trim();
        if (chunk) chunks.push(chunk);

        // следующий чанк начинаем с учётом overlap
        start = boundary - overlap;
        if (start < 0) start = 0;
    }

    return chunks;
};


export class EmbeddingService {
    private config: LoadConfig;
    private aiServiceInstance: AIService;
    private pgClientService: PgClientService;
    constructor(
        config: LoadConfig,
        aiServiceInstance: AIService,
    ) {
        this.config = config;
        this.aiServiceInstance = aiServiceInstance;
        this.pgClientService = new PgClientService();
    }

    private async getEmbedding(content: string[]): Promise<number[][]> {
        const embedding = await this.aiServiceInstance.askOllamaEmbeddings(content);
        return embedding;
    }
    public async answerWithRag(question: string): Promise<string> {
        try {
            const embedding = await this.getEmbedding([question]);
            const rows = await this.pgClientService.searchSimilar(embedding[0]);
            const context = rows
                .filter((r: RowSimilar) => r.similarity > 0.5)
                .map(
                    (r: RowSimilar, idx: number) =>
                        `Источник ${idx + 1} (similarity: ${r.similarity.toFixed(3)}, source: ${r.source}):\n${r.content}`,
                )
                .join('\n\n---\n\n');
            
            return context
        } catch (error) {
            console.error("Ошибка при поиске векторизации:", error);
        }
    }

    public async addEmbeddingSource(
        content: string,
        source: string = "telegramm_bot_input_text"
    ): Promise<{ content: string; source: string; status: boolean }> {
        let status = false;
        try {
            const chunks = splitToChunks(content);
            const embedding = await this.getEmbedding(chunks);
            if (chunks.length === embedding.length) {
                let index = 0;
                for (const chunk of chunks) {
                    // сохраняем в БД
                    await this.pgClientService.saveChunk(source, chunk, embedding[index]);
                    index++;
                }
                status = true;
            }
        } catch (error) {
            console.error("Ошибка при добавлении векторизации:", error);

        } finally {
            return { content, source, status };
        }
    }
}