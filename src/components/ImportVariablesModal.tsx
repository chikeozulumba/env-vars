import { AlertCircle, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";

type EnvColumn = {
	id: string;
	name: string;
};

type ImportTarget = { columnId: string } | { newColumnName: string };

const NEW_ENV_OPTION = "__new__";

function parseEnvFile(text: string) {
	const result: Record<string, string> = {};
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const withoutExport = line.startsWith("export ") ? line.slice(7) : line;
		const eqIndex = withoutExport.indexOf("=");
		if (eqIndex === -1) continue;
		const key = withoutExport.slice(0, eqIndex).trim();
		let value = withoutExport.slice(eqIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (key) result[key] = value;
	}
	return result;
}

function parseJsonFile(text: string) {
	const parsed = JSON.parse(text);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("JSON must be a flat object of key-value pairs");
	}
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(
		parsed as Record<string, unknown>,
	)) {
		result[key] =
			value !== null && typeof value === "object"
				? JSON.stringify(value)
				: String(value);
	}
	return result;
}

function parseImportText(text: string) {
	const trimmed = text.trim();
	if (!trimmed) {
		return {
			format: null as "json" | "env" | null,
			values: {} as Record<string, string>,
		};
	}
	try {
		return { format: "json" as const, values: parseJsonFile(trimmed) };
	} catch {
		const values = parseEnvFile(trimmed);
		if (Object.keys(values).length === 0) {
			return { format: null, values: {} };
		}
		return { format: "env" as const, values };
	}
}

export function ImportVariablesModal({
	columns,
	onClose,
	onImport,
}: {
	columns: EnvColumn[];
	onClose: () => void;
	onImport: (target: ImportTarget, values: Record<string, string>) => void;
}) {
	const [target, setTarget] = useState(columns[0]?.id ?? NEW_ENV_OPTION);
	const [newColumnName, setNewColumnName] = useState("");
	const [rawText, setRawText] = useState("");

	const { format, values } = useMemo(() => parseImportText(rawText), [rawText]);
	const entries = Object.entries(values);
	const hasError = rawText.trim() !== "" && format === null;
	const isNewTarget = target === NEW_ENV_OPTION;
	const canImport =
		entries.length > 0 && (!isNewTarget || newColumnName.trim() !== "");

	async function handleFile(file: File) {
		setRawText(await file.text());
	}

	function handleSubmit() {
		if (!canImport) return;
		onImport(
			isNewTarget
				? { newColumnName: newColumnName.trim() }
				: { columnId: target },
			values,
		);
		onClose();
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
			<div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-black">
				<div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
					<h2 className="text-base font-semibold text-zinc-100">
						Import Variables
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
					<div>
						<label
							htmlFor="import-target"
							className="mb-1 block text-xs font-medium text-zinc-500"
						>
							Import into environment
						</label>
						<select
							id="import-target"
							value={target}
							onChange={(event) => setTarget(event.target.value)}
							className="w-full rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
						>
							{columns.map((col) => (
								<option key={col.id} value={col.id}>
									{col.name}
								</option>
							))}
							<option value={NEW_ENV_OPTION}>+ New environment…</option>
						</select>
						{isNewTarget && (
							<input
								// biome-ignore lint/a11y/noAutofocus: modal just opened, focus should move to the newly revealed field
								autoFocus
								value={newColumnName}
								onChange={(event) => setNewColumnName(event.target.value)}
								placeholder="Environment name"
								className="mt-2 w-full rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
							/>
						)}
					</div>

					<div>
						<label
							htmlFor="import-file"
							className="mb-1 block text-xs font-medium text-zinc-500"
						>
							Upload a .env or .json file
						</label>
						<input
							id="import-file"
							type="file"
							accept=".env,.json,text/plain,application/json"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) handleFile(file);
							}}
							className="block w-full text-sm text-zinc-500 file:mr-3 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-200 hover:file:border-yellow-500/50 hover:file:text-yellow-400"
						/>
					</div>

					<div>
						<label
							htmlFor="import-text"
							className="mb-1 block text-xs font-medium text-zinc-500"
						>
							Or paste contents
						</label>
						<textarea
							id="import-text"
							value={rawText}
							onChange={(event) => setRawText(event.target.value)}
							rows={8}
							placeholder={
								'API_URL=https://example.com\nDATABASE_URL="postgres://..."\n\nor\n\n{ "API_URL": "https://example.com" }'
							}
							className="w-full rounded-md border border-zinc-700 bg-black px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
						/>
					</div>

					{hasError && (
						<div className="flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
							<AlertCircle size={14} className="shrink-0" />
							Couldn't detect a valid .env or JSON format. Check for syntax
							errors.
						</div>
					)}

					{!hasError && entries.length > 0 && (
						<div className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
							<span className="font-medium text-zinc-100">
								{entries.length} variable{entries.length === 1 ? "" : "s"}
							</span>{" "}
							detected ({format === "json" ? "JSON" : ".env"} format):{" "}
							<span className="font-mono text-zinc-300">
								{entries
									.slice(0, 6)
									.map(([key]) => key)
									.join(", ")}
								{entries.length > 6 ? `, +${entries.length - 6} more` : ""}
							</span>
						</div>
					)}
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
						onClick={handleSubmit}
						disabled={!canImport}
						className="flex items-center gap-1.5 rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
					>
						<Upload size={14} /> Import
					</button>
				</div>
			</div>
		</div>
	);
}
