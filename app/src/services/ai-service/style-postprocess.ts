import { appendFile, mkdir, readFile } from 'fs/promises';
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

/**
 * Режим работы: 'local' — LoRA-модель на своём стенде, 'cloud' — few-shot на DeepSeek.
 * Облако даёт перестройку чужого текста (LoRA этого не умеет), но тянет примеры стиля
 * и сам текст в API; локальный режим — для приватных текстов и нулевой стоимости.
 * Переключается переменной STYLE_MODE, примеры стиля лежат вне репозитория.
 */
const CLOUD_MODE = process.env.STYLE_MODE === 'cloud';
const EXAMPLES_FILE = process.env.STYLE_EXAMPLES_FILE || '';
const STYLE_RULES =
  'Стиль автора: строчная первая буква, запятые почти не ставит, склеивает короткие ' +
  'предложения через "и"/"а еще", пишет "то что", "что бы", разговорные связки, ' +
  'без канцелярита и без списков.';
const NUM_RE_G = /\d+[\d.,]*|(?<!\w)[A-Za-z_][A-Za-z0-9_]{2,}/g;

let cachedExamples: string[] | null = null;
/** Примеры стиля: сначала из файла (если задан), иначе из redis через config. */
async function styleExamples(fromConfig: string[] = []): Promise<string[]> {
  if (cachedExamples) return cachedExamples;
  if (EXAMPLES_FILE) {
    try {
      const arr = JSON.parse(await readFile(EXAMPLES_FILE, 'utf8'));
      if (Array.isArray(arr)) return (cachedExamples = arr.filter((x) => typeof x === 'string'));
    } catch {
      /* файла нет — берём из конфига */
    }
  }
  return (cachedExamples = fromConfig);
}
const BLOCK_TIMEOUT_MS = 20000;
const MAX_PARALLEL = 3;
const MIN_PROSE_LEN = 60;

export type StyleResult = {
  text: string;
  blocks: number;
  prose: number;
  styled: number;
  /** Блоки, которые после двух попыток остались почти копией входа. */
  nearCopy: number;
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
/** Похожесть текста на исходник: если модель почти скопировала, переписывания не было. */
function similarity(a: string, b: string): number {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  const bigrams = (t: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const A = bigrams(x), B = bigrams(y);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (x.length + y.length - 2 || 1);
}

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
    const key = CLOUD_MODE ? 'deepseek_flash_api' : 'style_v2';
    return this.config.MODELS_CONFIG[key] as
      | { api_url: string; key_api?: string; system_prompt?: string; api_key_env?: string }
      | undefined;
  }

  isConfigured(): boolean {
    const c = this.modelCfg();
    return Boolean(c?.api_url);
  }

  private async restyle(
    block: string,
    attempt = 0,
  ): Promise<{ text: string; ms: number }> {
    const c = this.modelCfg()!;
    // Вторая попытка — когда модель почти дословно повторила вход.
    // Дополнительное указание кладём в СИСТЕМНЫй промпт, а не в текст пользователя:
    // проверено, что при вставке в user-сообщение модель переписывает вместе с ним
    // и выдаёт ответ, начинающийся с самой инструкции (уходило в чат).
    const examples = CLOUD_MODE
      ? await styleExamples((this.config as unknown as { styleExamples?: string[] }).styleExamples || [])
      : [];
    const tokens = (block.match(NUM_RE_G) || []).slice(0, 12);
    const baseSystem = CLOUD_MODE
      ? 'Ты переписываешь текст в манере конкретного человека. Измени структуру: порядок мыслей, ' +
        'границы предложений, длину фраз. Сохрани ВСЕ факты, числа, имена и латинские идентификаторы ' +
        'дословно. Верни только переписанный текст.\n\n' +
        STYLE_RULES +
        (tokens.length ? `\n\nСохрани дословно: ${tokens.join(', ')}` : '') +
        (examples.length ? '\n\nПримеры его сообщений:\n' + examples.join('\n---\n') : '')
      : c.system_prompt || SYSTEM_PROMPT;
    const system =
      attempt === 0
        ? baseSystem
        : baseSystem + ' Не повторяй формулировки исходного текста, перепиши своими словами.';
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), BLOCK_TIMEOUT_MS);
    try {
      const res = await fetch(c.api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(() => {
            const envName = (c as { api_key_env?: string }).api_key_env;
            const key =
              (envName ? (this.config as unknown as Record<string, string>)[envName] : '') ||
              (envName ? process.env[envName] : '') ||
              process.env.STYLE_API_KEY ||
              '';
            return key ? { Authorization: `Bearer ${key}` } : {};
          })(),
        },
        body: JSON.stringify({
          model: c.key_api || 'style-v2',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: block },
          ],
          temperature: attempt === 0 ? 0.7 : 0.85,
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
      nearCopy: 0,
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
          let best = '';
          let bestSim = 1;
          let ok = false;
          // До двух попыток: первый ответ мог быть почти копией входа
          // (модель часто не переписывает формальный текст), тогда просим иначе.
          for (let attempt = 0; attempt < 2; attempt++) {
            const { text: out } = await this.restyle(blocks[i], attempt);
            const check = guard(blocks[i], out);
            if (!check.ok) continue;
            const sim = similarity(blocks[i], out);
            if (!ok || sim < bestSim) {
              best = out;
              bestSim = sim;
              ok = true;
            }
            if (sim <= 0.93) break; // переписал достаточно, вторая попытка не нужна
          }
          if (ok) {
            results.set(i, best);
            base.styled++;
            if (bestSim > 0.93) base.nearCopy++;
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
      nearCopy: base.nearCopy,
      rejected: base.rejected,
      ms: base.ms,
      chars_in: text.length,
      chars_out: merged.length,
      hash_in: Buffer.from(text).toString('base64').slice(0, 16),
    });

    return base;
  }
}
