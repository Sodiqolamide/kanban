import type { BoardCard, BoardData, BoardLabel, BoardLabelColor } from "@/types";

export const VALID_LABEL_COLORS: readonly BoardLabelColor[] = [
	"red",
	"orange",
	"yellow",
	"green",
	"blue",
	"purple",
	"gray",
];

/**
 * Returns true if `color` is one of the seven valid label colors.
 */
export function isValidLabelColor(color: unknown): color is BoardLabelColor {
	return VALID_LABEL_COLORS.includes(color as BoardLabelColor);
}

/**
 * Returns the label with the given `id`, or `undefined` if not found.
 */
export function getLabelById(board: BoardData, id: string): BoardLabel | undefined {
	return board.labels.find((l) => l.id === id);
}

/**
 * Returns the labels corresponding to `ids` in the same order, silently
 * skipping any id that is not present on the board.
 */
export function getLabelsByIds(board: BoardData, ids: readonly string[]): BoardLabel[] {
	const result: BoardLabel[] = [];
	for (const id of ids) {
		const label = board.labels.find((l) => l.id === id);
		if (label !== undefined) {
			result.push(label);
		}
	}
	return result;
}

/**
 * Returns the resolved `BoardLabel` objects attached to `card`.
 * Cards with no `labelIds` return an empty array.
 */
export function getCardLabels(board: BoardData, card: BoardCard): BoardLabel[] {
	if (!card.labelIds || card.labelIds.length === 0) {
		return [];
	}
	return getLabelsByIds(board, card.labelIds);
}

/**
 * Counts the total number of cards across all columns that reference `labelId`.
 */
export function getLabelUsageCount(board: BoardData, labelId: string): number {
	let count = 0;
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.labelIds?.includes(labelId)) {
				count++;
			}
		}
	}
	return count;
}

/**
 * Returns all cards (from any column) whose `labelIds` includes `labelId`.
 */
export function getCardsWithLabel(board: BoardData, labelId: string): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.labelIds?.includes(labelId)) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns a new array of labels sorted alphabetically by name.
 * Does not mutate the input array.
 */
export function sortLabelsByName(labels: readonly BoardLabel[]): BoardLabel[] {
	return [...labels].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns a new `BoardData` where each column only contains cards that have
 * `labelId` in their `labelIds`. The board's labels and dependencies arrays
 * are preserved unchanged.
 * Does not mutate the source board.
 */
export function filterBoardByLabel(board: BoardData, labelId: string): BoardData {
	return {
		...board,
		columns: board.columns.map((column) => ({
			...column,
			cards: column.cards.filter((card) => card.labelIds?.includes(labelId)),
		})),
	};
}

/**
 * Returns all cards (from any column) that have no labels assigned
 * (i.e. `labelIds` is undefined or empty).
 */
export function getUnlabeledCards(board: BoardData): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (!card.labelIds || card.labelIds.length === 0) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns a record mapping every board label id to the number of cards
 * that reference it. All board label ids appear as keys even if unused.
 */
export function getLabelDistribution(board: BoardData): Record<string, number> {
	const dist: Record<string, number> = {};
	for (const label of board.labels) {
		dist[label.id] = 0;
	}
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.labelIds) {
				for (const id of card.labelIds) {
					if (id in dist) {
						dist[id]!++;
					}
				}
			}
		}
	}
	return dist;
}
