import { writeFile } from "node:fs/promises";

export type GraphHtmlPayload = {
	nodes: Array<{ id: string; toolkit: string; degree: number }>;
	edges: Array<{
		from: string;
		to: string;
		via: string;
		kind: string;
		confidence: number;
	}>;
	edgeCount: number;
};

/** Self-contained HTML with modern, clean styling. Open directly in browser. */
export async function writeGraphHtml(
	path: string,
	data: GraphHtmlPayload,
): Promise<void> {
	const json = JSON.stringify(data).replace(/</g, "\\u003c");
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Tool Dependency Graph</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
<script src="https://unpkg.com/layout-base/layout-base.js"></script>
<script src="https://unpkg.com/cose-base/cose-base.js"></script>
<script src="https://unpkg.com/cytoscape-cose-bilkent/cytoscape-cose-bilkent.js"></script>
<style>
  :root {
    --bg: #ffffff;
    --panel: #f8fafc;
    --border: #e2e8f0;
    --text: #0f172a;
    --text-muted: #64748b;
    --accent: #3b82f6;
  }
    * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    overflow: hidden;
  }
  #header {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
  }
  #title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }
  #stats {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    gap: 16px;
  }
  .stat { display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  #cy {
    width: 100vw;
    height: 100vh;
    display: block;
  }
  #legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
  }
  #empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
</head>
<body>
  <div id="header">
    <h1 id="title">Tool Dependency Graph</h1>
    <div id="stats">
      <div class="stat"><span id="node-count">0</span> nodes</div>
      <div class="stat"><span id="edge-count">0</span> edges</div>
      <div class="stat" id="googlesuper-legend" style="display:none">
        <div class="dot" style="background:#0ea5e9"></div> googlesuper
      </div>
      <div class="stat" id="github-legend" style="display:none">
        <div class="dot" style="background:#8b5cf6"></div> github
      </div>
    </div>
  </div>
  <div id="legend">Scroll to zoom • Drag to pan • Drag node to reposition</div>
  <div id="cy"></div>
  <div id="empty" style="display:none">No edges found. Check your API key and tool data.</div>

<script>
const DATA = ${json};
(function() {
  const TOOLKIT_COLORS = {
    googlesuper: '#0ea5e9', // sky-500
    github: '#8b5cf6',      // violet-500
    unknown: '#94a3b8'      // slate-400
  };

  // Filter to only nodes that appear in edges, to reduce clutter
  const activeNodes = new Set();
  DATA.edges.forEach(e => { activeNodes.add(e.from); activeNodes.add(e.to); });

  const elements = [];
  const toolkitsPresent = new Set();

  DATA.nodes.forEach(n => {
    if (!activeNodes.has(n.id)) return;
    toolkitsPresent.add(n.toolkit);
    
    // Clean label: remove toolkit prefix, truncate
    const label = n.id.includes('_') ? n.id.split('_').slice(1).join('_') : n.id;
    
    elements.push({
      data: {
        id: n.id,
        label: label.length > 24 ? label.slice(0, 21) + '…' : label,
        fullLabel: label,
        toolkit: n.toolkit,
        degree: n.degree
      }
    });
  });

  DATA.edges.forEach((e, i) => {
    elements.push({
      data: {
        id: 'e' + i,
        source: e.from,
        target: e.to,
        via: e.via,
        kind: e.kind,
        confidence: e.confidence
      }
    });
  });

  // Update header stats
  document.getElementById('node-count').textContent = activeNodes.size;
  document.getElementById('edge-count').textContent = DATA.edgeCount;
  if (toolkitsPresent.has('googlesuper')) document.getElementById('googlesuper-legend').style.display = 'flex';
  if (toolkitsPresent.has('github')) document.getElementById('github-legend').style.display = 'flex';

  if (DATA.edgeCount === 0) {
    document.getElementById('empty').style.display = 'block';
    return;
  }

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': ele => TOOLKIT_COLORS[ele.data('toolkit')] || TOOLKIT_COLORS.unknown,
          'label': 'data(label)',
          'width': ele => 20 + Math.min(ele.data('degree') * 2, 20),
          'height': ele => 20 + Math.min(ele.data('degree') * 2, 20),
          'font-family': 'Inter, sans-serif',
          'font-size': 10,
          'font-weight': 500,
          'color': '#1e293b',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-outline-width': 2,
          'text-outline-color': '#ffffff',
          'text-outline-opacity': 0.8,
          'overlay-opacity': 0,
          'border-width': 1.5,
          'border-color': '#ffffff',
          'border-opacity': 1,
        }
      },
      {
        selector: 'node:hover',
        style: {
          'label': 'data(fullLabel)',
          'z-index': 999,
          'border-width': 2,
          'border-color': '#3b82f6',
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 2.5,
          'border-color': '#2563eb',
        }
      },
      {
        selector: 'edge',
        style: {
          'width': ele => 1 + ele.data('confidence') * 1.5,
          'line-color': '#cbd5e1',
          'target-arrow-color': '#cbd5e1',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.8,
          'curve-style': 'bezier',
          'opacity': 0.7,
          'overlay-opacity': 0,
        }
      },
      {
        selector: 'edge:hover',
        style: {
          'label': 'data(via)',
          'font-family': 'Inter, sans-serif',
          'font-size': 9,
          'color': '#475569',
          'text-background-opacity': 1,
          'text-background-color': '#ffffff',
          'text-background-padding': 2,
          'text-background-shape': 'roundrectangle',
          'line-color': '#3b82f6',
          'target-arrow-color': '#3b82f6',
          'opacity': 1,
          'z-index': 999,
        }
      },
      {
        selector: 'edge.kind-description_ref',
        style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 3] }
      }
    ],
    layout: {
      name: 'cose-bilkent',
      quality: 'proof',
      nodeDimensionsIncludeLabels: true,
      randomize: false,
      animate: 'end',
      animationDuration: 1000,
      fit: true,
      padding: 50,
      nodeRepulsion: 8000,
      idealEdgeLength: 80,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 2500,
      tile: true
    },
    wheelSensitivity: 0.2,
    minZoom: 0.2,
    maxZoom: 3
  });

  // Show tooltip on hover
  cy.on('mouseover', 'node', (e) => {
    e.target.style('label', e.target.data('fullLabel'));
  });
  cy.on('mouseout', 'node', (e) => {
    e.target.style('label', e.target.data('label'));
  });

})();
</script>
</body>
</html>`;
	await writeFile(path, html, "utf-8");
}