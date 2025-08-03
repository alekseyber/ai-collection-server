export function getParseMode(text: string): { ok: boolean; pos?: number } {
    const MDV2_SPECIAL_CHARS = new Set(['_', '*', '[', ']', '(', ')', '~', '', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']);
    const PAIRS = ['*', '_', '~', ''];

    function isEscaped(str: string, pos: number): boolean {
        let count = 0;
        for (let i = pos - 1; i >= 0; i--) {
            if (str[i] === '\\') {
                count++
            } else break;
        }
        return count % 2 === 1;
    }

    function parseInline(str: string, start = 0, stopChars: string[] = []): { ok: boolean; pos?: number } {
        let i = start;
        const stack: string[] = [];
        while (i < str.length) {
            const ch = str[i];

            if (isEscaped(str, i)) {
                i += 1;
                continue;
            }

            if (stopChars.includes(ch)) {
                if (stack.length > 0) return { ok: false };
                return { ok: true, pos: i };
            }

            if (ch === '[') {
                const textRes = parseInline(str, i + 1, [']']);
                if (!textRes.ok) return { ok: false };
                let nextPos = textRes.pos!;
                if (str[nextPos] !== ']') return { ok: false };

                nextPos++;
                if (str[nextPos] !== '(') return { ok: false };
                nextPos++;

                let urlStart = nextPos;
                let urlEnd = -1;
                let parenCount = 0;
                for (let j = urlStart; j < str.length; j++) {
                    const c = str[j];
                    if (isEscaped(str, j)) continue;

                    if (c === '(') parenCount++;
                    else if (c === ')') {
                        if (parenCount === 0) {
                            urlEnd = j;
                            break;
                        }
                        parenCount--;
                    }
                }

                if (urlEnd === -1) return { ok: false };
                i = urlEnd + 1;
                continue;
            }

            if (PAIRS.includes(ch)) {
                if (stack.length > 0 && stack[stack.length - 1] === ch) {
                    stack.pop();
                } else {
                    stack.push(ch);
                }
            }

            i += 1;
        }

        return { ok: stack.length === 0 };
    }

    return parseInline(text);
}