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
	producerKeys: string[]; // merged: top-level + data.* walk. No outputKeys needed.
};

export type GraphEdge = {
	from: string;
	to: string;
	via: string;
	producerKey: string;
	confidence: number;
	kind: "exact" | "id_variant" | "description_ref";
	inputRequired: boolean;
};

export type GraphNode = {
	id: string;
	toolkit: string;
	name: string;
	inDegree: number;
	outDegree: number;
};

export type GraphResult = {
	nodes: GraphNode[];
	edges: GraphEdge[];
};

export type BuildGraphOptions = {
	requiredInputsOnly?: boolean; // default: true
};
