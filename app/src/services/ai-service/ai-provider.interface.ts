import { ModelsGroupe } from '../config/models-groupe.enum';

export type RoleAiMessage = 'function' | 'developer' | 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCalls {
  index: number;
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
export interface Message {
  role: RoleAiMessage;
  content: string;
  name?: string;
  tool_calls?: ToolCalls[];
  reasoning_content?: string;
}

// Типы шагов ReAct
export type ReActStep =
  | { type: 'thought'; content: string }
  | { type: 'action'; tool: string; args: Record<string, unknown> }
  | { type: 'observation'; result: unknown }
  | { type: 'final'; answer: string };

export interface AiProvider {
  ask(messages: Message[], userId: number, modelKey: string): Promise<string>;
  askStream(messages: Message[], userId: number, modelKey: string): AsyncIterable<string>;
  askJson<T = Record<string, unknown>>(
    messages: Message[],
    userId: number,
    modelKey: string,
    schema?: string,
  ): Promise<T>;
}
export interface AiProviderFactory {
  createProvider(type: ModelsGroupe): AiProvider | null;
}
export interface AiEmbeddingProvider {
  ask(input: string[]): Promise<number[][]>;
}
