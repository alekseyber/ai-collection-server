import { Tool } from './tool.interface';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export const searchFilesTool: Tool = {
  name: 'search_files',
  description: 'Поиск текста внутри файлов. Рекурсивно обходит директорию.',
  parameters: {
    pattern: { type: 'string', description: 'Регулярное выражение для поиска' },
    path: { type: 'string', description: 'Директория для поиска (по умолч. /usr/src/app/src)' },
    file_ext: { type: 'string', description: 'Фильтр по расширению, например .ts (опционально)' },
    max_results: { type: 'number', description: 'Максимум результатов (по умолч. 30)' },
  },
  execute: async (args) => {
    const pattern = String(args.pattern);
    const searchPath = String(args.path ?? '/usr/src/app/src');
    const fileExt = String(args.file_ext ?? '');
    const maxResults = Number(args.max_results ?? 30);

    const results: Array<{ file: string; line: number; match: string }> = [];
    let totalChecked = 0;

    function walk(dir: string) {
      if (results.length >= maxResults) return;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            if (!entry.startsWith('.') && entry !== 'node_modules') {
              walk(fullPath);
            }
          } else if (stat.isFile()) {
            if (fileExt && !entry.endsWith(fileExt)) continue;
            totalChecked++;
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const regex = new RegExp(pattern, 'i');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  const trimmed = lines[i].trim().slice(0, 120);
                  results.push({ file: fullPath, line: i + 1, match: trimmed });
                  if (results.length >= maxResults) return;
                }
              }
            } catch {}
          }
        } catch {}
      }
    }

    walk(searchPath);
    return JSON.stringify({
      matches: results,
      total_matches: results.length,
      files_checked: totalChecked,
      search_path: searchPath,
    });
  },
};