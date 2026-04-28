import type { DropResult } from "@hello-pangea/dnd";
import { createShortTaskId } from "@runtime-task-id";
import * as runtimeTaskState from "@runtime-task-state";

import { createInitialBoardData } from "@/data/board-data";
import type { RuntimeAgentId, RuntimeClineReasoningEffort, RuntimeTaskClineSettings } from "@/runtime/types";
import { isAllowedCrossColumnCardMove, type ProgrammaticCardMoveInFlight } from "@/state/drag-rules";
import {
	BOARD_LABEL_NAME_MAX_LENGTH,
	BOARD_MAX_LABELS,
	type BoardCard,
	type BoardColumn,
	type BoardColumnId,
	type BoardData,
	type BoardDependency,
	type BoardLabel,
	type BoardLabelColor,
	CARD_MAX_LABELS,
	type CardSelection,
	DEFAULT_TASK_AUTO_REVIEW_MODE,
	resolveTaskAutoReviewMode,
	type TaskAutoReviewMode,
	type TaskImage,
} from "@/types";

export interface TaskDraft {
	title?: string;
	prompt: string;
	startInPlanMode?: boolean;
	autoReviewEnabled?: boolean;
	autoReviewMode?: TaskAutoReviewMode;
	images?: TaskImage[];
	agentId?: RuntimeAgentId;
	clineSettings?: RuntimeTaskClineSettings;
	baseRef: string;
	labelIds?: string[];
}

export interface TaskMoveEvent {
	taskId: string;
	fromColumnId: BoardColumnId;
	toColumnId: BoardColumnId;
}

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
	const result = Array.from(list);
	const [removed] = result.splice(startIndex, 1);
	if (removed !== undefined) {
		result.splice(endIndex, 0, removed);
	}
	return result;
}

function updateTaskTimestamp(task: BoardCard): BoardCard {
	return {
		...task,
		updatedAt: Date.now(),
	};
}

function withUpdatedColumns(board: BoardData, columns: BoardColumn[]): BoardData {
	return {
		...board,
		columns,
	};
}

function normalizeColumnId(id: string): BoardColumnId | null {
	if (id === "backlog" || id === "in_progress" || id === "review" || id === "trash") {
		return id;
	}
	return null;
}

function createBrowserUuid(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeTaskImages(rawImages: unknown): TaskImage[] | undefined {
	if (!Array.isArray(rawImages)) {
		return undefined;
	}
	const images: TaskImage[] = [];
	for (const rawImage of rawImages) {
		if (!rawImage || typeof rawImage !== "object") {
			continue;
		}
		const image = rawImage as { id?: unknown; data?: unknown; mimeType?: unknown; name?: unknown };
		if (typeof image.id !== "string" || typeof image.data !== "string" || typeof image.mimeType !== "string") {
			continue;
		}
		images.push({
			id: image.id,
			data: image.data,
			mimeType: image.mimeType,
			...(typeof image.name === "string" ? { name: image.name } : {}),
		});
	}
	return images.length > 0 ? images : undefined;
}

function normalizeTaskClineReasoningEffort(rawReasoningEffort: unknown): RuntimeClineReasoningEffort | undefined {
	if (
		rawReasoningEffort === "low" ||
		rawReasoningEffort === "medium" ||
		rawReasoningEffort === "high" ||
		rawReasoningEffort === "xhigh"
	) {
		return rawReasoningEffort;
	}
	return undefined;
}

function normalizeTaskClineSettings(input: {
	rawSettings?: unknown;
	legacyProviderId?: unknown;
	legacyModelId?: unknown;
	legacyReasoningEffort?: unknown;
}): RuntimeTaskClineSettings | undefined {
	if (input.rawSettings && typeof input.rawSettings === "object") {
		const settings = input.rawSettings as {
			providerId?: unknown;
			modelId?: unknown;
			reasoningEffort?: unknown;
		};
		const providerId = typeof settings.providerId === "string" ? settings.providerId.trim() : "";
		const modelId = typeof settings.modelId === "string" ? settings.modelId.trim() : "";
		const reasoningEffort = normalizeTaskClineReasoningEffort(settings.reasoningEffort);
		return {
			...(providerId ? { providerId } : {}),
			...(modelId ? { modelId } : {}),
			...(reasoningEffort ? { reasoningEffort } : {}),
		};
	}

	const legacyProviderId = typeof input.legacyProviderId === "string" ? input.legacyProviderId.trim() : "";
	const legacyModelId = typeof input.legacyModelId === "string" ? input.legacyModelId.trim() : "";
	const reasoningEffort = normalizeTaskClineReasoningEffort(input.legacyReasoningEffort);
	if (!legacyProviderId && !legacyModelId && input.legacyReasoningEffort !== "default" && !reasoningEffort) {
		return undefined;
	}
	return {
		...(legacyProviderId ? { providerId: legacyProviderId } : {}),
		...(legacyModelId ? { modelId: legacyModelId } : {}),
		...(reasoningEffort ? { reasoningEffort } : {}),
	};
}

function isValidLabelColorInternal(color: unknown): color is BoardLabelColor {
	return (
		color === "red" ||
		color === "orange" ||
		color === "yellow" ||
		color === "green" ||
		color === "blue" ||
		color === "purple" ||
		color === "gray"
	);
}

function normalizeLabel(rawLabel: unknown): BoardLabel | null {
	if (!rawLabel || typeof rawLabel !== "object") {
		return null;
	}
	const label = rawLabel as { id?: unknown; name?: unknown; color?: unknown; createdAt?: unknown };
	if (typeof label.id !== "string" || !label.id) {
		return null;
	}
	const rawName = typeof label.name === "string" ? label.name.trim() : "";
	if (!rawName) {
		return null;
	}
	const name = rawName.length > BOARD_LABEL_NAME_MAX_LENGTH ? rawName.slice(0, BOARD_LABEL_NAME_MAX_LENGTH) : rawName;
	if (!isValidLabelColorInternal(label.color)) {
		return null;
	}
	return {
		id: label.id,
		name,
		color: label.color,
		createdAt: typeof label.createdAt === "number" ? label.createdAt : Date.now(),
	};
}

function normalizeCard(rawCard: unknown): BoardCard | null {
	if (!rawCard || typeof rawCard !== "object") {
		return null;
	}

	const card = rawCard as {
		id?: unknown;
		title?: unknown;
		prompt?: unknown;
		startInPlanMode?: unknown;
		autoReviewEnabled?: unknown;
		autoReviewMode?: unknown;
		images?: unknown;
		baseRef?: unknown;
		agentId?: unknown;
		clineSettings?: unknown;
		clineProviderId?: unknown;
		clineModelId?: unknown;
		clineReasoningEffort?: unknown;
		createdAt?: unknown;
		updatedAt?: unknown;
		labelIds?: unknown;
	};
	const prompt = typeof card.prompt === "string" ? card.prompt.trim() : "";
	if (!prompt) {
		return null;
	}
	const baseRef = typeof card.baseRef === "string" ? card.baseRef.trim() : "";
	if (!baseRef) {
		return null;
	}
	const title = (typeof card.title === "string" ? card.title.trim() : "") || prompt;
	if (!title) {
		return null;
	}
	const clineSettings = normalizeTaskClineSettings({
		rawSettings: card.clineSettings,
		legacyProviderId: card.clineProviderId,
		legacyModelId: card.clineModelId,
		legacyReasoningEffort: card.clineReasoningEffort,
	});

	const rawLabelIds = Array.isArray(card.labelIds)
		? [
				...new Set(
					(card.labelIds as unknown[])
						.filter((id): id is string => typeof id === "string")
						.slice(0, CARD_MAX_LABELS),
				),
			]
		: undefined;

	const now = Date.now();

	return {
		id: typeof card.id === "string" && card.id ? card.id : createShortTaskId(createBrowserUuid),
		title,
		prompt,
		startInPlanMode: typeof card.startInPlanMode === "boolean" ? card.startInPlanMode : false,
		autoReviewEnabled: typeof card.autoReviewEnabled === "boolean" ? card.autoReviewEnabled : false,
		autoReviewMode: resolveTaskAutoReviewMode(
			typeof card.autoReviewMode === "string" ? (card.autoReviewMode as TaskAutoReviewMode) : undefined,
		),
		images: normalizeTaskImages(card.images),
		baseRef,
		...(typeof card.agentId === "string" && card.agentId ? { agentId: card.agentId as RuntimeAgentId } : {}),
		...(clineSettings !== undefined ? { clineSettings } : {}),
		...(rawLabelIds && rawLabelIds.length > 0 ? { labelIds: rawLabelIds } : {}),
		createdAt: typeof card.createdAt === "number" ? card.createdAt : now,
		updatedAt: typeof card.updatedAt === "number" ? card.updatedAt : now,
	};
}

function createDependencyId(): string {
	return createBrowserUuid().replaceAll("-", "").slice(0, 8);
}

function collectTaskIds(columns: BoardColumn[]): Set<string> {
	const taskIds = new Set<string>();
	for (const column of columns) {
		for (const card of column.cards) {
			taskIds.add(card.id);
		}
	}
	return taskIds;
}

function normalizeDependency(rawDependency: unknown, taskIds: Set<string>): BoardDependency | null {
	if (!rawDependency || typeof rawDependency !== "object") {
		return null;
	}

	const dependency = rawDependency as {
		id?: unknown;
		fromTaskId?: unknown;
		toTaskId?: unknown;
		createdAt?: unknown;
	};
	const fromTaskId = typeof dependency.fromTaskId === "string" ? dependency.fromTaskId.trim() : "";
	const toTaskId = typeof dependency.toTaskId === "string" ? dependency.toTaskId.trim() : "";
	if (!fromTaskId || !toTaskId || fromTaskId === toTaskId) {
		return null;
	}
	if (!taskIds.has(fromTaskId) || !taskIds.has(toTaskId)) {
		return null;
	}

	return {
		id: typeof dependency.id === "string" && dependency.id ? dependency.id : createDependencyId(),
		fromTaskId,
		toTaskId,
		createdAt: typeof dependency.createdAt === "number" ? dependency.createdAt : Date.now(),
	};
}
function removeDependenciesByTaskIds(board: BoardData, taskIds: Set<string>): BoardData {
	if (taskIds.size === 0 || board.dependencies.length === 0) {
		return board;
	}
	const dependencies = board.dependencies.filter(
		(dependency) => !taskIds.has(dependency.fromTaskId) && !taskIds.has(dependency.toTaskId),
	);
	if (dependencies.length === board.dependencies.length) {
		return board;
	}
	return {
		...board,
		dependencies,
	};
}
export function normalizeBoardData(rawBoard: unknown): BoardData | null {
	if (!rawBoard || typeof rawBoard !== "object") {
		return null;
	}

	const candidateColumns = (rawBoard as { columns?: unknown }).columns;
	const candidateDependencies = (rawBoard as { dependencies?: unknown }).dependencies;
	const candidateLabels = (rawBoard as { labels?: unknown }).labels;
	if (!Array.isArray(candidateColumns)) {
		return null;
	}

	// 1. Normalize labels: dedup by id (last wins), drop invalid, cap at BOARD_MAX_LABELS
	const labelMap = new Map<string, BoardLabel>();
	if (Array.isArray(candidateLabels)) {
		for (const rawLabel of candidateLabels) {
			const label = normalizeLabel(rawLabel);
			if (label) {
				labelMap.set(label.id, label);
			}
		}
	}
	const allLabels = [...labelMap.values()];
	const finalLabels = allLabels.length > BOARD_MAX_LABELS ? allLabels.slice(0, BOARD_MAX_LABELS) : allLabels;
	const validLabelIds = new Set(finalLabels.map((l) => l.id));

	const initial = createInitialBoardData();
	const normalizedColumns = initial.columns.map((column) => ({ ...column, cards: [] as BoardCard[] }));
	const columnById = new Map(normalizedColumns.map((column) => [column.id, column]));

	for (const rawColumn of candidateColumns) {
		if (!rawColumn || typeof rawColumn !== "object") {
			continue;
		}
		const column = rawColumn as { id?: unknown; cards?: unknown };
		if (typeof column.id !== "string") {
			continue;
		}
		const normalizedId = normalizeColumnId(column.id);
		if (!normalizedId) {
			continue;
		}
		const normalizedColumn = columnById.get(normalizedId);
		if (!normalizedColumn || !Array.isArray(column.cards)) {
			continue;
		}
		for (const rawCard of column.cards) {
			const card = normalizeCard(rawCard);
			if (card) {
				normalizedColumn.cards.push(card);
			}
		}
	}

	// 2. Prune orphaned labelIds from all cards (labelIds referencing non-existent labels)
	for (const column of normalizedColumns) {
		column.cards = column.cards.map((card) => {
			if (!card.labelIds || card.labelIds.length === 0) {
				return card;
			}
			const prunedLabelIds = card.labelIds.filter((id) => validLabelIds.has(id));
			if (prunedLabelIds.length === card.labelIds.length) {
				return card;
			}
			const newCard = { ...card };
			if (prunedLabelIds.length === 0) {
				delete newCard.labelIds;
			} else {
				newCard.labelIds = prunedLabelIds;
			}
			return newCard;
		});
	}

	const taskIds = collectTaskIds(normalizedColumns);
	const normalizedDependencies: BoardDependency[] = [];
	if (Array.isArray(candidateDependencies)) {
		for (const rawDependency of candidateDependencies) {
			const dependency = normalizeDependency(rawDependency, taskIds);
			if (!dependency) {
				continue;
			}
			normalizedDependencies.push(dependency);
		}
	}

	const boardResult = runtimeTaskState.updateTaskDependencies({
		columns: normalizedColumns,
		dependencies: normalizedDependencies,
		labels: finalLabels,
	});
	return { ...boardResult, labels: finalLabels };
}

export function addTaskToColumn(board: BoardData, columnId: BoardColumnId, draft: TaskDraft): BoardData {
	const prompt = draft.prompt.trim();
	if (!prompt) {
		return board;
	}
	return addTaskToColumnWithResult(board, columnId, draft).board;
}

export function addTaskToColumnWithResult(
	board: BoardData,
	columnId: BoardColumnId,
	draft: TaskDraft,
): { board: BoardData; task: BoardCard } {
	const prompt = draft.prompt.trim();
	if (!prompt) {
		throw new Error("Task prompt is required.");
	}
	const result = runtimeTaskState.addTaskToColumn(
		board,
		columnId,
		{
			title: draft.title,
			prompt,
			startInPlanMode: draft.startInPlanMode,
			autoReviewEnabled: draft.autoReviewEnabled,
			autoReviewMode: draft.autoReviewMode,
			images: draft.images,
			agentId: draft.agentId,
			clineSettings: draft.clineSettings,
			baseRef: draft.baseRef,
		},
		createBrowserUuid,
	);

	// Preserve labels (runtime doesn't know about them)
	let boardWithLabels: BoardData = { ...result.board, labels: board.labels };
	let createdTask = result.task;

	// Apply labelIds from draft if provided
	if (draft.labelIds && draft.labelIds.length > 0) {
		const validLabelIds = new Set(board.labels.map((l) => l.id));
		const filteredIds = [...new Set(draft.labelIds.filter((id) => validLabelIds.has(id)))];
		const cappedIds = filteredIds.slice(0, CARD_MAX_LABELS);
		if (cappedIds.length > 0) {
			boardWithLabels = {
				...boardWithLabels,
				columns: boardWithLabels.columns.map((col) => ({
					...col,
					cards: col.cards.map((card) => {
						if (card.id !== createdTask.id) return card;
						const updatedCard = { ...card, labelIds: cappedIds };
						createdTask = updatedCard;
						return updatedCard;
					}),
				})),
			};
		}
	}

	return {
		board: boardWithLabels,
		task: createdTask,
	};
}

export interface AddTaskDependencyResult {
	board: BoardData;
	added: boolean;
	reason?: NonNullable<runtimeTaskState.RuntimeAddTaskDependencyResult["reason"]>;
	dependency?: BoardDependency;
}

export function addTaskDependency(board: BoardData, fromTaskId: string, toTaskId: string): AddTaskDependencyResult {
	return runtimeTaskState.addTaskDependency(board, fromTaskId, toTaskId);
}

export function canCreateTaskDependency(board: BoardData, fromTaskId: string, toTaskId: string): boolean {
	return runtimeTaskState.canAddTaskDependency(board, fromTaskId, toTaskId);
}

export function removeTaskDependency(board: BoardData, dependencyId: string): { board: BoardData; removed: boolean } {
	return runtimeTaskState.removeTaskDependency(board, dependencyId);
}

export function getReadyLinkedTaskIdsForTaskInTrash(board: BoardData, taskId: string): string[] {
	return runtimeTaskState.getReadyLinkedTaskIdsForTaskInTrash(board, taskId);
}

export function trashTaskAndGetReadyLinkedTaskIds(
	board: BoardData,
	taskId: string,
): { board: BoardData; moved: boolean; readyTaskIds: string[] } {
	return runtimeTaskState.trashTaskAndGetReadyLinkedTaskIds(board, taskId);
}

export function applyDragResult(
	board: BoardData,
	result: DropResult,
	options?: { programmaticCardMoveInFlight?: ProgrammaticCardMoveInFlight | null },
): { board: BoardData; moveEvent?: TaskMoveEvent } {
	const { source, destination, type } = result;

	if (!destination) {
		return { board };
	}

	if (source.droppableId === destination.droppableId && source.index === destination.index) {
		return { board };
	}

	if (type === "COLUMN") {
		return { board };
	}

	const sourceColumnIndex = board.columns.findIndex((column) => column.id === source.droppableId);
	const destinationColumnIndex = board.columns.findIndex((column) => column.id === destination.droppableId);
	const sourceColumn = board.columns[sourceColumnIndex];
	const destinationColumn = board.columns[destinationColumnIndex];

	if (!sourceColumn || !destinationColumn) {
		return { board };
	}

	if (sourceColumn.id === destinationColumn.id) {
		const movedCards = reorder(sourceColumn.cards, source.index, destination.index);
		const columns = Array.from(board.columns);
		columns[sourceColumnIndex] = {
			...sourceColumn,
			cards: movedCards,
		};
		return { board: withUpdatedColumns(board, columns) };
	}

	const isAllowedCrossColumnMove = isAllowedCrossColumnCardMove(sourceColumn.id, destinationColumn.id, {
		taskId: result.draggableId,
		programmaticCardMoveInFlight: options?.programmaticCardMoveInFlight,
	});
	if (!isAllowedCrossColumnMove) {
		return { board };
	}

	const sourceCards = Array.from(sourceColumn.cards);
	const [movedCard] = sourceCards.splice(source.index, 1);
	if (!movedCard) {
		return { board };
	}

	const destinationCards = Array.from(destinationColumn.cards);
	const destinationInsertIndex = options?.programmaticCardMoveInFlight?.insertAtTop ? 0 : destination.index;
	destinationCards.splice(destinationInsertIndex, 0, updateTaskTimestamp(movedCard));

	const columns = Array.from(board.columns);
	columns[sourceColumnIndex] = {
		...sourceColumn,
		cards: sourceCards,
	};
	columns[destinationColumnIndex] = {
		...destinationColumn,
		cards: destinationCards,
	};

	return {
		board: runtimeTaskState.updateTaskDependencies(withUpdatedColumns(board, columns)),
		moveEvent: {
			taskId: movedCard.id,
			fromColumnId: sourceColumn.id,
			toColumnId: destinationColumn.id,
		},
	};
}
export function moveTaskToColumn(
	board: BoardData,
	taskId: string,
	targetColumnId: BoardColumnId,
	options?: { insertAtTop?: boolean },
): { board: BoardData; moved: boolean } {
	const moved = runtimeTaskState.moveTaskToColumn(board, taskId, targetColumnId);
	if (!moved.moved || !options?.insertAtTop) {
		return {
			board: moved.moved ? moved.board : board,
			moved: moved.moved,
		};
	}
	const targetColumnIndex = moved.board.columns.findIndex((column) => column.id === targetColumnId);
	const targetColumn = moved.board.columns[targetColumnIndex];
	if (!targetColumn) {
		return {
			board: moved.board,
			moved: moved.moved,
		};
	}
	const movedTaskIndex = targetColumn.cards.findIndex((card) => card.id === taskId);
	if (movedTaskIndex <= 0) {
		return {
			board: moved.board,
			moved: moved.moved,
		};
	}
	const targetCards = Array.from(targetColumn.cards);
	const [movedTask] = targetCards.splice(movedTaskIndex, 1);
	if (!movedTask) {
		return {
			board: moved.board,
			moved: moved.moved,
		};
	}
	targetCards.unshift(movedTask);
	const columns = Array.from(moved.board.columns);
	columns[targetColumnIndex] = {
		...targetColumn,
		cards: targetCards,
	};
	return {
		board: withUpdatedColumns(moved.board, columns),
		moved: moved.moved,
	};
}

export function updateTask(board: BoardData, taskId: string, draft: TaskDraft): { board: BoardData; updated: boolean } {
	const prompt = draft.prompt.trim();
	if (!prompt) {
		return { board, updated: false };
	}
	const title = typeof draft.title === "string" ? draft.title.trim() : "";
	const baseRef = draft.baseRef.trim();
	if (!baseRef) {
		return { board, updated: false };
	}

	const validLabelIds = new Set(board.labels.map((l) => l.id));

	let updated = false;
	const columns = board.columns.map((column) => {
		let columnUpdated = false;
		const cards = column.cards.map((card) => {
			if (card.id !== taskId) {
				return card;
			}
			columnUpdated = true;
			updated = true;

			// 3-way labelIds behavior:
			// undefined → preserve existing card.labelIds
			// [] → clear (delete labelIds)
			// [...] → replace with valid ids only (filter, dedup, cap)
			let newLabelIds: string[] | undefined;
			if (draft.labelIds === undefined) {
				newLabelIds = card.labelIds;
			} else if (draft.labelIds.length === 0) {
				newLabelIds = undefined;
			} else {
				const filtered = [...new Set(draft.labelIds.filter((id) => validLabelIds.has(id)))].slice(
					0,
					CARD_MAX_LABELS,
				);
				newLabelIds = filtered.length > 0 ? filtered : undefined;
			}

			const newCard: BoardCard = {
				...card,
				title: title || card.title,
				prompt,
				startInPlanMode: Boolean(draft.startInPlanMode),
				autoReviewEnabled: Boolean(draft.autoReviewEnabled),
				autoReviewMode: resolveTaskAutoReviewMode(draft.autoReviewMode ?? DEFAULT_TASK_AUTO_REVIEW_MODE),
				images:
					draft.images === undefined
						? card.images
						: draft.images.length > 0
							? draft.images.map((image) => ({ ...image }))
							: undefined,
				agentId: draft.agentId,
				clineSettings: draft.clineSettings,
				baseRef,
				updatedAt: Date.now(),
			};
			if (newLabelIds !== undefined) {
				newCard.labelIds = newLabelIds;
			} else {
				delete newCard.labelIds;
			}
			return newCard;
		});
		return columnUpdated ? { ...column, cards } : column;
	});

	if (!updated) {
		return { board, updated: false };
	}
	return { board: withUpdatedColumns(board, columns), updated: true };
}

export function updateTaskTitle(
	board: BoardData,
	taskId: string,
	title: string,
): { board: BoardData; updated: boolean } {
	const selection = findCardSelection(board, taskId);
	if (!selection) {
		return { board, updated: false };
	}
	return updateTask(board, taskId, {
		title,
		prompt: selection.card.prompt,
		startInPlanMode: selection.card.startInPlanMode,
		autoReviewEnabled: selection.card.autoReviewEnabled,
		autoReviewMode: selection.card.autoReviewMode,
		images: selection.card.images,
		agentId: selection.card.agentId,
		clineSettings: selection.card.clineSettings,
		baseRef: selection.card.baseRef,
		labelIds: selection.card.labelIds,
	});
}

export function applyTaskDetailClineSettingsSelection(
	board: BoardData,
	taskId: string,
	settings: {
		agentId?: RuntimeAgentId;
		clineSettings?: RuntimeTaskClineSettings | null;
	},
): { board: BoardData; updated: boolean } {
	const selection = findCardSelection(board, taskId);
	if (!selection) {
		return { board, updated: false };
	}

	const hasExplicitTaskAgentSettings =
		selection.card.agentId === "cline" || selection.card.clineSettings !== undefined;
	if (!hasExplicitTaskAgentSettings) {
		return { board, updated: false };
	}

	return updateTask(board, taskId, {
		prompt: selection.card.prompt,
		startInPlanMode: selection.card.startInPlanMode,
		autoReviewEnabled: selection.card.autoReviewEnabled,
		autoReviewMode: selection.card.autoReviewMode,
		images: selection.card.images,
		agentId: settings.agentId,
		clineSettings: settings.clineSettings ?? undefined,
		baseRef: selection.card.baseRef,
		labelIds: selection.card.labelIds,
	});
}

export function applyTaskDetailClineSettingsChange(
	board: BoardData,
	taskId: string,
	change: {
		providerId: string;
		modelId: string;
		reasoningEffort: RuntimeClineReasoningEffort | "";
	},
	defaults: {
		providerId?: string | null;
		modelId?: string | null;
	},
): { board: BoardData; updated: boolean } {
	const selection = findCardSelection(board, taskId);
	if (!selection) {
		return { board, updated: false };
	}

	const hasExplicitTaskAgentSettings =
		selection.card.agentId === "cline" || selection.card.clineSettings !== undefined;
	if (!hasExplicitTaskAgentSettings) {
		return { board, updated: false };
	}

	const nextTaskProviderId = change.providerId.trim() || defaults.providerId?.trim() || "";
	const nextTaskModelId = change.modelId.trim() || defaults.modelId?.trim() || "";
	if (!nextTaskProviderId || !nextTaskModelId) {
		return { board, updated: false };
	}

	return applyTaskDetailClineSettingsSelection(board, taskId, {
		agentId: "cline",
		clineSettings: {
			providerId: nextTaskProviderId,
			modelId: nextTaskModelId,
			...(change.reasoningEffort ? { reasoningEffort: change.reasoningEffort } : {}),
		},
	});
}

export function disableTaskAutoReview(board: BoardData, taskId: string): { board: BoardData; updated: boolean } {
	const selection = findCardSelection(board, taskId);
	if (!selection) {
		return { board, updated: false };
	}

	return updateTask(board, taskId, {
		prompt: selection.card.prompt,
		startInPlanMode: selection.card.startInPlanMode,
		autoReviewEnabled: false,
		autoReviewMode: DEFAULT_TASK_AUTO_REVIEW_MODE,
		images: selection.card.images,
		agentId: selection.card.agentId,
		clineSettings: selection.card.clineSettings,
		baseRef: selection.card.baseRef,
		labelIds: selection.card.labelIds,
	});
}

export function removeTask(board: BoardData, taskId: string): { board: BoardData; removed: boolean } {
	let removed = false;
	const columns = board.columns.map((column) => {
		const nextCards = column.cards.filter((card) => card.id !== taskId);
		if (nextCards.length !== column.cards.length) {
			removed = true;
			return { ...column, cards: nextCards };
		}
		return column;
	});
	if (!removed) {
		return { board, removed: false };
	}
	const boardWithUpdatedColumns = withUpdatedColumns(board, columns);
	return {
		board: removeDependenciesByTaskIds(boardWithUpdatedColumns, new Set([taskId])),
		removed: true,
	};
}

export function clearColumnTasks(
	board: BoardData,
	columnId: BoardColumnId,
): { board: BoardData; clearedTaskIds: string[] } {
	const targetColumn = board.columns.find((column) => column.id === columnId);
	if (!targetColumn || targetColumn.cards.length === 0) {
		return { board, clearedTaskIds: [] };
	}

	const clearedTaskIds = targetColumn.cards.map((card) => card.id);
	const columns = board.columns.map((column) => (column.id === columnId ? { ...column, cards: [] } : column));
	const boardWithUpdatedColumns = withUpdatedColumns(board, columns);

	return {
		board: removeDependenciesByTaskIds(boardWithUpdatedColumns, new Set(clearedTaskIds)),
		clearedTaskIds,
	};
}

export function findCardSelection(board: BoardData, taskId: string): CardSelection | null {
	for (const column of board.columns) {
		const card = column.cards.find((task) => task.id === taskId);
		if (card) {
			return {
				card,
				column,
				allColumns: board.columns,
			};
		}
	}
	return null;
}

export function getTaskColumnId(board: BoardData, taskId: string): BoardColumnId | null {
	return runtimeTaskState.getTaskColumnId(board, taskId);
}

// ─── Board Label Operations ───────────────────────────────────────────────────

export function addBoardLabel(
	board: BoardData,
	name: string,
	color: BoardLabelColor,
): { board: BoardData; label: BoardLabel; added: boolean } {
	const trimmedName = name.trim();
	if (!trimmedName || !isValidLabelColorInternal(color)) {
		return { board, label: { id: "", name: trimmedName, color, createdAt: 0 }, added: false };
	}
	if (board.labels.length >= BOARD_MAX_LABELS) {
		return { board, label: { id: "", name: trimmedName, color, createdAt: 0 }, added: false };
	}
	const finalName =
		trimmedName.length > BOARD_LABEL_NAME_MAX_LENGTH
			? trimmedName.slice(0, BOARD_LABEL_NAME_MAX_LENGTH)
			: trimmedName;
	const label: BoardLabel = {
		id: createBrowserUuid(),
		name: finalName,
		color,
		createdAt: Date.now(),
	};
	return {
		board: { ...board, labels: [...board.labels, label] },
		label,
		added: true,
	};
}

export function removeBoardLabel(board: BoardData, labelId: string): BoardData {
	const index = board.labels.findIndex((l) => l.id === labelId);
	if (index === -1) {
		return board;
	}
	const labels = board.labels.filter((l) => l.id !== labelId);
	// Cascade removal to all cards in all columns
	const columns = board.columns.map((column) => ({
		...column,
		cards: column.cards.map((card) => {
			if (!card.labelIds?.includes(labelId)) {
				return card;
			}
			const newLabelIds = card.labelIds.filter((id) => id !== labelId);
			const newCard = { ...card };
			if (newLabelIds.length === 0) {
				delete newCard.labelIds;
			} else {
				newCard.labelIds = newLabelIds;
			}
			return newCard;
		}),
	}));
	return { ...board, labels, columns };
}

export function updateBoardLabel(
	board: BoardData,
	labelId: string,
	updates: { name?: string; color?: BoardLabelColor },
): BoardData {
	const index = board.labels.findIndex((l) => l.id === labelId);
	if (index === -1) {
		return board;
	}
	const existing = board.labels[index]!;
	let newName = existing.name;
	let newColor = existing.color;
	if (updates.name !== undefined) {
		const trimmed = updates.name.trim();
		if (!trimmed) {
			return board;
		}
		newName = trimmed.length > BOARD_LABEL_NAME_MAX_LENGTH ? trimmed.slice(0, BOARD_LABEL_NAME_MAX_LENGTH) : trimmed;
	}
	if (updates.color !== undefined) {
		if (!isValidLabelColorInternal(updates.color)) {
			return board;
		}
		newColor = updates.color;
	}
	const updatedLabel: BoardLabel = { ...existing, name: newName, color: newColor };
	const labels = board.labels.map((l) => (l.id === labelId ? updatedLabel : l));
	return { ...board, labels };
}

export function addLabelToCard(
	board: BoardData,
	taskId: string,
	labelId: string,
): { board: BoardData; added: boolean } {
	const labelExists = board.labels.some((l) => l.id === labelId);
	if (!labelExists) {
		return { board, added: false };
	}
	let foundTask = false;
	let alreadyHas = false;
	let atCapacity = false;
	const columns = board.columns.map((column) => ({
		...column,
		cards: column.cards.map((card) => {
			if (card.id !== taskId) return card;
			foundTask = true;
			if (card.labelIds?.includes(labelId)) {
				alreadyHas = true;
				return card;
			}
			if ((card.labelIds?.length ?? 0) >= CARD_MAX_LABELS) {
				atCapacity = true;
				return card;
			}
			return { ...card, labelIds: [...(card.labelIds ?? []), labelId] };
		}),
	}));
	if (!foundTask) {
		return { board, added: false };
	}
	if (alreadyHas) {
		return { board, added: false };
	}
	if (atCapacity) {
		return { board, added: false };
	}
	return { board: { ...board, columns }, added: true };
}

export function removeLabelFromCard(
	board: BoardData,
	taskId: string,
	labelId: string,
): { board: BoardData; removed: boolean } {
	let removed = false;
	const columns = board.columns.map((column) => ({
		...column,
		cards: column.cards.map((card) => {
			if (card.id !== taskId) return card;
			if (!card.labelIds?.includes(labelId)) return card;
			removed = true;
			const newLabelIds = card.labelIds.filter((id) => id !== labelId);
			const newCard = { ...card };
			if (newLabelIds.length === 0) {
				delete newCard.labelIds;
			} else {
				newCard.labelIds = newLabelIds;
			}
			return newCard;
		}),
	}));
	if (!removed) {
		return { board, removed: false };
	}
	return { board: { ...board, columns }, removed: true };
}

export function setCardLabels(board: BoardData, taskId: string, labelIds: string[]): BoardData {
	let foundTask = false;
	const validLabelIds = new Set(board.labels.map((l) => l.id));
	// Silently drop non-existent ids, deduplicate
	const filteredIds = [...new Set(labelIds.filter((id) => validLabelIds.has(id)))];
	const columns = board.columns.map((column) => ({
		...column,
		cards: column.cards.map((card) => {
			if (card.id !== taskId) return card;
			foundTask = true;
			const newCard = { ...card };
			if (filteredIds.length === 0) {
				delete newCard.labelIds;
			} else {
				newCard.labelIds = filteredIds;
			}
			return newCard;
		}),
	}));
	if (!foundTask) {
		return board;
	}
	return { ...board, columns };
}
