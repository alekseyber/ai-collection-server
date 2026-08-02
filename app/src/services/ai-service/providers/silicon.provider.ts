import OpenAI from "openai";
import { AiProvider, Message } from "../ai-provider.interface";
import { LoadConfig, PROVIDER_BASE_URLS } from "../../config/config";
import { ChatCompletionMessageParam } from "openai/resources/index";

function extractFirstJson(text: string): any {
  try {
    const start = text.indexOf("{");
    if (start === -1) return { type: "final", answer: "Пустой ответ модели" };
    let depth = 0, inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\\\") { i++; continue; }
        if (ch === "\"") inString = false; continue;
      }
      if (ch === "\"") { inString = true; continue; }
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch { return { type: "final", answer: "Ошибка парсинга JSON" }; }
        }
      }
    }
    return { type: "final", answer: "JSON не найден в ответе модели" };
  } catch { return { type: "final", answer: "Ошибка в extractFirstJson" }; }
}

export class SiliconProvider implements AiProvider {
    private client: OpenAI;
    constructor(private config: LoadConfig) {
        this.client = new OpenAI({
            baseURL: PROVIDER_BASE_URLS["silicon"],
            apiKey: this.config.SILICON_FLOW_AI_API_KEY,
        });
    }

    async *askStream(messages: Message[], userId: number, modelKey: string, timeoutMs = 60000): AsyncGenerator<string> {
        const model = this.config.MODELS_CONFIG[modelKey]?.key_api;
        if (!model) throw new Error("Model not found");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const stream = await this.client.chat.completions.create({
                model, stream: true, temperature: 0.1, max_tokens: 200,
                messages: messages.map(m => ({ role: m.role as ChatCompletionMessageParam["role"], content: m.content })) as ChatCompletionMessageParam[],
            }, { signal: controller.signal });
            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta?.content || "";
                if (delta) yield delta;
            }
        } finally { clearTimeout(timeout); }
    }

    async askJson<T = Record<string, unknown>>(messages: Message[], userId: number, modelKey: string, schema?: string, timeoutMs = 60000): Promise<T> {
        const model = this.config.MODELS_CONFIG[modelKey]?.key_api;
        if (!model) throw new Error("Model not found");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const instr = schema ? "\nRespond ONLY with valid JSON matching this schema:\n" + schema : "\nRespond ONLY with valid JSON.";
            const msgs = messages.map(m => m.role === "system" ? { ...m, content: m.content + instr } : m);
            if (!msgs.some(m => m.role === "system")) msgs.unshift({ role: "system", content: "You are a JSON agent." + instr });
            const response = await this.client.chat.completions.create({
                model, temperature: 0.1, max_tokens: 500,
                messages: msgs.map(m => ({ role: m.role as ChatCompletionMessageParam["role"], content: m.content })) as ChatCompletionMessageParam[],
            }, { signal: controller.signal });
            return extractFirstJson(response.choices?.[0]?.message?.content || "{}") as T;
        } catch (e: any) {
            return { type: "final", answer: "Ошибка API: " + (e.message || "неизвестная") } as T;
        } finally { clearTimeout(timeout); }
    }

    async ask(messages: Message[], userId: number, modelKey: string): Promise<string> {
        try {
            const model = this.config.MODELS_CONFIG[modelKey]?.key_api;
            if (!model) throw new Error("Model not found");
            const response = await this.client.chat.completions.create({
                model, max_tokens: 500,
                messages: messages.map(m => ({ role: m.role as ChatCompletionMessageParam["role"], content: m.content })) as ChatCompletionMessageParam[],
            });
            return response.choices?.[0]?.message?.content || "No response";
        } catch (error: any) { console.error("silicon error:", error.message); return error.message; }
    }
}
