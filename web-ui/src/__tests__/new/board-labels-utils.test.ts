/**
 * New tests — verify the board-labels utility functions.
 * These tests must all FAIL on the base code and PASS after the solution is applied.
 */
import { describe, expect, it } from "vitest";
import { createInitialBoardData } from "@/data/board-data";
import { addBoardLabel, addLabelToCard, addTaskToColumnWithResult } from "@/state/board-state";
import type { BoardData } from "@/types";
import {
	filterBoardByLabel,
	getCardLabels,
	getCardsWithLabel,
	getLabelById,
	getLabelDistribution,
	getLabelsByIds,
	getLabelUsageCount,
	getUnlabeledCards,
	isValidLabelColor,
	sortLabelsByName,
	VALID_LABEL_COLORS,
} from "@/utils/board-labels";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeBoard(): BoardData {
	return createInitialBoardData();
}

// ─── VALID_LABEL_COLORS ───────────────────────────────────────────────────────

describe("VALID_LABEL_COLORS", () => {
	it("exports all seven valid colors", () => {
		expect([...VALID_LABEL_COLORS].sort()).toEqual(["blue", "gray", "green", "orange", "purple", "red", "yellow"]);
	});
});

// ─── isValidLabelColor ────────────────────────────────────────────────────────

describe("isValidLabelColor", () => {
	it.each(["red", "orange", "yellow", "green", "blue", "purple", "gray"])("accepts %s", (color) => {
		expect(isValidLabelColor(color)).toBe(true);
	});

	it.each(["pink", "neon", "", "RED", "Red", 42, null, undefined])("rejects %s", (color) => {
		expect(isValidLabelColor(color)).toBe(false);
	});
});

// ─── getLabelById ─────────────────────────────────────────────────────────────

describe("getLabelById", () => {
	it("returns the label when it exists", () => {
		const { board, label } = addBoardLabel(makeBoard(), "Bug", "red");
		expect(getLabelById(board, label.id)).toEqual(label);
	});

	it("returns undefined for a non-existent id", () => {
		expect(getLabelById(makeBoard(), "ghost")).toBeUndefined();
	});
});

// ─── getLabelsByIds ───────────────────────────────────────────────────────────

describe("getLabelsByIds", () => {
	it("returns labels in the order of the input ids", () => {
		let board = makeBoard();
		const r1 = addBoardLabel(board, "A", "red");
		const r2 = addBoardLabel(r1.board, "B", "blue");
		board = r2.board;
		const result = getLabelsByIds(board, [r2.label.id, r1.label.id]);
		expect(result.map((l) => l.name)).toEqual(["B", "A"]);
	});

	it("silently skips missing ids", () => {
		const { board, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const result = getLabelsByIds(board, [label.id, "ghost"]);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(label.id);
	});

	it("returns empty array for empty input", () => {
		expect(getLabelsByIds(makeBoard(), [])).toHaveLength(0);
	});
});

// ─── getCardLabels ────────────────────────────────────────────────────────────

describe("getCardLabels", () => {
	it("returns empty array when card has no labelIds", () => {
		const { board, task } = addTaskToColumnWithResult(makeBoard(), "backlog", { prompt: "T", baseRef: "main" });
		const card = board.columns[0]!.cards.find((c) => c.id === task.id)!;
		expect(getCardLabels(board, card)).toHaveLength(0);
	});

	it("returns resolved labels for a card", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const card = b3.columns[0]!.cards.find((c) => c.id === task.id)!;
		const labels = getCardLabels(b3, card);
		expect(labels).toHaveLength(1);
		expect(labels[0]?.id).toBe(label.id);
	});
});

// ─── getLabelUsageCount ───────────────────────────────────────────────────────

describe("getLabelUsageCount", () => {
	it("returns 0 when no cards have the label", () => {
		const { board, label } = addBoardLabel(makeBoard(), "Bug", "red");
		expect(getLabelUsageCount(board, label.id)).toBe(0);
	});

	it("counts cards across all columns", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const { board: b3 } = addTaskToColumnWithResult(b2, "review", { prompt: "T2", baseRef: "main" });
		const id1 = b3.columns.find((c) => c.id === "backlog")!.cards[0]!.id;
		const id2 = b3.columns.find((c) => c.id === "review")!.cards[0]!.id;
		const { board: b4 } = addLabelToCard(b3, id1, label.id);
		const { board: b5 } = addLabelToCard(b4, id2, label.id);
		expect(getLabelUsageCount(b5, label.id)).toBe(2);
	});
});

// ─── getCardsWithLabel ────────────────────────────────────────────────────────

describe("getCardsWithLabel", () => {
	it("returns cards from all columns that have the label", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const { board: b3 } = addTaskToColumnWithResult(b2, "review", { prompt: "T2", baseRef: "main" });
		const id1 = b3.columns.find((c) => c.id === "backlog")!.cards[0]!.id;
		const id2 = b3.columns.find((c) => c.id === "review")!.cards[0]!.id;
		const { board: b4 } = addLabelToCard(b3, id1, label.id);
		const { board: b5 } = addLabelToCard(b4, id2, label.id);
		const cards = getCardsWithLabel(b5, label.id);
		expect(cards.map((c) => c.id).sort()).toEqual([id1, id2].sort());
	});

	it("returns empty array when no cards have the label", () => {
		const { board, label } = addBoardLabel(makeBoard(), "Bug", "red");
		expect(getCardsWithLabel(board, label.id)).toHaveLength(0);
	});
});

// ─── sortLabelsByName ─────────────────────────────────────────────────────────

describe("sortLabelsByName", () => {
	it("sorts labels alphabetically by name", () => {
		let board = makeBoard();
		const ra = addBoardLabel(board, "Zeta", "red");
		const rb = addBoardLabel(ra.board, "Alpha", "blue");
		const rc = addBoardLabel(rb.board, "Mu", "green");
		board = rc.board;
		const sorted = sortLabelsByName(board.labels);
		expect(sorted.map((l) => l.name)).toEqual(["Alpha", "Mu", "Zeta"]);
	});

	it("does not mutate the original array", () => {
		const { board, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const original = board.labels;
		sortLabelsByName(board.labels);
		expect(board.labels).toBe(original);
		expect(board.labels[0]).toBe(label);
	});

	it("returns empty array unchanged", () => {
		expect(sortLabelsByName([])).toHaveLength(0);
	});
});

// ─── filterBoardByLabel ───────────────────────────────────────────────────────

describe("filterBoardByLabel", () => {
	it("returns a board with only cards that have the label", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const { board: b3 } = addTaskToColumnWithResult(b2, "backlog", { prompt: "T2", baseRef: "main" });
		const id1 = b3.columns[0]!.cards[0]!.id;
		const { board: b4 } = addLabelToCard(b3, id1, label.id);
		const filtered = filterBoardByLabel(b4, label.id);
		expect(filtered.columns[0]?.cards).toHaveLength(1);
		expect(filtered.columns[0]?.cards[0]?.id).toBe(id1);
	});

	it("does not mutate the source board", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const id1 = b2.columns[0]!.cards[0]!.id;
		const { board: b3 } = addLabelToCard(b2, id1, label.id);
		filterBoardByLabel(b3, label.id);
		expect(b3.columns[0]?.cards).toHaveLength(1);
	});

	it("preserves labels and dependencies on the returned board", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const filtered = filterBoardByLabel(b1, label.id);
		expect(filtered.labels).toHaveLength(1);
		expect(filtered.dependencies).toBeDefined();
	});
});

// ─── getUnlabeledCards ────────────────────────────────────────────────────────

describe("getUnlabeledCards", () => {
	it("returns cards with no labels from all columns", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const { board: b3 } = addTaskToColumnWithResult(b2, "review", { prompt: "T2", baseRef: "main" });
		const id1 = b3.columns.find((c) => c.id === "backlog")!.cards[0]!.id;
		const { board: b4 } = addLabelToCard(b3, id1, label.id);
		const unlabeled = getUnlabeledCards(b4);
		expect(unlabeled.map((c) => c.id)).not.toContain(id1);
		const id2 = b3.columns.find((c) => c.id === "review")!.cards[0]!.id;
		expect(unlabeled.map((c) => c.id)).toContain(id2);
	});

	it("returns all cards when no labels are assigned", () => {
		const { board: b1 } = addTaskToColumnWithResult(makeBoard(), "backlog", { prompt: "T", baseRef: "main" });
		expect(getUnlabeledCards(b1)).toHaveLength(1);
	});
});

// ─── getLabelDistribution ─────────────────────────────────────────────────────

describe("getLabelDistribution", () => {
	it("returns zero for all labels when no cards are labeled", () => {
		let board = makeBoard();
		const r1 = addBoardLabel(board, "Bug", "red");
		const r2 = addBoardLabel(r1.board, "Feature", "blue");
		board = r2.board;
		const dist = getLabelDistribution(board);
		expect(dist[r1.label.id]).toBe(0);
		expect(dist[r2.label.id]).toBe(0);
	});

	it("counts correctly when cards have labels", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const { board: b3 } = addTaskToColumnWithResult(b2, "backlog", { prompt: "T2", baseRef: "main" });
		const id1 = b3.columns[0]!.cards[0]!.id;
		const id2 = b3.columns[0]!.cards[1]!.id;
		const { board: b4 } = addLabelToCard(b3, id1, label.id);
		const { board: b5 } = addLabelToCard(b4, id2, label.id);
		const dist = getLabelDistribution(b5);
		expect(dist[label.id]).toBe(2);
	});

	it("includes all board labels as keys even if count is zero", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const dist = getLabelDistribution(b1);
		expect(Object.keys(dist)).toContain(label.id);
	});
});
