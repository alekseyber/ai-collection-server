import { Tracing } from 'trace_events';
import { getParseMode } from './get-parse-mode';

function escapeMarkdownV2(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function getHasMarkdownV2Status(text: string): boolean {
    // Все спецсимволы MarkdownV2, которые нужно экранировать
    const markdownV2SpecialChars = /[_*\[\]()~`>#+\-=|{}.!]/;
    return markdownV2SpecialChars.test(text);
}
export type FormattedText = {
    hasMarkdownV2: boolean;
    formattedText: string;
}
function formattedText(text: string): FormattedText {
    return {
        hasMarkdownV2: getParseMode(text)?.ok || false,
        formattedText: text,
    }
}

function formatingResponseAiContent(response: Record<string, string> | string): string {
    const content = typeof response === 'object' && response?.content ? response.content : response as string;
    return content.replace(/<|im_(start|end|think)|>/g, '');
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

function formatingKinopiskRating(response: any, page: number): { info: string; csvContent: string } {
    if (!response?.totalPages && !response?.items) return { info: 'Ответ не получен', csvContent: "" };

    const items = response?.items || [];

    const info = `Текущая страница ${page} из ${response?.totalPages}, следующее сообщение CSV с данными`;
    // Заголовки CSV
    const headers = "nameRu;nameOriginal;year;type;userRating;ratingKinopoisk;ratingImbd";

    // Формируем строки данных
    const rows = items.map((item: any) => {
        const nameRu = item?.nameRu ? `"${item.nameRu.replace(/"/g, '""')}"` : '';
        const nameOriginal = item?.nameOriginal ? `"${item.nameOriginal.replace(/"/g, '""')}"` : '';
        const year = item?.year ?? '';
        const type = item?.type ?? '';
        const userRating = item?.userRating ?? '';
        const ratingKinopoisk = item?.ratingKinopoisk ?? '';
        const ratingImbd = item?.ratingImbd ?? '';
        return `${nameRu};${nameOriginal};${year};${type};${userRating};${ratingKinopoisk};${ratingImbd}`;
    });

    // Добавляем первую строку с информацией о странице как комментарий (необязательно)
    // Или убираем её из тела CSV, чтобы не нарушать структуру
    const csvContent = [
        headers,
        ...rows
    ].join('\n');

    return { info, csvContent };

}

export interface Utils {
    escapeMarkdownV2: (text: string) => string;
    getHasMarkdownV2Status: (text: string) => boolean;
    formattedText: (text: string) => FormattedText;
    formatingResponseAiContent: (response: Record<string, string> | string) => string;
    parseNumbers: (input: string | undefined) => number[];
    formatingKinopiskRating: (response: any, page: number) => { info: string; csvContent: string };
}

export const utils: Utils = {
    escapeMarkdownV2,
    getHasMarkdownV2Status,
    formattedText,
    formatingResponseAiContent,
    parseNumbers,
    formatingKinopiskRating,
}