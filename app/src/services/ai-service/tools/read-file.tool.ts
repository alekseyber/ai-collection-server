import { Tool } from './tool.interface';
import { readFileSync, existsSync } from 'fs';

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Прочитать содержимое файла. Возвращает строки с номерами.',
  parameters: {
    path: { type: 'string', description: 'Абсолютный путь к файлу' },
    offset: { type: 'number', description: 'Начальная строка (1-indexed, опционально, по умолч. 1)' },
    limit: { type: 'number', description: 'Сколько строк прочитать (опционально, по умолч. 500)' },
  },
  execute: async (args) => {
    const filePath = String(args.path);
    const offset = Number(args.offset ?? 1);
    const limit = Number(args.limit ?? 500);

    if (!existsSync(filePath)) {
      return JSON.stringify({ error: 'Файл не найден: ' + filePath });
    }

    const lines = readFileSync(filePath, 'utf-8').split('\n');
    const slice = lines.slice(offset - 1, offset - 1 + limit);

    return JSON.stringify({
      total_lines: lines.length,
      file_path: filePath,
      lines: slice.map((l, i) => `${offset + i}|${l}`).join('\n'),
    });
  },
};