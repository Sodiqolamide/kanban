/**
 * New tests — card-due-dates utility functions.
 * These tests must FAIL on the base codebase and PASS on the solution.
 */
import { describe, expect, it } from "vitest";

import { createInitialBoardData } from "@/data/board-data";
import { addTaskToColumnWithResult } from "@/state/board-state";
import type { BoardCard } from "@/types";
import {
	getCardsDueBefore,
	getCardsDueOnOrAfter,
	getCardsWithDueDate,
	getNearestDueDate,
	getOverdueCards,
	getUnscheduledCards,
	isOverdue,
	sortCardsByDueDate,
} from "@/utils/card-due-dates";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBoard() {
	return createInitialBoardData();
}

function addCard(board: ReturnType<typeof makeBoard>, dueDate?: number) {
	const result = addTaskToColumnWithResult(board, "backlog", {
		prompt: "Task",
		baseRef: "main",
		dueDate,
	});
	return result;
}

function cardWith(dueDate?: number): BoardCard {
	return {
		id: "x",
		title: "T",
		prompt: "p",
		startInPlanMode: false,
		autoReviewEnabled: false,
		autoReviewMode: "commit",
		baseRef: "main",
		createdAt: 0,
		updatedAt: 0,
		...(dueDate !== undefined ? { dueDate } : {}),
	};
}

const NOW = 1_000_000;

// ─── isOverdue ────────────────────────────────────────────────────────────

describe("isOverdue", () => {
	it("returns true when dueDate is before now", () => {
		expect(isOverdue(cardWith(NOW - 1), NOW)).toBe(true);
	});

	it("returns false when dueDate equals now", () => {
		expect(isOverdue(cardWith(NOW), NOW)).toBe(false);
	});

	it("returns false when dueDate is after now", () => {
		expect(isOverdue(cardWith(NOW + 1), NOW)).toBe(false);
	});

	it("returns false when card has no dueDate", () => {
		expect(isOverdue(cardWith(), NOW)).toBe(false);
	});
});

// ─── getOverdueCards ──────────────────────────────────────────────────────

describe("getOverdueCards", () => {
	it("returns only overdue cards", () => {
		let board = makeBoard();
		const r1 = addCard(board, NOW - 100);
		board = r1.board;
		const r2 = addCard(board, NOW + 100);
		board = r2.board;
		const r3 = addCard(board);
		board = r3.board;

		const overdue = getOverdueCards(board, NOW);
		expect(overdue).toHaveLength(1);
		expect(overdue[0]?.id).toBe(r1.task.id);
	});

	it("returns empty array when no cards are overdue", () => {
		const board = makeBoard();
		expect(getOverdueCards(board, NOW)).toHaveLength(0);
	});
});

// ─── getCardsWithDueDate ──────────────────────────────────────────────────

describe("getCardsWithDueDate", () => {
	it("returns only cards that have a dueDate", () => {
		let board = makeBoard();
		const r1 = addCard(board, 500_000);
		board = r1.board;
		const r2 = addCard(board);
		board = r2.board;

		const withDue = getCardsWithDueDate(board);
		expect(withDue).toHaveLength(1);
		expect(withDue[0]?.id).toBe(r1.task.id);
	});

	it("returns empty array when no cards have a dueDate", () => {
		const board = makeBoard();
		expect(getCardsWithDueDate(board)).toHaveLength(0);
	});
});

// ─── getUnscheduledCards ──────────────────────────────────────────────────

describe("getUnscheduledCards", () => {
	it("returns only cards without a dueDate", () => {
		let board = makeBoard();
		const r1 = addCard(board, 500_000);
		board = r1.board;
		const r2 = addCard(board);
		board = r2.board;

		const unscheduled = getUnscheduledCards(board);
		expect(unscheduled).toHaveLength(1);
		expect(unscheduled[0]?.id).toBe(r2.task.id);
	});

	it("returns all cards when none have a dueDate", () => {
		let board = makeBoard();
		board = addCard(board).board;
		board = addCard(board).board;
		expect(getUnscheduledCards(board)).toHaveLength(2);
	});
});

// ─── getCardsDueBefore ────────────────────────────────────────────────────

describe("getCardsDueBefore", () => {
	it("returns cards with dueDate strictly before timestamp", () => {
		let board = makeBoard();
		const r1 = addCard(board, 100);
		board = r1.board;
		const r2 = addCard(board, 200);
		board = r2.board;
		const r3 = addCard(board, 300);
		board = r3.board;

		const result = getCardsDueBefore(board, 250);
		const ids = result.map((c) => c.id);
		expect(ids).toContain(r1.task.id);
		expect(ids).toContain(r2.task.id);
		expect(ids).not.toContain(r3.task.id);
	});

	it("excludes cards without a dueDate", () => {
		let board = makeBoard();
		board = addCard(board).board;
		expect(getCardsDueBefore(board, 999_999_999)).toHaveLength(0);
	});

	it("excludes cards where dueDate equals the timestamp", () => {
		let board = makeBoard();
		const r1 = addCard(board, 500);
		board = r1.board;
		expect(getCardsDueBefore(board, 500)).toHaveLength(0);
	});
});

// ─── getCardsDueOnOrAfter ─────────────────────────────────────────────────

describe("getCardsDueOnOrAfter", () => {
	it("returns cards with dueDate >= timestamp", () => {
		let board = makeBoard();
		const r1 = addCard(board, 100);
		board = r1.board;
		const r2 = addCard(board, 200);
		board = r2.board;
		const r3 = addCard(board, 300);
		board = r3.board;

		const result = getCardsDueOnOrAfter(board, 200);
		const ids = result.map((c) => c.id);
		expect(ids).not.toContain(r1.task.id);
		expect(ids).toContain(r2.task.id);
		expect(ids).toContain(r3.task.id);
	});

	it("excludes cards without a dueDate", () => {
		let board = makeBoard();
		board = addCard(board).board;
		expect(getCardsDueOnOrAfter(board, 0)).toHaveLength(0);
	});
});

// ─── sortCardsByDueDate ───────────────────────────────────────────────────

describe("sortCardsByDueDate", () => {
	it("sorts ascending by default (earliest first)", () => {
		const cards = [cardWith(300), cardWith(100), cardWith(200)];
		const sorted = sortCardsByDueDate(cards);
		expect(sorted.map((c) => c.dueDate)).toEqual([100, 200, 300]);
	});

	it("sorts descending when direction is desc", () => {
		const cards = [cardWith(100), cardWith(300), cardWith(200)];
		const sorted = sortCardsByDueDate(cards, "desc");
		expect(sorted.map((c) => c.dueDate)).toEqual([300, 200, 100]);
	});

	it("places cards without dueDate at the end regardless of direction", () => {
		const cards = [cardWith(), cardWith(200), cardWith()];
		const asc = sortCardsByDueDate(cards, "asc");
		expect(asc[0]?.dueDate).toBe(200);
		expect(asc[1]?.dueDate).toBeUndefined();
		expect(asc[2]?.dueDate).toBeUndefined();

		const desc = sortCardsByDueDate(cards, "desc");
		expect(desc[0]?.dueDate).toBe(200);
		expect(desc[1]?.dueDate).toBeUndefined();
		expect(desc[2]?.dueDate).toBeUndefined();
	});

	it("does not mutate the input array", () => {
		const cards = [cardWith(300), cardWith(100)];
		const copy = [...cards];
		sortCardsByDueDate(cards);
		expect(cards[0]?.dueDate).toBe(copy[0]?.dueDate);
		expect(cards[1]?.dueDate).toBe(copy[1]?.dueDate);
	});
});

// ─── getNearestDueDate ────────────────────────────────────────────────────

describe("getNearestDueDate", () => {
	it("returns the smallest dueDate across all cards", () => {
		let board = makeBoard();
		board = addCard(board, 500).board;
		board = addCard(board, 200).board;
		board = addCard(board, 800).board;
		expect(getNearestDueDate(board)).toBe(200);
	});

	it("returns null when no cards have a dueDate", () => {
		let board = makeBoard();
		board = addCard(board).board;
		expect(getNearestDueDate(board)).toBeNull();
	});

	it("returns null for an empty board", () => {
		expect(getNearestDueDate(makeBoard())).toBeNull();
	});

	it("ignores cards without dueDate when others have one", () => {
		let board = makeBoard();
		board = addCard(board).board;
		board = addCard(board, 999).board;
		expect(getNearestDueDate(board)).toBe(999);
	});
});
