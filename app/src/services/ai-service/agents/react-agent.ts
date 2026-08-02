import { LoadConfig } from '../../config/config';
import { Message, AiProviderFactory, ReActStep } from '../ai-provider.interface';
import { EmbeddingService } from '../embedding-service';
import { ConcreteAiProviderFactory } from '../providers/ai-provider.factory';

export type ToolDefinition = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
};

export const REACT_SYSTEM_PROMPT = `Ты — JSON-агент. Отвечай ТОЛЬКО валидным JSON строго по схеме, без лишнего текста.

Схема ответа:
{"type":"thought","content":"твои рассуждения"}
{"type":"action","tool":"имя_инструмента","args":{...}}
{"type":"final","answer":"ответ пользователю"}

Жёсткие правила:
1. НИКАКОГО ТЕКСТА вне JSON — ни до, ни после фигурных скобок
2. Если нужно подумать → type: thought
3. Если нужно вызвать инструмент → type: action
4. Если готов ответить → type: final
5. Отвечай на русском языке`;

export class ReActAgent {
    private config: LoadConfig;
    private embeddingService: EmbeddingService;
    private providerFactory: AiProviderFactory;
    private maxIterations = 10;

    constructor(
        config: LoadConfig,
        embeddingService: EmbeddingService,
        providerFactory?: AiProviderFactory
    ) {
        this.config = config;
        this.embeddingService = embeddingService;
        this.providerFactory = providerFactory || new ConcreteAiProviderFactory(config, embeddingService);
    }

    private getTools(): ToolDefinition[] {
        return [
            {
                name: 'knowledge_search',
                description: 'Поиск информации во внутренней базе знаний и при необходимости в интернете',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Поисковый запрос' },
                    },
                    required: ['query'],
                },
                execute: async (args) => {
                    const query = String(args.query || '');
                    const result = await this.embeddingService.answerWithRag(query);
                    return JSON.stringify({ source: 'knowledge_base', result });
                },
            },
        ];
    }

    async *runStream(
        history: Message[],
        userMessage: string,
        modelKey: string
    ): AsyncGenerator<ReActStep | { type: 'chunk'; content: string }> {
        const modelConfig = this.config.MODELS_CONFIG[modelKey];
        if (!modelConfig) {
            yield { type: 'final', answer: 'Модель не найдена' };
            return;
        }

        const provider = this.providerFactory.createProvider(modelConfig.modelsGroupe);
        if (!provider) {
            yield { type: 'final', answer: 'Провайдер не найден' };
            return;
        }

        const tools = this.getTools();
        const userContent = this.config.startToolsPrompt || '';

        const messages: Message[] = [
            { role: 'system', content: REACT_SYSTEM_PROMPT + '\n\n' + userContent },
            ...history.slice(-6),
            { role: 'user', content: userMessage },
        ];

        for (let i = 0; i < this.maxIterations; i++) {
            // Шаг 1: streaming через provider.askStream()
            let fullContent = '';
            try {
                for await (const chunk of provider.askStream(messages, 0, modelKey)) {
                    fullContent += chunk;
                    yield { type: 'chunk', content: chunk };
                }
            } catch (error: any) {
                yield { type: 'final', answer: 'Ошибка: ' + error.message };
                return;
            }

            // Шаг 2: парсим JSON
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                yield { type: 'final', answer: fullContent || 'Ошибка: модель не вернула JSON' };
                return;
            }

            let step: ReActStep;
            try {
                step = JSON.parse(jsonMatch[0]) as ReActStep;
            } catch {
                yield { type: 'final', answer: fullContent || 'Ошибка: невалидный JSON от модели' };
                return;
            }

            // Final — ответ готов
            if (step.type === 'final') {
                yield step;
                return;
            }

            // Thought — продолжаем цикл
            if (step.type === 'thought') {
                messages.push({ role: 'assistant', content: JSON.stringify(step) });
                yield { type: 'thought', content: step.content };
                continue;
            }

            // Action — выполняем инструмент и добавляем результат в историю
            if (step.type === 'action') {
                const tool = tools.find(t => t.name === step.tool);
                if (!tool) {
                    messages.push({ role: 'assistant', content: fullContent });
                    messages.push({
                        role: 'tool',
                        content: JSON.stringify({ type: 'observation', result: 'Инструмент не найден: ' + step.tool }),
                    });
                    yield { type: 'final', answer: 'Инструмент не найден' };
                    return;
                }

                try {
                    const result = await tool.execute(step.args);
                    messages.push({ role: 'assistant', content: fullContent });
                    messages.push({ role: 'tool', content: result });
                    yield { type: 'action', tool: step.tool, args: step.args };
                } catch (error: any) {
                    messages.push({ role: 'assistant', content: fullContent });
                    messages.push({ role: 'tool', content: 'Ошибка: ' + error.message });
                }
                continue;
            }
        }

        yield { type: 'final', answer: 'Превышен лимит итераций ReAct цикла' };
    }
}
