/**
 * New tests — card priority on board state.
 * These tests must FAIL on the base codebase and PASS on the solution.
 */
import { describe, expect, it } from "vitest";

import { createInitialBoardData } from "@/data/board-data";
import {
	addTaskToColumnWithResult,
	clearCardPriority,
	normalizeBoardData,
	setCardPriority,
	type TaskDraft,
	updateTask,
	updateTaskTitle,
	applyTaskDetailClineSettingsSelection,
	disableTaskAutoReview,
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

function addCard(board: ReturnType<typeof makeBoard>, priority?: TaskDraft["priority"], column = "backlog" as const) {
	const draft = makeDraft({ priority });
	return addTaskToColumnWithResult(board, column, draft);
}

// ─── normalizeBoardData — priority normalization ───────────────────────────

describe("normalizeBoardData — priority normalization", () => {
	it("preserves a valid priority on a card", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", priority: "high" }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.priority).toBe("high");
	});

	it("preserves all valid priority values", () => {
		for (const p of ["low", "medium", "high", "critical"]) {
			const raw = {
				columns: [{ id: "backlog", cards: [{ id: "t1", prompt: "Task", baseRef: "main", priority: p }] }],
			};
			const board = normalizeBoardData(raw);
			expect(board!.columns[0]?.cards[0]?.priority).toBe(p);
		}
	});

	it("drops an invalid priority string", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", priority: "urgent" }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.priority).toBeUndefined();
	});

	it("drops a non-string priority", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main", priority: 3 }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.priority).toBeUndefined();
	});

	it("omits priority when absent", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [{ id: "t1", prompt: "Task", baseRef: "main" }],
				},
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.columns[0]?.cards[0]?.priority).toBeUndefined();
	});
});

// ─── addTaskToColumnWithResult — priority from draft ─────────────────────

describe("addTaskToColumnWithResult — priority from draft", () => {
	it("attaches a valid priority from draft to the created task", () => {
		const board = makeBoard();
		const { task } = addCard(board, "high");
		expect(task.priority).toBe("high");
	});

	it("omits priority when draft has none", () => {
		const board = makeBoard();
		const { task } = addCard(board);
		expect(task.priority).toBeUndefined();
	});

	it("omits priority when draft priority is null", () => {
		const board = makeBoard();
		const { task } = addCard(board, null);
		expect(task.priority).toBeUndefined();
	});
});

// ─── setCardPriority ───────────────────────────────────────────────────────

describe("setCardPriority", () => {
	it("sets priority on an existing card", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const b2 = setCardPriority(b1, task.id, "critical");
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBe("critical");
	});

	it("replaces an existing priority", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "low");
		const b2 = setCardPriority(b1, task.id, "high");
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBe("high");
	});

	it("no-ops on unknown taskId", () => {
		const board = makeBoard();
		const result = setCardPriority(board, "no-such-id", "high");
		expect(result).toEqual(board);
	});
});

// ─── clearCardPriority ────────────────────────────────────────────────────

describe("clearCardPriority", () => {
	it("removes priority from a card that has one", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "critical");
		const b2 = clearCardPriority(b1, task.id);
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBeUndefined();
	});

	it("no-ops on a card without a priority", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const b2 = clearCardPriority(b1, task.id);
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBeUndefined();
	});

	it("no-ops on unknown taskId", () => {
		const board = makeBoard();
		const result = clearCardPriority(board, "no-such-id");
		expect(result).toEqual(board);
	});
});

// ─── updateTask — priority three-way merge ────────────────────────────────

describe("updateTask — priority three-way merge", () => {
	it("preserves priority when draft.priority is undefined", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "high");
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ priority: undefined }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBe("high");
	});

	it("clears priority when draft.priority is null", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "high");
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ priority: null }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBeUndefined();
	});

	it("sets priority when draft.priority is a valid string", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board);
		const { board: b2 } = updateTask(b1, task.id, makeDraft({ priority: "medium" }));
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBe("medium");
	});
});

// ─── round-trip tests ─────────────────────────────────────────────────────

describe("updateTaskTitle — round-trips priority", () => {
	it("preserves priority when updating the title", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "critical");
		const { board: b2 } = updateTaskTitle(b1, task.id, "New title");
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBe("critical");
	});
});

describe("disableTaskAutoReview — round-trips priority", () => {
	it("preserves priority when disabling auto-review", () => {
		const board = makeBoard();
		const { task, board: b1 } = addCard(board, "medium");
		const b2 = setCardPriority(b1, task.id, "medium");
		const { board: b3 } = disableTaskAutoReview(b2, task.id);
		const card = b3.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.priority).toBe("medium");
	});
});
