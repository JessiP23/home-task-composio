import { writeFile } from "node:fs/promises";
import { Composio } from "@composio/core";
import { normalizeComposioTools } from "./normalize.ts";

const composio = new Composio();

const [toolsGoogle, toolsGithub] = await Promise.all([
	composio.tools.getRawComposioTools({
		toolkits: ["googlesuper"],
		limit: 1000,
	}),
	composio.tools.getRawComposioTools({
		toolkits: ["github"],
		limit: 1000,
	}),
]);

const unified = normalizeComposioTools([...toolsGoogle, ...toolsGithub]);

await Promise.all([
	writeFile(
		"googlesuper_tools.json",
		JSON.stringify(toolsGoogle, null, 2),
		"utf-8",
	),
	writeFile("github_tools.json", JSON.stringify(toolsGithub, null, 2), "utf-8"),
	writeFile("tools_unified.json", JSON.stringify(unified, null, 2), "utf-8"),
]);

console.log(`Wrote googlesuper_tools.json (${toolsGoogle.length}), github_tools.json (${toolsGithub.length}), tools_unified.json (${unified.length})`,);
