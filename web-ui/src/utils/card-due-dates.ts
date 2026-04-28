import type { BoardCard, BoardData } from "@/types";

/**
 * Returns true if the card has a dueDate and it is strictly before `now`
 * (defaults to the current time).
 */
export function isOverdue(card: BoardCard, now: number = Date.now()): boolean {
	return card.dueDate !== undefined && card.dueDate < now;
}

/**
 * Returns all cards (across all columns) that are overdue at `now`.
 */
export function getOverdueCards(board: BoardData, now: number = Date.now()): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (isOverdue(card, now)) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns all cards (across all columns) that have a dueDate set.
 */
export function getCardsWithDueDate(board: BoardData): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.dueDate !== undefined) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns all cards (across all columns) that have no dueDate.
 */
export function getUnscheduledCards(board: BoardData): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.dueDate === undefined) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns cards with a dueDate strictly before `timestamp`.
 * Cards without a dueDate are excluded.
 */
export function getCardsDueBefore(board: BoardData, timestamp: number): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.dueDate !== undefined && card.dueDate < timestamp) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns cards with a dueDate greater than or equal to `timestamp`.
 * Cards without a dueDate are excluded.
 */
export function getCardsDueOnOrAfter(board: BoardData, timestamp: number): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.dueDate !== undefined && card.dueDate >= timestamp) {
				result.push(card);
			}
		}
	}
	return result;
}

/**
 * Returns a new array of cards sorted by dueDate. Cards without a dueDate
 * are placed at the end regardless of direction. Does not mutate the input.
 * Direction defaults to "asc" (earliest first).
 */
export function sortCardsByDueDate(cards: readonly BoardCard[], direction: "asc" | "desc" = "asc"): BoardCard[] {
	return [...cards].sort((a, b) => {
		if (a.dueDate === undefined && b.dueDate === undefined) return 0;
		if (a.dueDate === undefined) return 1;
		if (b.dueDate === undefined) return -1;
		return direction === "asc" ? a.dueDate - b.dueDate : b.dueDate - a.dueDate;
	});
}

/**
 * Returns the smallest dueDate value across all cards in all columns,
 * or null if no card has a dueDate.
 */
export function getNearestDueDate(board: BoardData): number | null {
	let nearest: number | null = null;
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.dueDate !== undefined) {
				if (nearest === null || card.dueDate < nearest) {
					nearest = card.dueDate;
				}
			}
		}
	}
	return nearest;
}
