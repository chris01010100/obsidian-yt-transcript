const DEFAULT_MIN_SPLIT_RATIO = 0.6;

function normalizeChunk(chunk: string): string {
    return chunk.trim();
}

function findBestSplitIndex(text: string, maxChars: number): number {
    if (text.length <= maxChars) {
        return text.length;
    }

    const minSplit = Math.max(1, Math.floor(maxChars * DEFAULT_MIN_SPLIT_RATIO));
    const candidateWindow = text.slice(minSplit, maxChars + 1);

    const paragraphBreakIndex = candidateWindow.lastIndexOf("\n\n");
    if (paragraphBreakIndex !== -1) {
        return minSplit + paragraphBreakIndex + 2;
    }

    let sentenceBreakIndex = -1;
    for (let i = candidateWindow.length - 1; i >= 0; i -= 1) {
        const char = candidateWindow[i];
        const nextChar = candidateWindow[i + 1] || "";
        if ((char === "." || char === "!" || char === "?") && (!nextChar || /\s/.test(nextChar))) {
            sentenceBreakIndex = i;
            break;
        }
    }

    if (sentenceBreakIndex !== -1) {
        return minSplit + sentenceBreakIndex + 1;
    }

    const lineBreakIndex = candidateWindow.lastIndexOf("\n");
    if (lineBreakIndex !== -1) {
        return minSplit + lineBreakIndex + 1;
    }

    return maxChars;
}

export function splitIntoChunks(text: string, maxChars: number): string[] {
    if (!text.trim()) {
        return [];
    }

    if (maxChars <= 0) {
        return [normalizeChunk(text)];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const remaining = text.slice(cursor);

        if (remaining.length <= maxChars) {
            const finalChunk = normalizeChunk(remaining);
            if (finalChunk) {
                chunks.push(finalChunk);
            }
            break;
        }

        const splitIndex = findBestSplitIndex(remaining, maxChars);
        const chunkText = normalizeChunk(remaining.slice(0, splitIndex));

        if (chunkText) {
            chunks.push(chunkText);
        }

        cursor += splitIndex;

        while (cursor < text.length && /\s/.test(text[cursor])) {
            cursor += 1;
        }
    }

    return chunks;
}
