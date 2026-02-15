import { LoadConfig } from "../config/config";
import { ErrorApp } from "../errors/error-app.class";
import { ErrorTimewebAgent } from "../errors/error-tmeweb-agent.class";
import { Message } from "./ai-provider.interface";
import { EmbeddingService } from "./embedding-service";

type Choice = {
    index: number;
    message: Message;
    logprobs?: null | string;
    finish_reason: string;
    tool_calls: []
}
type ResponseData = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Choice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    },
    system_fingerprint: string;
}

const tools = [
    {
        type: 'function',
        function: {
            name: 'knowledge_search',
            description:
                'Ищет информацию сначала во внутренней базе знаний, а при необходимости — в интернете. Всегда возвращает отдельные списки результатов: internal_results и web_results.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description:
                            'Запрос пользователя, по которому нужно найти информацию.',
                    },
                    max_internal_results: {
                        type: 'integer',
                        description: 'Максимальное число документов из внутренней базы.',
                        minimum: 1,
                        maximum: 10,
                        default: 5,
                    },
                    max_web_results: {
                        type: 'integer',
                        description:
                            'Максимальное число результатов из интернета (используются, только если внутренние данные не покрывают вопрос).',
                        minimum: 0,
                        maximum: 10,
                        default: 5,
                    },
                },
                required: ['query'],
            },
        },
    },
];

export class LlmDeepseekAgent {
    private config: LoadConfig;
    private embeddingService: EmbeddingService;

    constructor(config: LoadConfig, embeddingService: EmbeddingService) {
        this.config = config;
        this.embeddingService = embeddingService;
    }

    private getParams(messagesOut: Message[], model: string, offTools?: boolean) {
        const messages = messagesOut.map((message, index) => {
            if (index === 0) {
                return {
                    ...message,
                    content: this.config.startToolsPrompt.trim(),
                }
            }
            return message;
        });
        const api_url = this.config.MODELS_CONFIG?.[model]?.api_url || this.config.MODEL_DEFAULT.api_url;
        const params = {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'x-proxy-source': '',
                Authorization: `Bearer ${this.config.TIMEWEB_AI_API_KEY}`,
            },
            body: JSON.stringify({
                messages,
                stream: false,
                temperature: 0.1,
                max_tokens: 2048,
                frequency_penalty: 0.1,
                tools: !offTools ? tools : [], // здесь список функций с name/description/parameters
                tool_choice: 'auto',
            })
        }
        return { params, api_url };
    }

    private async callTimewebCloudAi(messages: Message[], model: string, offTools?: boolean): Promise<ResponseData> {
        try {
            const { params, api_url } = this.getParams(messages, model, offTools);
            const res = await fetch(api_url, params);
            const text = await res.text();
            if (!res.ok) {
                throw new ErrorTimewebAgent("Timeweb agent HTTP error", text, res);
            }

            const data: ResponseData = JSON.parse(text);
            const finish_reason = data?.choices?.[0]?.finish_reason;
            if (!finish_reason) {
                throw new ErrorApp("Timeweb agent HTTP error: отсуствует значение finish_reason");
            }
            return data;
        }
        catch (error) {
            throw error;
        }
    }

    public async askTimewebCloudAi(messages: Message[], model: string, offTools?: boolean): Promise<string> {
        try {
            const data1: ResponseData = await this.callTimewebCloudAi(messages, model, offTools);
            const choice = data1.choices?.[0];
            const message = choice?.message;
            const toolCalls = message?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
                // Модель решила ответить без поиска
                return message?.content || 'Модель не вернула ответ.';
            }
            const toolCallsItem = toolCalls[0];
            const toolCallsItemParams = toolCallsItem?.function;
            const reasoning_content = message?.reasoning_content;
            const argumentsData = JSON.parse(toolCallsItemParams.arguments) as { query: string }

            if (toolCallsItemParams.name === "knowledge_search" && argumentsData?.query && reasoning_content) {
                const searchResultText = await this.embeddingService.answerWithRag(argumentsData?.query);
               
                const newMessages = [...messages, { role: 'assistant', content: reasoning_content }, {
                    role: 'user',
                    content: `
                    Вопрос пользователя:
                    ${messages[messages.length - 1]?.content || ""}
                    РЕЗУЛЬТАТЫ ПОИСКА:
                    ${searchResultText || "в результате поиска по внутренним источникам, не чего не найдено"}
                   ${!searchResultText ? "верни свой ответ, не используя knowledge_search" : ""}
                `.trim(),
                }] as Message[];

                const data2: ResponseData = await this.callTimewebCloudAi(newMessages, model);
                const choice2 = data2.choices?.[0];
                const message2 = choice2?.message;
                return message2?.content || 'Модель не вернула ответ.';
            }

            return message?.content || 'Модель не вернула ответ.';
        } catch (error) {
            throw error;
        }
    }

    public async preparationTimewebCloudAi(contentOut: string, promt: string) {
        try {
            const content = `
                                ${promt}
                                ${contentOut}
                            `.trim();
            return await this.askTimewebCloudAi([{
                role: "assistant",
                content,

            }], "deepseek_v_3_2_timeweb", true)
        }
        catch (error) {
            throw error;
        }
    }
}
