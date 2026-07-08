import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Copy,
	Download,
	ExternalLink,
	GripVertical,
	Plus,
	RotateCcw,
	Upload,
	WrapText,
	X,
} from "lucide-react";
import {
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ExportVariablesModal } from "#/components/ExportVariablesModal";
import { ImportVariablesModal } from "#/components/ImportVariablesModal";

type EnvColumn = {
	id: string;
	name: string;
};

type EnvVariable = {
	id: string;
	name: string;
	values: Record<string, string>;
};

let idCounter = 0;
function nextId(prefix: string) {
	idCounter += 1;
	return `${prefix}-${idCounter}`;
}

const initialColumns: EnvColumn[] = [
	{ id: "local", name: "Local" },
	{ id: "staging", name: "Staging" },
	{ id: "production", name: "Production" },
];

const initialVariables: EnvVariable[] = [
	{
		id: nextId("var"),
		name: "API_URL",
		values: {
			local: "http://localhost:3000",
			staging: "https://staging.example.com",
			production: "https://example.com",
		},
	},
	{
		id: nextId("var"),
		name: "DATABASE_URL",
		values: {
			local: "postgres://localhost/dev",
			staging: "postgres://staging-db.internal/app",
			production: "",
		},
	},
	{
		id: nextId("var"),
		name: "FEATURE_FLAG_NEW_CHECKOUT",
		values: {
			local: "true",
			staging: "",
			production: "",
		},
	},
];

const STORAGE_KEY = "envsort:sheet-state";

type PersistedState = {
	columns: EnvColumn[];
	variables: EnvVariable[];
	columnWidths: Record<string, number>;
	sortDirection: "asc" | "desc" | null;
	wrapValues: boolean;
};

function loadPersistedState(): PersistedState | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!Array.isArray(parsed.columns) ||
			!Array.isArray(parsed.variables)
		) {
			return null;
		}
		return {
			columns: parsed.columns,
			variables: parsed.variables,
			columnWidths: parsed.columnWidths ?? {},
			sortDirection: parsed.sortDirection ?? null,
			wrapValues: Boolean(parsed.wrapValues),
		};
	} catch {
		return null;
	}
}

function bumpIdCounterPastPersisted(state: PersistedState) {
	for (const item of [...state.columns, ...state.variables]) {
		const match = /-(\d+)$/.exec(item.id);
		if (match) idCounter = Math.max(idCounter, Number(match[1]));
	}
}

const ROW_NUM_COL_WIDTH = 40;
const VARIABLE_COL_ID = "__variable__";
const DEFAULT_VARIABLE_COL_WIDTH = 220;
const DEFAULT_ENV_COL_WIDTH = 200;
const MIN_COL_WIDTH = 120;
const MAX_COL_WIDTH = 480;

function isUrlValue(value: string) {
	return /^https?:\/\//i.test(value.trim());
}

function getValueColorClass(value: string, isMissing: boolean) {
	if (isMissing) {
		return "text-red-400 placeholder:text-red-500/60 focus:bg-red-500/20";
	}
	const trimmed = value.trim().toLowerCase();
	if (trimmed === "true")
		return "font-semibold text-violet-400 focus:bg-zinc-900";
	if (trimmed === "false")
		return "font-semibold text-violet-400/70 focus:bg-zinc-900";
	if (isUrlValue(value)) {
		return "text-sky-400 underline decoration-sky-400/40 underline-offset-2 focus:bg-zinc-900";
	}
	return "text-zinc-200 focus:bg-zinc-900";
}

function columnLabel(index: number) {
	// Spreadsheet-style column letters: A, B, ... Z, AA, AB, ...
	let n = index + 1;
	let label = "";
	while (n > 0) {
		const rem = (n - 1) % 26;
		label = String.fromCharCode(65 + rem) + label;
		n = Math.floor((n - 1) / 26);
	}
	return label;
}

export function EnvVarSheet() {
	const [columns, setColumns] = useState(initialColumns);
	const [variables, setVariables] = useState(initialVariables);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
	const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
		null,
	);
	const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
	const [wrapValues, setWrapValues] = useState(false);
	const [isHydrated, setIsHydrated] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
	);

	// Restore persisted state after mount, not during the initial render, so
	// the server-rendered defaults match the client's first paint (avoids a
	// hydration mismatch) and so we never overwrite storage before reading it.
	useEffect(() => {
		const state = loadPersistedState();
		if (state) {
			bumpIdCounterPastPersisted(state);
			setColumns(state.columns);
			setVariables(state.variables);
			setColumnWidths(state.columnWidths);
			setSortDirection(state.sortDirection);
			setWrapValues(state.wrapValues);
		}
		setIsHydrated(true);
	}, []);

	useEffect(() => {
		if (!isHydrated) return;
		const state: PersistedState = {
			columns,
			variables,
			columnWidths,
			sortDirection,
			wrapValues,
		};
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	}, [isHydrated, columns, variables, columnWidths, sortDirection, wrapValues]);

	const displayedVariables = useMemo(() => {
		if (!sortDirection) return variables;
		const sorted = [...variables].sort((a, b) => a.name.localeCompare(b.name));
		return sortDirection === "asc" ? sorted : sorted.reverse();
	}, [variables, sortDirection]);

	const duplicateNames = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const variable of variables) {
			const name = variable.name.trim();
			if (!name) continue;
			counts[name] = (counts[name] ?? 0) + 1;
		}
		return new Set(
			Object.entries(counts)
				.filter(([, count]) => count > 1)
				.map(([name]) => name),
		);
	}, [variables]);

	const hasDuplicateNames = duplicateNames.size > 0;

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const rowVirtualizer = useVirtualizer({
		count: displayedVariables.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: () => 34,
		overscan: 8,
	});
	const virtualItems = rowVirtualizer.getVirtualItems();
	const virtualPaddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
	const virtualPaddingBottom =
		virtualItems.length > 0
			? rowVirtualizer.getTotalSize() -
				virtualItems[virtualItems.length - 1].end
			: 0;
	const totalColumnCount = columns.length + 3;

	const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
	const [focusVariableId, setFocusVariableId] = useState<string | null>(null);

	useEffect(() => {
		if (!focusVariableId) return;
		const index = displayedVariables.findIndex(
			(variable) => variable.id === focusVariableId,
		);
		if (index !== -1) rowVirtualizer.scrollToIndex(index, { align: "auto" });

		let rafId: number;
		let attempts = 0;
		function tryFocus() {
			const input = nameInputRefs.current[focusVariableId as string];
			if (input) {
				input.focus();
				input.select();
				setFocusVariableId(null);
				return;
			}
			attempts += 1;
			if (attempts < 20) rafId = requestAnimationFrame(tryFocus);
		}
		rafId = requestAnimationFrame(tryFocus);
		return () => cancelAnimationFrame(rafId);
	}, [focusVariableId, displayedVariables, rowVirtualizer]);

	function getColumnWidth(id: string, fallback: number) {
		return columnWidths[id] ?? fallback;
	}

	function toggleSort() {
		setSortDirection((dir) =>
			dir === "asc" ? "desc" : dir === "desc" ? null : "asc",
		);
	}

	function startColumnResize(id: string, fallback: number) {
		return (event: ReactMouseEvent) => {
			event.preventDefault();
			const startX = event.clientX;
			const startWidth = getColumnWidth(id, fallback);

			function onMouseMove(moveEvent: MouseEvent) {
				const nextWidth = Math.min(
					MAX_COL_WIDTH,
					Math.max(MIN_COL_WIDTH, startWidth + (moveEvent.clientX - startX)),
				);
				setColumnWidths((widths) => ({ ...widths, [id]: nextWidth }));
			}

			function onMouseUp() {
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
			}

			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
		};
	}

	function addColumn() {
		const id = nextId("env");
		setColumns((cols) => [...cols, { id, name: "New Environment" }]);
	}

	function removeColumn(id: string) {
		setColumns((cols) => cols.filter((col) => col.id !== id));
		setVariables((vars) =>
			vars.map((variable) => {
				const values = { ...variable.values };
				delete values[id];
				return { ...variable, values };
			}),
		);
	}

	function renameColumn(id: string, name: string) {
		setColumns((cols) =>
			cols.map((col) => (col.id === id ? { ...col, name } : col)),
		);
	}

	function handleColumnDragStart(event: DragStartEvent) {
		setActiveColumnId(String(event.active.id));
	}

	function handleColumnDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveColumnId(null);
		if (!over || active.id === over.id) return;
		setColumns((cols) => {
			const fromIndex = cols.findIndex((col) => col.id === active.id);
			const toIndex = cols.findIndex((col) => col.id === over.id);
			if (fromIndex === -1 || toIndex === -1) return cols;
			return arrayMove(cols, fromIndex, toIndex);
		});
	}

	function addVariable() {
		const id = nextId("var");
		setVariables((vars) => [...vars, { id, name: "", values: {} }]);
	}

	function removeVariable(id: string) {
		setVariables((vars) => vars.filter((variable) => variable.id !== id));
	}

	function duplicateVariable(id: string) {
		const newId = nextId("var");
		setVariables((vars) => {
			const index = vars.findIndex((variable) => variable.id === id);
			if (index === -1) return vars;
			const source = vars[index];
			const copy: EnvVariable = {
				id: newId,
				name: source.name,
				values: { ...source.values },
			};
			const next = [...vars];
			next.splice(index + 1, 0, copy);
			return next;
		});
		setFocusVariableId(newId);
	}

	function renameVariable(id: string, name: string) {
		setVariables((vars) =>
			vars.map((variable) =>
				variable.id === id ? { ...variable, name } : variable,
			),
		);
	}

	function setValue(variableId: string, columnId: string, value: string) {
		setVariables((vars) =>
			vars.map((variable) =>
				variable.id === variableId
					? { ...variable, values: { ...variable.values, [columnId]: value } }
					: variable,
			),
		);
	}

	function importVariables(
		target: { columnId: string } | { newColumnName: string },
		values: Record<string, string>,
	) {
		const columnId = "columnId" in target ? target.columnId : nextId("env");

		if ("newColumnName" in target) {
			setColumns((cols) => [
				...cols,
				{ id: columnId, name: target.newColumnName },
			]);
		}

		setVariables((vars) => {
			const next = [...vars];
			for (const [name, value] of Object.entries(values)) {
				const index = next.findIndex((variable) => variable.name === name);
				if (index === -1) {
					next.push({ id: nextId("var"), name, values: { [columnId]: value } });
				} else {
					next[index] = {
						...next[index],
						values: { ...next[index].values, [columnId]: value },
					};
				}
			}
			return next;
		});
	}

	function resetSheet() {
		if (
			!window.confirm(
				"Reset the sheet? This clears all variables and environments back to the default example.",
			)
		) {
			return;
		}
		window.localStorage.removeItem(STORAGE_KEY);
		setColumns(initialColumns);
		setVariables(initialVariables);
		setColumnWidths({});
		setSortDirection(null);
		setActiveColumnId(null);
		setWrapValues(false);
	}

	return (
		<div className="min-h-screen bg-black p-6 text-zinc-100">
			<div className="mx-auto flex w-full max-w-7xl flex-col">
				<div className="mb-4 flex shrink-0 items-start justify-between gap-4">
					<div>
						<h1 className="text-xl font-semibold text-zinc-100">
							Environment Variable Sheet
						</h1>
						<p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
							<AlertTriangle size={14} className="text-red-400" />
							Cells highlighted in red are set in at least one environment but
							missing here.
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={() => setWrapValues((wrap) => !wrap)}
							aria-pressed={wrapValues}
							className={`flex items-center gap-1.5 rounded-md border bg-zinc-950 px-3 py-1.5 text-sm font-medium transition-colors ${
								wrapValues
									? "border-yellow-500/60 text-yellow-400"
									: "border-zinc-800 text-zinc-200 hover:border-yellow-500/50 hover:text-yellow-400"
							}`}
						>
							<WrapText size={14} /> Wrap
						</button>
						<button
							type="button"
							onClick={resetSheet}
							className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-red-500/50 hover:text-red-400"
						>
							<RotateCcw size={14} /> Reset
						</button>
						<button
							type="button"
							onClick={() => setIsImportOpen(true)}
							className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-yellow-500/50 hover:text-yellow-400"
						>
							<Upload size={14} /> Import
						</button>
						<button
							type="button"
							onClick={() => setIsExportOpen(true)}
							disabled={columns.length === 0}
							className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-yellow-500/50 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Download size={14} /> Export
						</button>
					</div>
				</div>

				{hasDuplicateNames && (
					<div className="mb-4 flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
						<AlertTriangle size={14} className="shrink-0 text-amber-400" />
						Duplicate variable name
						{duplicateNames.size === 1 ? "" : "s"} found:{" "}
						<span className="font-mono text-amber-200">
							{[...duplicateNames].join(", ")}
						</span>
					</div>
				)}

				{isImportOpen && (
					<ImportVariablesModal
						columns={columns}
						onClose={() => setIsImportOpen(false)}
						onImport={importVariables}
					/>
				)}

				{isExportOpen && (
					<ExportVariablesModal
						columns={columns}
						variables={variables}
						onClose={() => setIsExportOpen(false)}
					/>
				)}

				<DndContext
					id="env-columns-dnd"
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleColumnDragStart}
					onDragEnd={handleColumnDragEnd}
				>
					<div
						ref={scrollContainerRef}
						className="max-h-[70vh] overflow-auto rounded-lg border border-zinc-800 bg-black"
					>
						<table
							className="border-collapse text-sm w-full"
							style={{ tableLayout: "fixed" }}
						>
							<colgroup>
								<col style={{ width: ROW_NUM_COL_WIDTH }} />
								<col
									style={{
										width: getColumnWidth(
											VARIABLE_COL_ID,
											DEFAULT_VARIABLE_COL_WIDTH,
										),
									}}
								/>
								{columns.map((col) => (
									<col
										key={col.id}
										style={{
											width: getColumnWidth(col.id, DEFAULT_ENV_COL_WIDTH),
										}}
									/>
								))}
								<col style={{ width: 140 }} />
							</colgroup>
							<thead>
								<tr>
									<th className="sticky top-0 left-0 z-20 border-r border-b border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs font-medium text-zinc-500">
										#
									</th>
									<th className="sticky top-0 left-10 z-20 border-r border-b border-zinc-800 bg-zinc-950 px-0 py-0 text-left align-middle">
										<div className="relative flex items-center gap-1 px-3 py-1.5">
											<button
												type="button"
												onClick={toggleSort}
												className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-semibold tracking-wide text-zinc-400 uppercase hover:text-yellow-400"
											>
												Variable
												{sortDirection === "asc" && (
													<ArrowUp size={12} className="text-yellow-400" />
												)}
												{sortDirection === "desc" && (
													<ArrowDown size={12} className="text-yellow-400" />
												)}
												{!sortDirection && (
													<ArrowUpDown size={12} className="text-zinc-600" />
												)}
											</button>
											{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-drag resize handle, pointer-only affordance */}
											<div
												title="Drag to resize column"
												onMouseDown={startColumnResize(
													VARIABLE_COL_ID,
													DEFAULT_VARIABLE_COL_WIDTH,
												)}
												className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize select-none hover:bg-yellow-500 active:bg-yellow-400"
											/>
										</div>
									</th>
									<SortableContext
										items={columns.map((col) => col.id)}
										strategy={horizontalListSortingStrategy}
									>
										{columns.map((col, colIndex) => (
											<SortableEnvColumnHeader
												key={col.id}
												col={col}
												colIndex={colIndex}
												onRename={renameColumn}
												onRemove={removeColumn}
												onResizeStart={startColumnResize(
													col.id,
													DEFAULT_ENV_COL_WIDTH,
												)}
											/>
										))}
									</SortableContext>
									<th className="sticky top-0 z-10 border-b border-zinc-800 bg-black px-2 py-1.5 text-left align-middle">
										<button
											type="button"
											onClick={addColumn}
											className="flex items-center gap-1 rounded border border-dashed border-zinc-700 px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
										>
											<Plus size={13} /> Environment
										</button>
									</th>
								</tr>
							</thead>
							<tbody>
								{virtualPaddingTop > 0 && (
									<tr>
										<td
											colSpan={totalColumnCount}
											style={{ height: virtualPaddingTop }}
										/>
									</tr>
								)}
								{virtualItems.map((virtualRow) => {
									const variable = displayedVariables[virtualRow.index];
									const rowIndex = virtualRow.index;
									const anyValueSet = columns.some(
										(col) => (variable.values[col.id] ?? "").trim() !== "",
									);
									const isDuplicateName = duplicateNames.has(
										variable.name.trim(),
									);
									const rowCellBg = isDuplicateName
										? "bg-amber-500/10 group-hover/row:bg-amber-500/20"
										: "bg-black group-hover/row:bg-zinc-950";
									return (
										<tr
											key={variable.id}
											data-index={virtualRow.index}
											ref={rowVirtualizer.measureElement}
											className="group/row"
										>
											<td
												className={`sticky left-0 z-10 border-r border-b border-zinc-800 px-2 py-1 text-center text-xs text-zinc-600 ${rowCellBg}`}
											>
												{rowIndex + 1}
											</td>
											<td
												className={`sticky left-10 z-10 border-r border-b border-zinc-800 px-0 py-0 ${rowCellBg}`}
											>
												<div className="flex items-center gap-1 px-3 py-1">
													<input
														ref={(el) => {
															nameInputRefs.current[variable.id] = el;
														}}
														value={variable.name}
														onChange={(event) =>
															renameVariable(variable.id, event.target.value)
														}
														placeholder="VARIABLE_NAME"
														className="w-full min-w-0 bg-transparent font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:rounded focus:bg-zinc-900 focus:px-1 focus:ring-2 focus:ring-yellow-500/60"
													/>
													<button
														type="button"
														onClick={() => duplicateVariable(variable.id)}
														aria-label={`Duplicate ${variable.name || "row"}`}
														className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 hover:bg-yellow-500/10 hover:text-yellow-400 group-hover/row:opacity-100"
													>
														<Copy size={13} />
													</button>
													<button
														type="button"
														onClick={() => removeVariable(variable.id)}
														aria-label={`Remove ${variable.name || "row"}`}
														className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover/row:opacity-100"
													>
														<X size={13} />
													</button>
												</div>
											</td>
											{columns.map((col) => {
												const value = variable.values[col.id] ?? "";
												const isMissing = anyValueSet && value.trim() === "";
												const isLink = !isMissing && isUrlValue(value);
												const colorClass = getValueColorClass(value, isMissing);
												const inputClassName = `w-full min-w-0 bg-transparent font-mono text-sm outline-none focus:rounded focus:px-1 focus:ring-2 focus:ring-yellow-500/60 ${colorClass}`;
												return (
													<td
														key={col.id}
														className={`border-r border-b border-zinc-800 px-0 py-0 ${
															isDuplicateName
																? rowCellBg
																: isMissing
																	? "bg-red-500/10"
																	: "bg-black group-hover/row:bg-zinc-950"
														}`}
													>
														<div className="flex items-center gap-1.5 px-3 py-1">
															{isMissing && (
																<AlertTriangle
																	size={13}
																	className="shrink-0 text-red-400"
																/>
															)}
															{wrapValues ? (
																<textarea
																	value={value}
																	onChange={(event) =>
																		setValue(
																			variable.id,
																			col.id,
																			event.target.value,
																		)
																	}
																	placeholder={isMissing ? "Missing" : ""}
																	rows={1}
																	ref={(el) => {
																		if (el) {
																			el.style.height = "auto";
																			el.style.height = `${el.scrollHeight}px`;
																		}
																	}}
																	className={`resize-none overflow-hidden whitespace-pre-wrap break-all ${inputClassName}`}
																/>
															) : (
																<input
																	value={value}
																	onChange={(event) =>
																		setValue(
																			variable.id,
																			col.id,
																			event.target.value,
																		)
																	}
																	placeholder={isMissing ? "Missing" : ""}
																	className={inputClassName}
																/>
															)}
															{isLink && (
																<button
																	type="button"
																	onClick={() =>
																		window.open(
																			value.trim(),
																			"_blank",
																			"noopener,noreferrer",
																		)
																	}
																	aria-label={`Open ${value.trim()}`}
																	className="shrink-0 rounded p-0.5 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
																>
																	<ExternalLink size={12} />
																</button>
															)}
														</div>
													</td>
												);
											})}
											<td className={`border-b border-zinc-800 ${rowCellBg}`} />
										</tr>
									);
								})}
								{virtualPaddingBottom > 0 && (
									<tr>
										<td
											colSpan={totalColumnCount}
											style={{ height: virtualPaddingBottom }}
										/>
									</tr>
								)}
							</tbody>
							<tbody>
								<tr>
									<td className="border-r border-zinc-800 bg-black px-2 py-1.5" />
									<td className="sticky left-10 border-r border-zinc-800 bg-black px-3 py-1.5">
										<button
											type="button"
											onClick={addVariable}
											className="flex items-center gap-1 rounded border border-dashed border-zinc-700 px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
										>
											<Plus size={13} /> Variable
										</button>
									</td>
									{columns.map((col) => (
										<td
											key={col.id}
											className="border-r border-zinc-800 bg-black"
										/>
									))}
									<td className="bg-black" />
								</tr>
							</tbody>
						</table>
					</div>
					<DragOverlay>
						{activeColumnId ? (
							<div className="flex items-center gap-1.5 rounded-md border border-yellow-400 bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-zinc-100">
								<GripVertical size={12} className="text-yellow-400" />
								{columns.find((col) => col.id === activeColumnId)?.name}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>
			</div>
		</div>
	);
}

function SortableEnvColumnHeader({
	col,
	colIndex,
	onRename,
	onRemove,
	onResizeStart,
}: {
	col: EnvColumn;
	colIndex: number;
	onRename: (id: string, name: string) => void;
	onRemove: (id: string) => void;
	onResizeStart: (event: ReactMouseEvent) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: col.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 30 : undefined,
	};

	return (
		<th
			ref={setNodeRef}
			style={style}
			className={`sticky top-0 z-10 border-r border-b border-zinc-800 bg-zinc-950 px-0 py-0 text-left align-middle ${
				isDragging ? "opacity-40" : ""
			}`}
		>
			<div className="group relative flex items-center gap-1 px-3 py-1.5">
				<span
					{...attributes}
					{...listeners}
					title={`Drag to reorder ${col.name}`}
					className="shrink-0 cursor-grab touch-none text-zinc-600 hover:text-yellow-400 active:cursor-grabbing"
				>
					<GripVertical size={12} />
				</span>
				<span className="shrink-0 text-[10px] font-medium text-zinc-600">
					{columnLabel(colIndex)}
				</span>
				<input
					value={col.name}
					onChange={(event) => onRename(col.id, event.target.value)}
					className="w-full min-w-0 bg-transparent text-sm font-semibold text-zinc-200 outline-none focus:rounded focus:bg-black focus:px-1 focus:ring-2 focus:ring-yellow-500/60"
				/>
				<button
					type="button"
					onClick={() => onRemove(col.id)}
					aria-label={`Remove ${col.name}`}
					className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
				>
					<X size={13} />
				</button>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-drag resize handle, pointer-only affordance */}
				<div
					title={`Drag to resize ${col.name} column`}
					onMouseDown={onResizeStart}
					className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize select-none hover:bg-yellow-500 active:bg-yellow-400"
				/>
			</div>
		</th>
	);
}
