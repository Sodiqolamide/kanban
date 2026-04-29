import type { BoardCard, BoardData, CardPriority } from "@/types";

export const PRIORITY_LEVELS: readonly CardPriority[] = ["low", "medium", "high", "critical"];

const PRIORITY_RANK: Record<CardPriority, number> = {
	low: 0,
	medium: 1,
	high: 2,
	critical: 3,
};

export function isValidPriority(value: unknown): value is CardPriority {
	return value === "low" || value === "medium" || value === "high" || value === "critical";
}

export function getCardsByPriority(board: BoardData, priority: CardPriority): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.priority === priority) {
				result.push(card);
			}
		}
	}
	return result;
}

export function getUnprioritizedCards(board: BoardData): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.priority === undefined) {
				result.push(card);
			}
		}
	}
	return result;
}

export function getPrioritizedCards(board: BoardData): BoardCard[] {
	const result: BoardCard[] = [];
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.priority !== undefined) {
				result.push(card);
			}
		}
	}
	return result;
}

export function sortCardsByPriority(cards: BoardCard[], direction: "asc" | "desc" = "asc"): BoardCard[] {
	return [...cards].sort((a, b) => {
		const aHas = a.priority !== undefined;
		const bHas = b.priority !== undefined;
		if (!aHas && !bHas) return 0;
		if (!aHas) return 1;
		if (!bHas) return -1;
		const aRank = PRIORITY_RANK[a.priority!];
		const bRank = PRIORITY_RANK[b.priority!];
		return direction === "asc" ? aRank - bRank : bRank - aRank;
	});
}

export function getHighestPriority(board: BoardData): CardPriority | null {
	let best: CardPriority | null = null;
	let bestRank = -1;
	for (const column of board.columns) {
		for (const card of column.cards) {
			if (card.priority !== undefined) {
				const rank = PRIORITY_RANK[card.priority];
				if (rank > bestRank) {
					bestRank = rank;
					best = card.priority;
				}
			}
		}
	}
	return best;
}
