/**
 * Base tests — existing behaviour that must pass on both base and solution.
 * These tests must PASS on the base codebase and PASS on the solution.
 */
import { describe, expect, it } from "vitest";

import { createInitialBoardData } from "@/data/board-data";
import { normalizeBoardData } from "@/state/board-state";

describe("createInitialBoardData", () => {
	it("returns four columns in the correct order", () => {
		const board = createInitialBoardData();
		expect(board.columns.map((c) => c.id)).toEqual(["backlog", "in_progress", "review", "trash"]);
	});

	it("starts with empty columns", () => {
		const board = createInitialBoardData();
		for (const column of board.columns) {
			expect(column.cards).toHaveLength(0);
		}
	});
});

describe("normalizeBoardData — existing behaviour", () => {
	it("returns null for non-object input", () => {
		expect(normalizeBoardData(null)).toBeNull();
		expect(normalizeBoardData("string")).toBeNull();
		expect(normalizeBoardData(42)).toBeNull();
	});

	it("returns null when columns is missing", () => {
		expect(normalizeBoardData({})).toBeNull();
	});

	it("normalizes a minimal valid board", () => {
		const raw = { columns: [{ id: "backlog", cards: [] }] };
		const board = normalizeBoardData(raw);
		expect(board).not.toBeNull();
		expect(board!.columns.some((c) => c.id === "backlog")).toBe(true);
	});

	it("drops a card with an empty prompt", () => {
		const raw = {
			columns: [{ id: "backlog", cards: [{ id: "t1", prompt: "  ", baseRef: "main" }] }],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards).toHaveLength(0);
	});

	it("normalizes a valid card without crashing", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Do work", baseRef: "main" }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		const card = board!.columns[0]?.cards[0];
		expect(card?.prompt).toBe("Do work");
	});
});
