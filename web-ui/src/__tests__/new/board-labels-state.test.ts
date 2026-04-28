/**
 * New tests — verify the board labels state operations.
 * These tests must all FAIL on the base code and PASS after the solution is applied.
 */
import { describe, expect, it } from "vitest";

import { createInitialBoardData } from "@/data/board-data";
import {
	addBoardLabel,
	addLabelToCard,
	addTaskToColumnWithResult,
	applyTaskDetailClineSettingsSelection,
	disableTaskAutoReview,
	normalizeBoardData,
	removeBoardLabel,
	removeLabelFromCard,
	setCardLabels,
	updateBoardLabel,
	updateTask,
	updateTaskTitle,
} from "@/state/board-state";
import type { BoardData } from "@/types";
import { BOARD_LABEL_NAME_MAX_LENGTH, BOARD_MAX_LABELS, CARD_MAX_LABELS } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeBoard(): BoardData {
	return createInitialBoardData();
}

function _boardWithLabel(name = "Bug", color = "red" as const) {
	return addBoardLabel(makeBoard(), name, color);
}

function _cardInBacklog(board: BoardData, _id = "t1") {
	return addTaskToColumnWithResult(board, "backlog", {
		prompt: "task",
		baseRef: "main",
	});
}

// ─── exported constants ───────────────────────────────────────────────────────

describe("exported constants", () => {
	it("BOARD_MAX_LABELS is 100", () => {
		expect(BOARD_MAX_LABELS).toBe(100);
	});

	it("CARD_MAX_LABELS is 20", () => {
		expect(CARD_MAX_LABELS).toBe(20);
	});

	it("BOARD_LABEL_NAME_MAX_LENGTH is 50", () => {
		expect(BOARD_LABEL_NAME_MAX_LENGTH).toBe(50);
	});
});

// ─── createInitialBoardData — labels ─────────────────────────────────────────

describe("createInitialBoardData — labels", () => {
	it("empty-initializes labels", () => {
		expect(makeBoard().labels).toEqual([]);
	});
});

// ─── normalizeBoardData — labels ─────────────────────────────────────────────

describe("normalizeBoardData — label normalization", () => {
	it("preserves valid labels through normalization", () => {
		const raw = {
			columns: [],
			labels: [{ id: "l1", name: "Bug", color: "red", createdAt: 1 }],
		};
		const board = normalizeBoardData(raw);
		expect(board).not.toBeNull();
		expect(board!.labels).toHaveLength(1);
		expect(board!.labels[0]?.id).toBe("l1");
	});

	it("drops a label with an invalid color", () => {
		const raw = {
			columns: [],
			labels: [
				{ id: "l1", name: "Bug", color: "red", createdAt: 1 },
				{ id: "l2", name: "Bad", color: "neon-pink", createdAt: 2 },
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.labels).toHaveLength(1);
		expect(board!.labels[0]?.id).toBe("l1");
	});

	it("drops a label with an empty name", () => {
		const raw = {
			columns: [],
			labels: [{ id: "l1", name: "  ", color: "blue", createdAt: 1 }],
		};
		const board = normalizeBoardData(raw);
		expect(board!.labels).toHaveLength(0);
	});

	it("truncates a label name longer than 50 characters", () => {
		const longName = "x".repeat(80);
		const raw = {
			columns: [],
			labels: [{ id: "l1", name: longName, color: "green", createdAt: 1 }],
		};
		const board = normalizeBoardData(raw);
		expect(board!.labels[0]?.name).toHaveLength(50);
	});

	it("deduplicates labels by id — last occurrence wins", () => {
		const raw = {
			columns: [],
			labels: [
				{ id: "l1", name: "First", color: "red", createdAt: 1 },
				{ id: "l1", name: "Second", color: "blue", createdAt: 2 },
			],
		};
		const board = normalizeBoardData(raw);
		expect(board!.labels).toHaveLength(1);
		expect(board!.labels[0]?.name).toBe("Second");
	});

	it("caps labels at BOARD_MAX_LABELS", () => {
		const labels = Array.from({ length: BOARD_MAX_LABELS + 10 }, (_, i) => ({
			id: `l${i}`,
			name: `Label ${i}`,
			color: "gray",
			createdAt: i,
		}));
		const raw = { columns: [], labels };
		const board = normalizeBoardData(raw);
		expect(board!.labels).toHaveLength(BOARD_MAX_LABELS);
	});

	it("prunes orphaned labelIds from cards after label normalization", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [
						{
							id: "t1",
							title: "T1",
							prompt: "T1",
							baseRef: "main",
							labelIds: ["l1", "missing"],
						},
					],
				},
			],
			labels: [{ id: "l1", name: "Bug", color: "red", createdAt: 1 }],
		};
		const board = normalizeBoardData(raw);
		const card = board!.columns[0]?.cards[0];
		expect(card?.labelIds).toEqual(["l1"]);
	});

	it("sets labelIds to undefined when all labelIds are orphaned", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [
						{
							id: "t1",
							title: "T1",
							prompt: "T1",
							baseRef: "main",
							labelIds: ["missing1", "missing2"],
						},
					],
				},
			],
			labels: [],
		};
		const board = normalizeBoardData(raw);
		const card = board!.columns[0]?.cards[0];
		expect(card?.labelIds).toBeUndefined();
	});

	it("deduplicates labelIds on cards", () => {
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [
						{
							id: "t1",
							title: "T1",
							prompt: "T1",
							baseRef: "main",
							labelIds: ["l1", "l1", "l1"],
						},
					],
				},
			],
			labels: [{ id: "l1", name: "Bug", color: "red", createdAt: 1 }],
		};
		const board = normalizeBoardData(raw);
		const card = board!.columns[0]?.cards[0];
		expect(card?.labelIds).toEqual(["l1"]);
	});

	it("caps labelIds per card at CARD_MAX_LABELS during normalization", () => {
		const labels = Array.from({ length: CARD_MAX_LABELS + 5 }, (_, i) => ({
			id: `l${i}`,
			name: `L${i}`,
			color: "gray" as const,
			createdAt: i,
		}));
		const raw = {
			columns: [
				{
					id: "backlog",
					cards: [
						{
							id: "t1",
							title: "T",
							prompt: "T",
							baseRef: "main",
							labelIds: labels.map((l) => l.id),
						},
					],
				},
			],
			labels,
		};
		const board = normalizeBoardData(raw);
		const card = board!.columns[0]?.cards[0];
		expect(card?.labelIds).toHaveLength(CARD_MAX_LABELS);
	});
});

// ─── addBoardLabel ────────────────────────────────────────────────────────────

describe("addBoardLabel", () => {
	it("adds a label and returns it", () => {
		const { board, label } = addBoardLabel(makeBoard(), "Bug", "red");
		expect(board.labels).toHaveLength(1);
		expect(label.name).toBe("Bug");
		expect(label.color).toBe("red");
		expect(typeof label.id).toBe("string");
		expect(label.id.length).toBeGreaterThan(0);
	});

	it("returns added: false for an empty name", () => {
		const result = addBoardLabel(makeBoard(), "  ", "red");
		expect(result.added).toBe(false);
		expect(result.board.labels).toHaveLength(0);
	});

	it("returns added: false for an invalid color", () => {
		// @ts-expect-error intentional invalid color
		const result = addBoardLabel(makeBoard(), "Bug", "neon");
		expect(result.added).toBe(false);
	});

	it("returns added: false when board already has BOARD_MAX_LABELS labels", () => {
		let board = makeBoard();
		for (let i = 0; i < BOARD_MAX_LABELS; i++) {
			const r = addBoardLabel(board, `Label ${i}`, "gray");
			board = r.board;
		}
		const result = addBoardLabel(board, "One more", "blue");
		expect(result.added).toBe(false);
		expect(result.board.labels).toHaveLength(BOARD_MAX_LABELS);
	});

	it("truncates a name longer than 50 characters", () => {
		const { label } = addBoardLabel(makeBoard(), "x".repeat(80), "green");
		expect(label.name).toHaveLength(50);
	});

	it("trims whitespace from names", () => {
		const { label } = addBoardLabel(makeBoard(), "  Bug  ", "purple");
		expect(label.name).toBe("Bug");
	});
});

// ─── removeBoardLabel ─────────────────────────────────────────────────────────

describe("removeBoardLabel", () => {
	it("removes a label from the board", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = removeBoardLabel(b1, label.id);
		expect(b2.labels).toHaveLength(0);
	});

	it("cascades removal to cards that reference the label", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const taskId = b2.columns[0]!.cards[0]!.id;
		const { board: b3 } = addLabelToCard(b2, taskId, label.id);
		const b4 = removeBoardLabel(b3, label.id);
		const card = b4.columns[0]?.cards[0];
		expect(card?.labelIds).toBeUndefined();
	});

	it("sets labelIds to undefined when last label is removed from a card", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const taskId = b2.columns[0]!.cards[0]!.id;
		const { board: b3 } = addLabelToCard(b2, taskId, label.id);
		const b4 = removeBoardLabel(b3, label.id);
		const card = b4.columns[0]?.cards[0];
		expect(card?.labelIds).toBeUndefined();
	});

	it("is a no-op for a non-existent label id", () => {
		const { board: b1 } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = removeBoardLabel(b1, "does-not-exist");
		expect(b2.labels).toHaveLength(1);
	});

	it("cascades across all columns", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2 } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T1", baseRef: "main" });
		const { board: b3 } = addTaskToColumnWithResult(b2, "review", { prompt: "T2", baseRef: "main" });
		const id1 = b3.columns.find((c) => c.id === "backlog")!.cards[0]!.id;
		const id2 = b3.columns.find((c) => c.id === "review")!.cards[0]!.id;
		const { board: b4 } = addLabelToCard(b3, id1, label.id);
		const { board: b5 } = addLabelToCard(b4, id2, label.id);
		const b6 = removeBoardLabel(b5, label.id);
		expect(b6.columns.find((c) => c.id === "backlog")!.cards[0]?.labelIds).toBeUndefined();
		expect(b6.columns.find((c) => c.id === "review")!.cards[0]?.labelIds).toBeUndefined();
	});
});

// ─── updateBoardLabel ─────────────────────────────────────────────────────────

describe("updateBoardLabel", () => {
	it("updates the label name", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = updateBoardLabel(b1, label.id, { name: "Feature" });
		expect(b2.labels[0]?.name).toBe("Feature");
	});

	it("updates the label color", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = updateBoardLabel(b1, label.id, { color: "blue" });
		expect(b2.labels[0]?.color).toBe("blue");
	});

	it("is a no-op for a non-existent label id", () => {
		const { board: b1 } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = updateBoardLabel(b1, "not-here", { name: "X" });
		expect(b2.labels[0]?.name).toBe("Bug");
	});

	it("rejects an empty name update", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = updateBoardLabel(b1, label.id, { name: "   " });
		expect(b2.labels[0]?.name).toBe("Bug");
	});

	it("rejects an invalid color update", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		// @ts-expect-error intentional invalid color
		const b2 = updateBoardLabel(b1, label.id, { color: "magenta" });
		expect(b2.labels[0]?.color).toBe("red");
	});

	it("truncates name to 50 characters", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = updateBoardLabel(b1, label.id, { name: "z".repeat(60) });
		expect(b2.labels[0]?.name).toHaveLength(50);
	});
});

// ─── addLabelToCard ───────────────────────────────────────────────────────────

describe("addLabelToCard", () => {
	it("adds a label to a card and returns added: true", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3, added } = addLabelToCard(b2, task.id, label.id);
		expect(added).toBe(true);
		expect(b3.columns[0]?.cards[0]?.labelIds).toContain(label.id);
	});

	it("is idempotent — returns added: false when label already present", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const { board: b4, added } = addLabelToCard(b3, task.id, label.id);
		expect(added).toBe(false);
		expect(b4.columns[0]?.cards[0]?.labelIds?.filter((id) => id === label.id)).toHaveLength(1);
	});

	it("returns added: false when the label does not exist on the board", () => {
		const { board: b1, task } = addTaskToColumnWithResult(makeBoard(), "backlog", {
			prompt: "T",
			baseRef: "main",
		});
		const { added } = addLabelToCard(b1, task.id, "ghost");
		expect(added).toBe(false);
	});

	it("returns added: false when the task does not exist", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { added } = addLabelToCard(b1, "no-such-task", label.id);
		expect(added).toBe(false);
	});

	it("enforces CARD_MAX_LABELS per card", () => {
		let board = makeBoard();
		const labelIds: string[] = [];
		for (let i = 0; i <= CARD_MAX_LABELS; i++) {
			const r = addBoardLabel(board, `L${i}`, "gray");
			board = r.board;
			labelIds.push(r.label.id);
		}
		const { board: b2, task } = addTaskToColumnWithResult(board, "backlog", { prompt: "T", baseRef: "main" });
		let b = b2;
		for (const id of labelIds.slice(0, CARD_MAX_LABELS)) {
			const r = addLabelToCard(b, task.id, id);
			b = r.board;
		}
		const overflowId = labelIds[CARD_MAX_LABELS]!;
		const { added } = addLabelToCard(b, task.id, overflowId);
		expect(added).toBe(false);
		const card = b.columns[0]?.cards[0];
		expect(card?.labelIds).toHaveLength(CARD_MAX_LABELS);
	});
});

// ─── removeLabelFromCard ──────────────────────────────────────────────────────

describe("removeLabelFromCard", () => {
	it("removes a label and returns removed: true", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const { board: b4, removed } = removeLabelFromCard(b3, task.id, label.id);
		expect(removed).toBe(true);
		expect(b4.columns[0]?.cards[0]?.labelIds).toBeUndefined();
	});

	it("returns removed: false when label is not on the card", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const { removed } = removeLabelFromCard(b2, task.id, label.id);
		expect(removed).toBe(false);
	});

	it("returns removed: false when task does not exist", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { removed } = removeLabelFromCard(b1, "no-task", label.id);
		expect(removed).toBe(false);
	});

	it("preserves other labels on the card when one is removed", () => {
		let board = makeBoard();
		const r1 = addBoardLabel(board, "Bug", "red");
		const r2 = addBoardLabel(r1.board, "Feature", "blue");
		board = r2.board;
		const { board: b2, task } = addTaskToColumnWithResult(board, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, r1.label.id);
		const { board: b4 } = addLabelToCard(b3, task.id, r2.label.id);
		const { board: b5 } = removeLabelFromCard(b4, task.id, r1.label.id);
		expect(b5.columns[0]?.cards[0]?.labelIds).toEqual([r2.label.id]);
	});
});

// ─── setCardLabels ────────────────────────────────────────────────────────────

describe("setCardLabels", () => {
	it("replaces all labels on a card", () => {
		let board = makeBoard();
		const r1 = addBoardLabel(board, "Bug", "red");
		const r2 = addBoardLabel(r1.board, "Feature", "blue");
		board = r2.board;
		const { board: b2, task } = addTaskToColumnWithResult(board, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, r1.label.id);
		const b4 = setCardLabels(b3, task.id, [r2.label.id]);
		expect(b4.columns[0]?.cards[0]?.labelIds).toEqual([r2.label.id]);
	});

	it("silently drops non-existent label ids", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const b3 = setCardLabels(b2, task.id, [label.id, "ghost-id"]);
		expect(b3.columns[0]?.cards[0]?.labelIds).toEqual([label.id]);
	});

	it("sets labelIds to undefined when empty array is passed", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const b4 = setCardLabels(b3, task.id, []);
		expect(b4.columns[0]?.cards[0]?.labelIds).toBeUndefined();
	});

	it("is a no-op for a non-existent task id", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const b2 = setCardLabels(b1, "ghost-task", [label.id]);
		expect(b2.labels).toHaveLength(1);
	});

	it("deduplicates label ids in the input", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "T", baseRef: "main" });
		const b3 = setCardLabels(b2, task.id, [label.id, label.id, label.id]);
		expect(b3.columns[0]?.cards[0]?.labelIds).toEqual([label.id]);
	});
});

// ─── updateTask — labelIds handling ──────────────────────────────────────────

describe("updateTask — labelIds in TaskDraft", () => {
	it("preserves existing labelIds when draft.labelIds is undefined", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		// updateTask without labelIds → must preserve
		const { board: b4 } = updateTask(b3, task.id, {
			prompt: "Task updated",
			baseRef: "main",
		});
		expect(b4.columns[0]?.cards[0]?.labelIds).toContain(label.id);
	});

	it("clears labelIds when draft.labelIds is an empty array", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const { board: b4 } = updateTask(b3, task.id, {
			prompt: "Task updated",
			baseRef: "main",
			labelIds: [],
		});
		expect(b4.columns[0]?.cards[0]?.labelIds).toBeUndefined();
	});

	it("sets labelIds when a non-empty valid array is provided", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = updateTask(b2, task.id, {
			prompt: "Task updated",
			baseRef: "main",
			labelIds: [label.id],
		});
		expect(b3.columns[0]?.cards[0]?.labelIds).toEqual([label.id]);
	});

	it("silently drops non-existent label ids from the update", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = updateTask(b2, task.id, {
			prompt: "Task updated",
			baseRef: "main",
			labelIds: [label.id, "ghost"],
		});
		expect(b3.columns[0]?.cards[0]?.labelIds).toEqual([label.id]);
	});

	it("deduplicates labelIds in the update", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = updateTask(b2, task.id, {
			prompt: "Task updated",
			baseRef: "main",
			labelIds: [label.id, label.id, label.id],
		});
		expect(b3.columns[0]?.cards[0]?.labelIds).toEqual([label.id]);
	});

	it("caps labelIds at CARD_MAX_LABELS in the update", () => {
		let board = makeBoard();
		const labelIds: string[] = [];
		for (let i = 0; i <= CARD_MAX_LABELS; i++) {
			const r = addBoardLabel(board, `L${i}`, "gray");
			board = r.board;
			labelIds.push(r.label.id);
		}
		const { board: b2, task } = addTaskToColumnWithResult(board, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = updateTask(b2, task.id, {
			prompt: "Task updated",
			baseRef: "main",
			labelIds,
		});
		expect(b3.columns[0]?.cards[0]?.labelIds).toHaveLength(CARD_MAX_LABELS);
	});
});

// ─── addTaskToColumnWithResult — labelIds ────────────────────────────────────

describe("addTaskToColumnWithResult — labelIds in TaskDraft", () => {
	it("creates a card with no labelIds when draft has none", () => {
		const { board, task } = addTaskToColumnWithResult(makeBoard(), "backlog", {
			prompt: "T",
			baseRef: "main",
		});
		const card = board.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toBeUndefined();
	});

	it("creates a card with labelIds when valid label ids are provided in draft", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", {
			prompt: "T",
			baseRef: "main",
			labelIds: [label.id],
		});
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toEqual([label.id]);
	});

	it("silently drops non-existent label ids in draft", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", {
			prompt: "T",
			baseRef: "main",
			labelIds: [label.id, "ghost"],
		});
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toEqual([label.id]);
	});

	it("deduplicates labelIds from draft", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", {
			prompt: "T",
			baseRef: "main",
			labelIds: [label.id, label.id, label.id],
		});
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toEqual([label.id]);
	});

	it("caps labelIds at CARD_MAX_LABELS from draft", () => {
		let board = makeBoard();
		const labelIds: string[] = [];
		for (let i = 0; i <= CARD_MAX_LABELS; i++) {
			const r = addBoardLabel(board, `L${i}`, "gray");
			board = r.board;
			labelIds.push(r.label.id);
		}
		const { board: b2, task } = addTaskToColumnWithResult(board, "backlog", {
			prompt: "T",
			baseRef: "main",
			labelIds,
		});
		const card = b2.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toHaveLength(CARD_MAX_LABELS);
	});
});

// ─── updateTaskTitle — labelIds round-trip ────────────────────────────────────

describe("updateTaskTitle — labelIds round-trip", () => {
	it("preserves labelIds when updating the title", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const { board: b4, updated } = updateTaskTitle(b3, task.id, "New Title");
		expect(updated).toBe(true);
		const card = b4.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toContain(label.id);
	});
});

// ─── applyTaskDetailClineSettingsSelection — labelIds round-trip ──────────────

describe("applyTaskDetailClineSettingsSelection — labelIds round-trip", () => {
	it("preserves labelIds when updating cline settings", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", {
			prompt: "Task",
			baseRef: "main",
			agentId: "cline",
		});
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const { board: b4, updated } = applyTaskDetailClineSettingsSelection(b3, task.id, {
			agentId: "cline",
		});
		expect(updated).toBe(true);
		const card = b4.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toContain(label.id);
	});
});

// ─── disableTaskAutoReview — labelIds round-trip ──────────────────────────────

describe("disableTaskAutoReview — labelIds round-trip", () => {
	it("preserves labelIds when disabling auto-review", () => {
		const { board: b1, label } = addBoardLabel(makeBoard(), "Bug", "red");
		const { board: b2, task } = addTaskToColumnWithResult(b1, "backlog", { prompt: "Task", baseRef: "main" });
		const { board: b3 } = addLabelToCard(b2, task.id, label.id);
		const { board: b4, updated } = disableTaskAutoReview(b3, task.id);
		expect(updated).toBe(true);
		const card = b4.columns[0]?.cards.find((c) => c.id === task.id);
		expect(card?.labelIds).toContain(label.id);
	});
});
