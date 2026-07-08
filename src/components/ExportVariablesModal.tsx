import { Check, Copy, Download, X } from "lucide-react";
import { useMemo, useState } from "react";

type EnvColumn = {
	id: string;
	name: string;
};

type EnvVariable = {
	id: string;
	name: string;
	values: Record<string, string>;
};

type ExportFormat = "env" | "json" | "csv";

function slugify(name: string) {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "environment";
}

function formatEnvValue(value: string) {
	const needsQuotes = value === "" || /[\s#"'\\]/.test(value);
	if (!needsQuotes) return value;
	const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escaped}"`;
}

function sortedNamedVariables(variables: EnvVariable[]) {
	return [...variables]
		.filter((variable) => variable.name.trim() !== "")
		.sort((a, b) => a.name.localeCompare(b.name));
}

function buildEnvContent(variables: EnvVariable[], columnId: string) {
	return sortedNamedVariables(variables)
		.map(
			(variable) =>
				`${variable.name}=${formatEnvValue(variable.values[columnId] ?? "")}`,
		)
		.join("\n");
}

function buildJsonContent(variables: EnvVariable[], columnId: string) {
	const entries = sortedNamedVariables(variables).map(
		(variable) => [variable.name, variable.values[columnId] ?? ""] as const,
	);
	return JSON.stringify(Object.fromEntries(entries), null, 2);
}

function csvEscape(value: string) {
	if (/[",\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function buildCsvContent(variables: EnvVariable[], csvColumns: EnvColumn[]) {
	const header = ["KEY", ...csvColumns.map((col) => col.name)].map(csvEscape);
	const rows = sortedNamedVariables(variables).map((variable) =>
		[
			variable.name,
			...csvColumns.map((col) => variable.values[col.id] ?? ""),
		].map(csvEscape),
	);
	return [header, ...rows].map((row) => row.join(",")).join("\n");
}

export function ExportVariablesModal({
	columns,
	variables,
	onClose,
}: {
	columns: EnvColumn[];
	variables: EnvVariable[];
	onClose: () => void;
}) {
	const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
	const [format, setFormat] = useState<ExportFormat>("env");
	const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(
		() => new Set(columns.map((col) => col.id)),
	);
	const [copied, setCopied] = useState(false);

	const selectedColumn = columns.find((col) => col.id === columnId);
	const csvColumns = columns.filter((col) => selectedColumnIds.has(col.id));

	function toggleCsvColumn(id: string) {
		setSelectedColumnIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	const content = useMemo(() => {
		if (format === "csv") {
			return csvColumns.length > 0
				? buildCsvContent(variables, csvColumns)
				: "";
		}
		if (!columnId) return "";
		return format === "env"
			? buildEnvContent(variables, columnId)
			: buildJsonContent(variables, columnId);
	}, [variables, columnId, format, csvColumns]);

	const canDownload =
		format === "csv" ? csvColumns.length > 0 : !!selectedColumn;

	function handleDownload() {
		if (!canDownload) return;
		if (format === "csv") {
			const blob = new Blob([content], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "environment-variables.csv";
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			return;
		}
		if (!selectedColumn) return;
		const extension = format === "env" ? "env" : "json";
		const mimeType = format === "env" ? "text/plain" : "application/json";
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${slugify(selectedColumn.name)}.${extension}`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	}

	async function handleCopy() {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
			<div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-black">
				<div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
					<h2 className="text-base font-semibold text-zinc-100">
						Export Variables
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-yellow-400"
					>
						<X size={16} />
					</button>
				</div>

				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
					<fieldset>
						<legend className="mb-1 block text-xs font-medium text-zinc-500">
							Format
						</legend>
						<div className="flex gap-2">
							{(["env", "json", "csv"] as const).map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => setFormat(option)}
									className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
										format === option
											? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400"
											: "border-zinc-700 text-zinc-300 hover:border-yellow-500/40 hover:text-yellow-400"
									}`}
								>
									{option === "env"
										? ".env"
										: option === "json"
											? "JSON"
											: "CSV"}
								</button>
							))}
						</div>
					</fieldset>

					{format === "csv" ? (
						<fieldset>
							<legend className="mb-1 block text-xs font-medium text-zinc-500">
								Environments to include
							</legend>
							<div className="space-y-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2">
								{columns.map((col) => (
									<label
										key={col.id}
										className="flex items-center gap-2 py-0.5 text-sm text-zinc-200"
									>
										<input
											type="checkbox"
											checked={selectedColumnIds.has(col.id)}
											onChange={() => toggleCsvColumn(col.id)}
											className="size-3.5 rounded border-zinc-600 bg-black text-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
										/>
										{col.name}
									</label>
								))}
							</div>
						</fieldset>
					) : (
						<div>
							<label
								htmlFor="export-column"
								className="mb-1 block text-xs font-medium text-zinc-500"
							>
								Environment
							</label>
							<select
								id="export-column"
								value={columnId}
								onChange={(event) => setColumnId(event.target.value)}
								className="w-full rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
							>
								{columns.map((col) => (
									<option key={col.id} value={col.id}>
										{col.name}
									</option>
								))}
							</select>
						</div>
					)}

					<div>
						<div className="mb-1 flex items-center justify-between">
							<span className="block text-xs font-medium text-zinc-500">
								Preview (sorted A–Z)
							</span>
							<button
								type="button"
								onClick={handleCopy}
								disabled={!content}
								className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{copied ? (
									<>
										<Check size={12} /> Copied
									</>
								) : (
									<>
										<Copy size={12} /> Copy
									</>
								)}
							</button>
						</div>
						<textarea
							readOnly
							value={content}
							rows={10}
							className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-300 outline-none"
						/>
					</div>
				</div>

				<div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleDownload}
						disabled={!canDownload}
						className="flex items-center gap-1.5 rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
					>
						<Download size={14} /> Download
					</button>
				</div>
			</div>
		</div>
	);
}
