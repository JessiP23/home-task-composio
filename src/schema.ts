import type { NormalizedTool } from "./types.ts";

// Single exclusion list. Used by both output key collection and graph.
export const WRAPPER_KEYS = new Set(["data", "error", "successful", "result"]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const getString = (
	obj: Record<string, unknown>,
	key: string,
): string | undefined => (typeof obj[key] === "string" ? obj[key] : undefined);

/** Collect producer keys: top-level + capped walk under `data`. Skips wrappers and $refs. */
export function collectProducerKeys(
	outputSchema: unknown,
	maxDepth = 3, // 4 was too deep for most APIs
	maxKeys = 32, // 64 is overkill; top 32 covers 99% of cases
): string[] {
	const keys = new Set<string>();
	if (!isRecord(outputSchema) || !isRecord(outputSchema.properties)) return [];

	const { properties } = outputSchema;

	// 1. Top-level keys
	for (const k of Object.keys(properties)) {
		if (!WRAPPER_KEYS.has(k.toLowerCase())) keys.add(k);
	}

	// 2. Capped DFS under `data` only
	const dataNode = properties.data;
	if (isRecord(dataNode)) {
		let count = 0;
		const dfs = (node: unknown, depth: number) => {
			if (depth > maxDepth || count >= maxKeys || !isRecord(node)) return;
			if (typeof node.$ref === "string") return; // skip unresolved refs

			if (isRecord(node.properties)) {
				for (const [k, v] of Object.entries(node.properties)) {
					if (count >= maxKeys) return;
					if (!WRAPPER_KEYS.has(k.toLowerCase())) keys.add(k);
					count++;
					dfs(v, depth + 1);
				}
			}
			if (isRecord(node.items)) dfs(node.items, depth + 1);
			if (Array.isArray(node.allOf)) for (const n of node.allOf) dfs(n, depth);
		};
		dfs(dataNode, 0);
	}

	return [...keys];
}

export function normalizeInputs(
	inputSchema: unknown,
): NormalizedTool["inputs"] {
	if (!isRecord(inputSchema) || !isRecord(inputSchema.properties)) return [];

	const required = new Set(
		Array.isArray(inputSchema.required)
			? inputSchema.required.filter((x): x is string => typeof x === "string")
			: [],
	);

	return Object.entries(inputSchema.properties).map(([name, def]) => ({
		name,
		required: required.has(name),
		...(isRecord(def) && typeof def.type === "string" && { type: def.type }),
		...(isRecord(def) && {
			desc: getString(def, "description") ?? getString(def, "title"),
		}),
	}));
}

export function normalizeComposioTool(raw: unknown): NormalizedTool | null {
	if (!isRecord(raw)) return null;
	const {
		slug,
		name,
		description,
		inputParameters,
		outputParameters,
		toolkit,
	} = raw;
	if (typeof slug !== "string" || typeof name !== "string") return null;

	return {
		id: slug,
		toolkit: isRecord(toolkit)
			? (getString(toolkit, "slug") ?? "unknown")
			: "unknown",
		name,
		description: typeof description === "string" ? description : "",
		inputs: normalizeInputs(inputParameters),
		producerKeys: collectProducerKeys(outputParameters),
	};
}

export const normalizeComposioTools = (rawTools: unknown): NormalizedTool[] => {
	if (!Array.isArray(rawTools)) return [];
	const seen = new Set<string>();
	const out: NormalizedTool[] = [];
	for (const raw of rawTools) {
		const t = normalizeComposioTool(raw);
		if (t && !seen.has(t.id)) {
			seen.add(t.id);
			out.push(t);
		}
	}
	return out;
};
