import { splitIntoChunks } from "../src/transcript-chunker";

describe("splitIntoChunks", () => {
    test("returns empty array for empty input", () => {
        expect(splitIntoChunks("   ", 100)).toEqual([]);
    });

    test("returns single normalized chunk for short input", () => {
        expect(splitIntoChunks("  short text  ", 100)).toEqual(["short text"]);
    });

    test("splits long input into bounded chunks", () => {
        const text = "A".repeat(120) + " " + "B".repeat(120) + " " + "C".repeat(120);
        const chunks = splitIntoChunks(text, 150);

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every((chunk) => chunk.length <= 150)).toBe(true);
    });

    test("prefers sentence boundaries when possible", () => {
        const text = "Sentence one is complete. Sentence two is complete. Sentence three is complete.";
        const chunks = splitIntoChunks(text, 45);

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.some((chunk) => chunk.endsWith("."))).toBe(true);
    });

    test("falls back to hard split without punctuation", () => {
        const text = "x".repeat(250);
        const chunks = splitIntoChunks(text, 100);

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toHaveLength(100);
        expect(chunks[1]).toHaveLength(100);
        expect(chunks[2]).toHaveLength(50);
    });
});
