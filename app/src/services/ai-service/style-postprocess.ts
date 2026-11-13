import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { LoadConfig } from '../config/config';

/**
 * Пост-обработка ответа стиль-моделью: берём готовый ответ, отдаём его
 * LoRA-модели стиля и возвращаем переписанный текст.
 *
 * Почему по блокам, а не целиком: сплошной проход на CPU занимает 50–80 секунд
 * и схлопывает абзацы (замер 13.11.2026). Блоки обрабатываются параллельно,
 * код, таблицы, списки и ссылки в модель не отправляются.
 *
 * Почему fail-open: стиль — украшение, а не источник факта. Любой сбой
 * (таймаут, отказ проверки, пустой ответ) возвращает исходный текст,
 * пользователь никогда не получает обрезанный ответ из-за второго прохода.
 */

const SYSTEM_PROMPT =
  'Перепиши текст в моей манере. Сохрани факты, числа и имена. Верни только текст.';
const BLOCK_TIMEOUT_MS = 20000;
const MAX_PARALLEL = 3;
const MIN_PROSE_LEN = 60;

export type StyleResult = {
  text: string;
  blocks: number;
  prose: number;
  styled: number;
  rejected: number;
  ms: number;
};

const CODE_RE = /```|\t|\|.*\|.*\||https?:\/\//;
const NUM_RE = /\d+[\d.,]*/g;
const ID_RE = /\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g;

function isProse(block: string): boolean {
  const b = block.trim();
  if (b.length < MIN_PROSE_LEN) return false;
  if (CODE_RE.test(b)) return false;
  if (/^(- |\* |\d+\.|#|>)/.test(b)) return false;
  return true;
}

/** Проверка, что стилизация не потеряла факты. Пороги откалиброваны по прототипу. */
function guard(src: string, out: string): { ok: boolean; why: string } {
  if (!out || out.trim().length < 20) return { ok: false, why: 'пусто' };
  const ratio = out.length / Math.max(1, src.length);
  if (ratio < 0.5 || ratio > 1.3) return { ok: false, why: `длина ${ratio.toFixed(2)}` };

  const nums = (t: string) => new Set((t.match(NUM_RE) || []).map((n) => n.replace(/[.,]$/, '')));
  const missingNums = [...nums(src)].filter((n) => !nums(out).has(n));
  if (missingNums.length) return { ok: false, why: `числа: ${missingNums.join(',')}` };

  // регистр не учитываем: модель законно пишет `optimistic` вместо `Optimistic`
  const ids = (t: string) =>
    new Set((t.match(ID_RE) || []).filter((w) => /[A-Z_]/.test(w)).map((w) => w.toLowerCase()));
  const missingIds = [...ids(src)].filter((w) => !ids(out).has(w));
  if (missingIds.length) return { ok: false, why: `идентификаторы: ${missingIds.join(',')}` };

  return { ok: true, why: 'ok' };
}

export class StylePostprocessor {
  constructor(private config: LoadConfig) {}

  private modelCfg() {
    return this.config.MODELS_CONFIG['style_v2'] as
      | { api_url: string; key_api?: string; system_prompt?: string }
      | undefined;
  }

  isConfigured(): boolean {
    const c = this.modelCfg();
    return Boolean(c?.api_url);
  }

  private async restyle(block: string): Promise<{ text: string; ms: number }> {
    const c = this.modelCfg()!;
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), BLOCK_TIMEOUT_MS);
    try {
      const res = await fetch(c.api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.STYLE_API_KEY
            ? { Authorization: `Bearer ${process.env.STYLE_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model: c.key_api || 'style-v2',
          messages: [
            { role: 'system', content: c.system_prompt || SYSTEM_PROMPT },
            { role: 'user', content: block },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`style ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return { text: (data.choices?.[0]?.message?.content || '').trim(), ms: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  }

  private async log(entry: Record<string, unknown>): Promise<void> {
    const path = process.env.STYLE_LOG_PATH || '/usr/src/app/logs/style-v2/runs.jsonl';
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // лог не должен ломать ответ
    }
  }

  /** Переписывает текст. При любой проблеме возвращает исходный. */
  async apply(text: string): Promise<StyleResult> {
    const started = Date.now();
    const base: StyleResult = {
      text,
      blocks: 0,
      prose: 0,
      styled: 0,
      rejected: 0,
      ms: 0,
    };
    if (!this.isConfigured() || !text || text.length < MIN_PROSE_LEN) return base;

    const blocks = text.split(/\n{2,}/);
    const idx = blocks.map((b, i) => (isProse(b) ? i : -1)).filter((i) => i >= 0);
    base.blocks = blocks.length;
    base.prose = idx.length;
    if (!idx.length) return { ...base, ms: Date.now() - started };

    const results = new Map<number, string>();
    let cursor = 0;
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, idx.length) }, async () => {
      while (cursor < idx.length) {
        const i = idx[cursor++];
        try {
          const { text: out } = await this.restyle(blocks[i]);
          const check = guard(blocks[i], out);
          if (check.ok) {
            results.set(i, out);
            base.styled++;
          } else {
            base.rejected++;
          }
        } catch {
          base.rejected++;
        }
      }
    });
    await Promise.all(workers);

    const merged = blocks.map((b, i) => results.get(i) ?? b).join('\n\n');
    base.text = merged;
    base.ms = Date.now() - started;

    await this.log({
      ts: new Date().toISOString(),
      blocks: base.blocks,
      prose: base.prose,
      styled: base.styled,
      rejected: base.rejected,
      ms: base.ms,
      chars_in: text.length,
      chars_out: merged.length,
      hash_in: Buffer.from(text).toString('base64').slice(0, 16),
    });

    return base;
  }
}
