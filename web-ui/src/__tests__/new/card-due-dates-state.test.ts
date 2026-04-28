/**
 * New tests — card due dates on board state.
 * These tests must FAIL on the base codebase and PASS on the solution.
 */
import { describe, expect, it } from "vitest";

import { createInitialBoardData } from "@/data/board-data";
import {
	addTaskToColumnWithResult,
	applyTaskDetailClineSettingsSelection,
	clearCardDueDate,
	disableTaskAutoReview,
	normalizeBoardData,
	setCardDueDate,
	type TaskDraft,
	updateTask,
	updateTaskTitle,
} from "@/state/board-state";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBoard() {
	return createInitialBoardData();
}

function makeDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
	return {
		prompt: "Do something",
		baseRef: "main",
		...overrides,
	};
}

function addCard(board: ReturnType<typeof makeBoard>, dueDate?: number) {
	const draft = makeDraft({ dueDate });
	return addTaskToColumnWithResult(board, "backlog", draft);
}

// ─── normalizeBoardData — dueDate normalization ────────────────────────────

describe("normalizeBoardData — dueDate normalization", () => {
	it("preserves a positive dueDate on a card", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", dueDate: 1_000_000 }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.dueDate).toBe(1_000_000);
	});

	it("drops a dueDate of zero", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", dueDate: 0 }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.dueDate).toBeUndefined();
	});

	it("drops a negative dueDate", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", dueDate: -500 }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.dueDate).toBeUndefined();
	});

	it("drops a non-numeric dueDate", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", dueDate: "tomorrow" }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.dueDate).toBeUndefined();
	});

	it("omits dueDate when absent", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main" }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.dueDate).toBeUndefined();
	});
});

// ─── addTaskToColumnWithResult — dueDate from draft ───────────────────────

describe("addTaskToColumnWithResult — dueDate from draft", () => {
	it("attaches a positive dueDate from draft to the created task", () => {
		const board = makeBoard();
		const { task, board: newBoard } = addCard(board, 9_000_000);
		expect(task.dueDate).toBe(9_000_000);
		const stored = newBoard.columns[0]?.cards.find((c) => c.id === task.id);
		expect(stored?.dueDate).toBe(9_000_000);
	});

	it("omits dueDate when draft.dueDate is undefined", () => {
		const board = makeBoard();
		const { task } = addCard(board);
		expect(task.dueDate).toBeUndefined();
	});

	it("omits dueDate when draft.dueDate is zero", () => {
		const board = makeBoard();
		const { task } = addCard(board, 0);
		expect(task.dueDate).toBeUndefined();
	});

	it("omits dueDate when draft.dueDate is negative", () => {
		const board = makeBoard();
		const { task } = addCard(board, -1);
		expect(task.dueDate).toBeUndefined();
	});
});

// ─── setCardDueDate ────────────────────────────────────────────────────────

describe("setCardDueDate", () => {
	it("sets dueDate on an existing card", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const b2 = setCardDueDate(b1, task.id, 5_000_000);
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(5_000_000);
	});

	it("replaces an existing dueDate", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 1_000_000);
		const b2 = setCardDueDate(b1, task.id, 2_000_000);
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(2_000_000);
	});

	it("no-ops on unknown taskId", () => {
		const board = makeBoard();
		const result = setCardDueDate(board, "no-such-id", 5_000_000);
		expect(result).toEqual(board);
	});

	it("no-ops when dueDate is zero", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const b2 = setCardDueDate(b1, task.id, 0);
		expect(b2).toEqual(b1);
	});

	it("no-ops when dueDate is negative", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const b2 = setCardDueDate(b1, task.id, -1);
		expect(b2).toEqual(b1);
	});
});

// ─── clearCardDueDate ─────────────────────────────────────────────────────

describe("clearCardDueDate", () => {
	it("removes dueDate from a card that has one", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 5_000_000);
		const b2 = clearCardDueDate(b1, task.id);
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBeUndefined();
	});

	it("no-ops on a card without a dueDate", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const b2 = clearCardDueDate(b1, task.id);
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBeUndefined();
	});

	it("no-ops on unknown taskId", () => {
		const board = makeBoard();
		const result = clearCardDueDate(board, "no-such-id");
		expect(result).toEqual(board);
	});
});

// ─── updateTask — dueDate three-way merge ─────────────────────────────────

describe("updateTask — dueDate three-way merge", () => {
	it("preserves dueDate when draft.dueDate is undefined", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 5_000_000);
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ dueDate: undefined }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(5_000_000);
	});

	it("clears dueDate when draft.dueDate is null", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 5_000_000);
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ dueDate: null }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBeUndefined();
	});

	it("sets dueDate when draft.dueDate is a positive number", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ dueDate: 7_000_000 }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(7_000_000);
	});

	it("clears dueDate when draft.dueDate is zero", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 5_000_000);
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ dueDate: 0 }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBeUndefined();
	});

	it("clears dueDate when draft.dueDate is negative", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 5_000_000);
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ dueDate: -1 }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBeUndefined();
	});
});

// ─── Round-trip tests ─────────────────────────────────────────────────────

describe("updateTaskTitle — round-trips dueDate", () => {
	it("preserves dueDate when updating the title", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 8_000_000);
		const { board: b2 } = updateTaskTitle(b1, task.id, "New Title");
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(8_000_000);
	});
});

describe("applyTaskDetailClineSettingsSelection — round-trips dueDate", () => {
	it("preserves dueDate when applying cline settings", () => {
		const _board = makeBoard();
		const { task, board: b1 } = addTaskToColumnWithResult(makeBoard(), "backlog", {
			prompt: "task",
			baseRef: "main",
			agentId: "cline",
			dueDate: 3_000_000,
		});
		const b2Board = b1;
		const { board: b3 } = applyTaskDetailClineSettingsSelection(b2Board, task.id, {
			agentId: "cline",
			clineSettings: undefined,
		});
		const card = b3.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(3_000_000);
	});
});

describe("disableTaskAutoReview — round-trips dueDate", () => {
	it("preserves dueDate when disabling auto-review", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, 4_000_000);
		const b2 = setCardDueDate(b1, task.id, 4_000_000);
		const { board: b3 } = disableTaskAutoReview(b2, task.id);
		const card = b3.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.dueDate).toBe(4_000_000);
	});
});
