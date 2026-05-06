export type NormalizedTool = {
	id: string;
	toolkit: string;
	name: string;
	description: string;
	inputs: Array<{
		name: string;
		required: boolean;
		type?: string;
		desc?: string;
	}>;
	outputKeys: string[];
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v!== null &&!Array.isArray(v);

const getString = (obj: Record<string, unknown>, key: string): string | undefined => typeof obj[key] === "string"? obj[key] : undefined;

function normalizeInputs(inputParameters: unknown): NormalizedTool["inputs"] {
	if (!isRecord(inputParameters) || !isRecord(inputParameters.properties)) return [];
	
	const required = new Set(
		Array.isArray(inputParameters.required)
			? inputParameters.required.filter((x): x is string => typeof x === "string")
			: []
	);

	return Object.entries(inputParameters.properties).map(([name, def]) => ({
		name,
		required: required.has(name),
		...(isRecord(def) && typeof def.type === "string" && { type: def.type }),
		...(isRecord(def) && { desc: getString(def, "description")?? getString(def, "title") })
	}));
}

export function normalizeComposioTool(raw: unknown): NormalizedTool | null {
	if (!isRecord(raw)) return null;
	
	const { slug, name, description, inputParameters, outputParameters, toolkit } = raw;
	if (typeof slug!== "string" || typeof name!== "string") return null;

	return {
		id: slug,
		toolkit: isRecord(toolkit)? getString(toolkit, "slug")?? "unknown" : "unknown",
		name,
		description: typeof description === "string"? description : "",
		inputs: normalizeInputs(inputParameters),
		outputKeys: isRecord(outputParameters) && isRecord(outputParameters.properties)
			? Object.keys(outputParameters.properties)
			: []
	};
}

export const normalizeComposioTools = (rawTools: unknown): NormalizedTool[] =>
	Array.isArray(rawTools)
		? rawTools.map(normalizeComposioTool).filter((t): t is NormalizedTool => t!== null)
		: [];