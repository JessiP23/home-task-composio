import { WRAPPER_KEYS } from "./schema.ts";
import type {
	BuildGraphOptions,
	GraphEdge,
	GraphNode,
	GraphResult,
	NormalizedTool,
} from "./types.ts";

const CONFIDENCE = {
	EXACT: 1.0,
	ID_VARIANT: 0.85,
	DESCRIPTION_REF: 0.75,
} as const;

const SLUG_PATTERN = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
const normalizeKey = (s: string) => s.toLowerCase();

function buildOutputIndex(
	tools: readonly NormalizedTool[],
): Map<string, Set<string>> {
	const index = new Map<string, Set<string>>();
	for (const { id, producerKeys } of tools) {
		for (const key of producerKeys) {
			const k = normalizeKey(key);
			if (WRAPPER_KEYS.has(k)) continue; // defensive: schema should already filter
			let bucket = index.get(k);
			if (!bucket) {
				bucket = new Set();
				index.set(k, bucket);
			}
			bucket.add(id);
		}
	}
	return index;
}

function findProducers(
	index: Map<string, Set<string>>,
	inputName: string,
): Array<{
	producerId: string;
	producerKey: string;
	confidence: number;
	kind: "exact" | "id_variant";
}> {
	const key = normalizeKey(inputName);
	const results: Array<{
		producerId: string;
		producerKey: string;
		confidence: number;
		kind: "exact" | "id_variant";
	}> = [];
	const seen = new Set<string>();

	const collect = (
		lookup: string,
		confidence: number,
		kind: "exact" | "id_variant",
	) => {
		const bucket = index.get(lookup);
		if (!bucket) return;
		for (const producerId of bucket) {
			if (seen.has(producerId)) continue;
			seen.add(producerId);
			results.push({ producerId, producerKey: lookup, confidence, kind });
		}
	};

	collect(key, CONFIDENCE.EXACT, "exact");
	if (results.length) return results;

	key.endsWith("_id") && key.length > 3
		? collect(key.slice(0, -3), CONFIDENCE.ID_VARIANT, "id_variant")
		: collect(`${key}_id`, CONFIDENCE.ID_VARIANT, "id_variant");

	return results;
}

function buildDescriptionRefEdges(
	tools: readonly NormalizedTool[],
): GraphEdge[] {
	const idSet = new Set<string>();
	for (const t of tools) idSet.add(t.id);
	const edges: GraphEdge[] = [];

	for (const consumer of tools) {
		const text = `${consumer.name} ${consumer.description}`;
		if (text.length < 10) continue; // skip empty descs, micro-optimization

		const matches = text.matchAll(new RegExp(SLUG_PATTERN.source, "g"));
		const seen = new Set<string>();

		for (const m of matches) {
			const producerId = m[1];
			if (producerId === undefined) continue;
			if (
				producerId === consumer.id ||
				!idSet.has(producerId) ||
				seen.has(producerId)
			)
				continue;
			seen.add(producerId);
			edges.push({
				from: producerId,
				to: consumer.id,
				via: "description",
				producerKey: producerId,
				confidence: CONFIDENCE.DESCRIPTION_REF,
				kind: "description_ref",
				inputRequired: false,
			});
		}
	}
	return edges;
}

export function buildDependencyGraph(
	tools: readonly NormalizedTool[],
	{ requiredInputsOnly = true }: BuildGraphOptions = {},
): GraphResult {
	const index = buildOutputIndex(tools);
	const edges: GraphEdge[] = buildDescriptionRefEdges(tools);
	const edgeKey = (e: GraphEdge) => `${e.from}\0${e.to}\0${e.via}\0${e.kind}`;
	const seen = new Set(edges.map(edgeKey));

	const degrees = new Map(tools.map((t) => [t.id, { in: 0, out: 0 }]));
	const bump = (from: string, to: string) => {
		const a = degrees.get(from);
		const b = degrees.get(to);
		if (a && b) {
			a.out++;
			b.in++;
		}
	};

	for (const e of edges) bump(e.from, e.to);

	for (const consumer of tools) {
		for (const input of consumer.inputs) {
			if (requiredInputsOnly && !input.required) continue;

			for (const { producerId, producerKey, confidence, kind } of findProducers(
				index,
				input.name,
			)) {
				if (producerId === consumer.id) continue;

				const edge: GraphEdge = {
					from: producerId,
					to: consumer.id,
					via: input.name,
					producerKey,
					confidence,
					kind,
					inputRequired: input.required,
				};

				const key = edgeKey(edge);
				if (seen.has(key)) continue;
				seen.add(key);
				edges.push(edge);
				bump(producerId, consumer.id);
			}
		}
	}

	const nodes: GraphNode[] = tools.map((t) => ({
		id: t.id,
		toolkit: t.toolkit,
		name: t.name,
		inDegree: degrees.get(t.id)?.in ?? 0,
		outDegree: degrees.get(t.id)?.out ?? 0,
	}));

	return { nodes, edges };
}
