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

/** Single self-contained HTML (data inlined; open file directly in browser). */
export async function writeGraphHtml(
	path: string,
	data: GraphHtmlPayload,
): Promise<void> {
	const json = JSON.stringify(data).replace(/</g, "\\u003c");
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Composio tool dependency graph</title>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
<style>
body{margin:0;font-family:system-ui,sans-serif}
#bar{padding:10px 14px;background:#121826;color:#e2e8f0;font-size:13px;line-height:1.4}
#cy{width:100vw;height:calc(100vh - 52px);display:block;background:#0f172a}
</style>
</head>
<body>
<div id="bar"><strong id="s"></strong><br/><span style="opacity:.85">Pan: drag background. Zoom: scroll. Directed edges: producer → consumer.</span></div>
<div id="cy"></div>
<script>
const DATA=${json};
(function(){
var active=new Set();
DATA.edges.forEach(function(e){active.add(e.from);active.add(e.to);});
var pal={googlesuper:"#38bdf8",github:"#a78bfa",unknown:"#94a3b8"};
var els=[];
DATA.nodes.forEach(function(n){
  if(!active.has(n.id))return;
  var short=n.id.indexOf("_")>=0?n.id.slice(n.id.indexOf("_")+1):n.id;
  if(short.length>40)short=short.slice(0,37)+"...";
  els.push({data:{id:n.id,lab:short,tk:n.toolkit,color:pal[n.toolkit]||pal.unknown}});
});
var ei=0;
DATA.edges.forEach(function(e){
  els.push({data:{id:"e"+(++ei),source:e.from,target:e.to,via:e.via,kind:e.kind}});
});
var nn=els.filter(function(x){return !x.data.source;}).length;
document.getElementById("s").textContent=nn+" nodes, "+DATA.edgeCount+" edges (subset: tools on at least one edge)";
var cyel=document.getElementById("cy");
if(DATA.edgeCount===0){cyel.textContent="No edges yet — run the pipeline with a valid API key.";return;}
cytoscape({
  container:cyel,
  elements:els,
  style:[
    {selector:"node",style:{label:"data(lab)","background-color":"data(color)",width:34,height:34,"font-size":8,color:"#0f172a","text-wrap":"ellipsis","text-max-width":80,"text-valign":"center","text-halign":"center"}},
    {selector:"edge",style:{width:2,"line-color":"#64748b","target-arrow-color":"#64748b","curve-style":"bezier","target-arrow-shape":"triangle",label:"data(via)","font-size":7,color:"#94a3b8"}}
  ],
  layout:{name:"cose",idealEdgeLength:100,nodeOverlap:16,padding:24},
  wheelSensitivity:0.25
});
})();
</script>
</body>
</html>`;
	await writeFile(path, html, "utf-8");
}
