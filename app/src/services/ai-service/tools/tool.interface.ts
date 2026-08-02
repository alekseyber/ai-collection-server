export type ToolParameter = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  properties?: Record<string, ToolParameter>;
  required?: string[];
};

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute(args: Record<string, unknown>): Promise<string>;
}

/** Формат для ReActAgent — плоская структура параметров */
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
};