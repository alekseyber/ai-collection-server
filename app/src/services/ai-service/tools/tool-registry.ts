import { Tool } from './tool.interface';
import { readFileTool } from './read-file.tool';
import { writeFileTool } from './write-file.tool';
import { patchTool } from './patch-file.tool';
import { searchFilesTool } from './search-files.tool';
import { terminalTool } from './terminal.tool';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor() {
    this.register(readFileTool);
    this.register(writeFileTool);
    this.register(patchTool);
    this.register(searchFilesTool);
    this.register(terminalTool);
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /** Краткое описание для LLM — одна строка на инструмент */
  getToolDescriptions(): string {
    return this.getAll().map(t => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `${k}: ${v.type} — ${v.description}`)
        .join(' | ');
      return `${t.name}: ${t.description}. Параметры: ${params}`;
    }).join('\n');
  }
}