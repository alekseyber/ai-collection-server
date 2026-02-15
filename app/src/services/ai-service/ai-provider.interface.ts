import { ModelsGroupe } from "services/config/models-groupe.enum";

export type RoleAiMessage = "function" | "developer" | "system" | "user" | "assistant" | "tool";

export interface ToolCalls {
    index: number;
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    }
}
export interface Message {
    role: RoleAiMessage;
    content: string;
    name?: string;
    tool_calls?: ToolCalls[];
    reasoning_content?: string;
}
export interface AiProvider {
    ask(messages: Message[], userId: number, modelKey: string): Promise<string>;
}

export interface AiProviderFactory {
    createProvider(type: ModelsGroupe): AiProvider | null;
}

export interface AiEmbeddingProvider {
    ask(input: string[]): Promise<number[][]> ;
}
