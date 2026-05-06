import { writeFile } from "node:fs/promises";
import { Composio } from "@composio/core";
import { buildDependencyGraph } from "./graph.ts";
import { normalizeComposioTools } from "./schema.ts";

const composio = new Composio();

const [toolsGoogle, toolsGithub] = await Promise.all([
	composio.tools.getRawComposioTools({
		toolkits: ["googlesuper"],
		limit: 2500,
	}),
	composio.tools.getRawComposioTools({
		toolkits: ["github"],
		limit: 2500,
	}),
]);

const unified = normalizeComposioTools([...toolsGoogle, ...toolsGithub]);
const graph = buildDependencyGraph(unified, { requiredInputsOnly: true });

await Promise.all([
	writeFile(
		"googlesuper_tools.json",
		JSON.stringify(toolsGoogle, null, 2),
		"utf-8",
	),
	writeFile("github_tools.json", JSON.stringify(toolsGithub, null, 2), "utf-8"),
	writeFile("tools_unified.json", JSON.stringify(unified, null, 2), "utf-8"),
	writeFile(
		"graph.json",
		JSON.stringify(
			{
				nodes: graph.nodes.map((n) => ({
					id: n.id,
					toolkit: n.toolkit,
					degree: n.inDegree + n.outDegree,
				})),
				edges: graph.edges.map((e) => ({
					from: e.from,
					to: e.to,
					via: e.via,
					kind: e.kind,
					confidence: e.confidence,
				})),
				nodeCount: graph.nodes.length,
				edgeCount: graph.edges.length,
				meta: {
					generated_at: new Date().toISOString().slice(0, 10),
					assumptions: [
						"producer keys: top-level output params + capped flatten under data (inline schema only)",
						"description_ref: tool slug must appear verbatim in name/description",
						"param match: inverted index on producerKeys with _id stem fallback",
					],
				},
			},
			null,
			2,
		),
		"utf-8",
	),
]);

console.log(
	`Wrote googlesuper_tools.json (${toolsGoogle.length}), github_tools.json (${toolsGithub.length}), tools_unified.json (${unified.length}), graph.json (${graph.edges.length} edges)`,
);
