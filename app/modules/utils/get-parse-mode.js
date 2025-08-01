export function getParseMode(text) {
    const MDV2_SPECIAL_CHARS = new Set(['_', '*', '[', ']', '(', ')', '~', '', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']);
    const PAIRS = ['*', '_', '~', ''];

    function isEscaped(str, pos) {
        let count = 0;
        for (let i = pos - 1; i >= 0; i--) {
            if (str[i] === '\\') {
                count++
            } else break;
        }
        return count % 2 === 1;
    }

    function parseInline(str, start = 0, stopChars = []) {
        let i = start;
        const stack = [];
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
                let nextPos = textRes.pos;
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
                        } else parenCount--;
                    } else if (c === ' ' || c === '\n' || c === '\t') {
                        return { ok: false };
                    }
                }
                if (urlEnd === -1) return { ok: false };

                i = urlEnd + 1;
                continue;
            }

            if (PAIRS.includes(ch)) {
                if (stack.length > 0 && stack[stack.length - 1].char === ch) {
                    stack.pop();
                    i++;
                    continue;
                } else {
                    stack.push({ char: ch, pos: i });
                    i++;
                    continue;
                }
            }

            if (MDV2_SPECIAL_CHARS.has(ch)) {
                if (!isEscaped(str, i)) return { ok: false };
            }

            i++;
        }

        if (stack.length > 0) return { ok: false };

        return { ok: true, pos: i };
    }

    // Вызов парсера на всём тексте
    return parseInline(text);
}