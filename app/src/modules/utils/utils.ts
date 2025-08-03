import { getParseMode } from './get-parse-mode';
import { FormattedText, OpenAIResponse } from '../ai-service';

function escapeMarkdownV2(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function getHasMarkdownV2Status(text: string): boolean {
    // Все спецсимволы MarkdownV2, которые нужно экранировать
    const markdownV2SpecialChars = /[_*\[\]()~`>#+\-=|{}.!]/;
    return markdownV2SpecialChars.test(text);
}

function formattedText(text: string): FormattedText {
    return {
        hasMarkdownV2: getParseMode(text)?.ok || false,
        formattedText: text,
    }
}

function formatingResponseAiContent(response: OpenAIResponse | string): string {
    const content = typeof response === 'object' && response?.content ? response.content : response as string;
    return content.replace(/<|im_(start|end)|>/g, '');
}

/**
 * Преобразует строку с разделителями в массив чисел.
 * @param {string} input - Входная строка (например, "692059922,1769298937").
 * @returns {number[]} Массив чисел, соответствующих допустимым элементам строки.
 */
function parseNumbers(input: string | undefined): number[] {
    if (input === undefined) return [];

    return input
        .split(',')
        .map(part => {
            const trimmed = part.trim();
            if (trimmed === '') return null; // Игнорируем пустые элементы
            const num = Number(trimmed);
            return isNaN(num) ? null : num; // Проверяем, что это число
        })
        .filter((num): num is number => num !== null); // Удаляем null значения
}

export interface Utils {
    escapeMarkdownV2: (text: string) => string;
    getHasMarkdownV2Status: (text: string) => boolean;
    formattedText: (text: string) => FormattedText;
    formatingResponseAiContent: (response: OpenAIResponse | string) => string;
    parseNumbers: (input: string | undefined) => number[];
}

export const utils: Utils = {
    escapeMarkdownV2,
    getHasMarkdownV2Status,
    formattedText,
    formatingResponseAiContent,
    parseNumbers,
}