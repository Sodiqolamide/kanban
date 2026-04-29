/**
 * New tests — card-priority utility functions.
 * These tests must FAIL on the base codebase and PASS on the solution.
 */
import { describe, expect, it } from "vitest";

import { createInitialBoardData } from "@/data/board-data";
import { addTaskToColumnWithResult, setCardPriority, type TaskDraft } from "@/state/board-state";
import {
	getCardsByPriority,
	getHighestPriority,
	getPrioritizedCards,
	getUnprioritizedCards,
	isValidPriority,
	PRIORITY_LEVELS,
	sortCardsByPriority,
} from "@/utils/card-priority";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBoard() {
	return createInitialBoardData();
}

function makeDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
	return { prompt: "Do something", baseRef: "main", ...overrides };
}

function addCard(board: ReturnType<typeof makeBoard>, priority?: TaskDraft["priority"], column = "backlog" as const) {
	return addTaskToColumnWithResult(board, column, makeDraft({ priority }));
}

// ─── PRIORITY_LEVELS ──────────────────────────────────────────────────────

describe("PRIORITY_LEVELS", () => {
	it("contains all four priority values in ascending order", () => {
		expect(PRIORITY_LEVELS).toEqual(["low", "medium", "high", "critical"]);
	});
});

// ─── isValidPriority ─────────────────────────────────────────────────────

describe("isValidPriority", () => {
	it("returns true for all valid priorities", () => {
		expect(isValidPriority("low")).toBe(true);
		expect(isValidPriority("medium")).toBe(true);
		expect(isValidPriority("high")).toBe(true);
		expect(isValidPriority("critical")).toBe(true);
	});

	it("returns false for invalid strings", () => {
		expect(isValidPriority("urgent")).toBe(false);
		expect(isValidPriority("")).toBe(false);
	});

	it("returns false for non-strings", () => {
		expect(isValidPriority(1)).toBe(false);
		expect(isValidPriority(null)).toBe(false);
		expect(isValidPriority(undefined)).toBe(false);
	});
});

// ─── getCardsByPriority ───────────────────────────────────────────────────

describe("getCardsByPriority", () => {
	it("returns only cards with the given priority", () => {
		const board = makeBoard();
		const { task: t1, board: b1 } = addCard(board, "high");
		const { task: t2, board: b2 } = addCard(b1, "low");
		const { board: b3 } = addCard(b2);
		const result = getCardsByPriority(b3, "high");
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(t1.id);
	});

	it("returns empty array when no cards have the given priority", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, "low");
		expect(getCardsByPriority(b1, "critical")).toHaveLength(0);
	});
});

// ─── getUnprioritizedCards ────────────────────────────────────────────────

describe("getUnprioritizedCards", () => {
	it("returns only cards without a priority", () => {
		const board = makeBoard();
		const { task: t1, board: b1 } = addCard(board);
		const { board: b2 } = addCard(b1, "high");
		const result = getUnprioritizedCards(b2);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(t1.id);
	});

	it("returns all cards when none have a priority", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board);
		const { board: b2 } = addCard(b1);
		expect(getUnprioritizedCards(b2)).toHaveLength(2);
	});
});

// ─── getPrioritizedCards ──────────────────────────────────────────────────

describe("getPrioritizedCards", () => {
	it("returns only cards that have a priority", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board);
		const { task: t2, board: b2 } = addCard(b1, "medium");
		const result = getPrioritizedCards(b2);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(t2.id);
	});

	it("returns empty array when no cards have a priority", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board);
		expect(getPrioritizedCards(b1)).toHaveLength(0);
	});
});

// ─── sortCardsByPriority ──────────────────────────────────────────────────

describe("sortCardsByPriority", () => {
	it("sorts ascending by default (lowest first)", () => {
		const board = makeBoard();
		const { task: tC, board: b1 } = addCard(board, "critical");
		const { task: tL, board: b2 } = addCard(b1, "low");
		const { task: tH, board: b3 } = addCard(b2, "high");
		const sorted = sortCardsByPriority(b3.columns[0]!.cards);
		expect(sorted.map((c) => c.id)).toEqual([tL.id, tH.id, tC.id]);
	});

	it("sorts descending when direction is desc", () => {
		const board = makeBoard();
		const { task: tL, board: b1 } = addCard(board, "low");
		const { task: tH, board: b2 } = addCard(b1, "high");
		const sorted = sortCardsByPriority(b2.columns[0]!.cards, "desc");
		expect(sorted.map((c) => c.id)).toEqual([tH.id, tL.id]);
	});

	it("places cards without priority at the end regardless of direction", () => {
		const board = makeBoard();
		const { task: tU, board: b1 } = addCard(board);
		const { task: tL, board: b2 } = addCard(b1, "low");
		const ascSorted = sortCardsByPriority(b2.columns[0]!.cards);
		expect(ascSorted[ascSorted.length - 1]?.id).toBe(tU.id);
		const descSorted = sortCardsByPriority(b2.columns[0]!.cards, "desc");
		expect(descSorted[descSorted.length - 1]?.id).toBe(tU.id);
	});

	it("does not mutate the input array", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, "high");
		const { board: b2 } = addCard(b1, "low");
		const cards = b2.columns[0]!.cards;
		const original = [...cards];
		sortCardsByPriority(cards, "asc");
		expect(cards).toEqual(original);
	});
});

// ─── getHighestPriority ───────────────────────────────────────────────────

describe("getHighestPriority", () => {
	it("returns the highest priority across all cards", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, "low");
		const { board: b2 } = addCard(b1, "high");
		const { board: b3 } = addCard(b2, "medium");
		expect(getHighestPriority(b3)).toBe("high");
	});

	it("returns null when no cards have a priority", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board);
		expect(getHighestPriority(b1)).toBeNull();
	});

	it("returns null for an empty board", () => {
		expect(getHighestPriority(makeBoard())).toBeNull();
	});

	it("returns critical when a critical card exists", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, "low");
		const { board: b2 } = addCard(b1, "critical");
		expect(getHighestPriority(b2)).toBe("critical");
	});
});

// ─── cross-column behaviour ───────────────────────────────────────────────

describe("cross-column behaviour", () => {
	it("getCardsByPriority finds cards in non-backlog columns", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "critical", "in_progress");
		const result = getCardsByPriority(b1, "critical");
		expect(result[0]?.id).toBe(task.id);
	});

	it("getPrioritizedCards finds cards across all columns", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, "low", "backlog");
		const { board: b2 } = addCard(b1, "high", "in_progress");
		expect(getPrioritizedCards(b2)).toHaveLength(2);
	});

	it("getUnprioritizedCards finds cards across all columns", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, undefined, "backlog");
		const { board: b2 } = addCard(b1, undefined, "review");
		expect(getUnprioritizedCards(b2)).toHaveLength(2);
	});

	it("getHighestPriority considers cards in all columns", () => {
		const board = makeBoard();
		const { board: b1 } = addCard(board, "low", "backlog");
		const { task: t2, board: b2 } = addCard(b1, undefined, "in_progress");
		const b3 = setCardPriority(b2, t2.id, "critical");
		expect(getHighestPriority(b3)).toBe("critical");
	});
});
