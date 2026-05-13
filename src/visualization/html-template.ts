import type { GraphData } from './graph-builder.js';

export function renderHtml(graphData: GraphData, rootPath: string): string {
  const repoName = escAttr(rootPath.split('/').pop() ?? 'Repository');
  const { meta } = graphData;
  // Prevent </script> tag injection from embedded JSON
  const safeData = JSON.stringify(graphData).replace(
    /<\/script>/gi,
    '<\\/script>',
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KGraph \u2014 ${repoName}</title>
<script src="https://unpkg.com/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
<script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;height:100vh;display:flex;flex-direction:column;overflow:hidden}
#toolbar{background:#1e293b;border-bottom:1px solid #334155;padding:10px 16px;display:flex;align-items:center;gap:16px;flex-shrink:0;min-width:0}
#t-title{font-weight:700;font-size:14px;color:#7dd3fc;white-space:nowrap;flex-shrink:0}
#t-stats{color:#64748b;font-size:12px;white-space:nowrap;flex-shrink:0}
#t-controls{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0}
.clabel{display:flex;align-items:center;gap:5px;cursor:pointer;color:#cbd5e1;font-size:12px;white-space:nowrap;user-select:none}
.clabel input{accent-color:#7dd3fc;cursor:pointer}
select,button{background:#334155;border:1px solid #475569;color:#e2e8f0;border-radius:5px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit;transition:background .15s}
select:hover,button:hover{background:#475569}
#main{display:flex;flex:1;overflow:hidden;min-height:0}
#cy{flex:1;min-width:0}
#sidebar{width:290px;background:#1e293b;border-left:1px solid #334155;display:none;flex-direction:column;overflow:hidden;flex-shrink:0}
#sidebar.open{display:flex}
#sb-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #334155;flex-shrink:0}
#sb-type{font-weight:600;color:#7dd3fc;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
#sb-close{background:none;border:none;color:#64748b;font-size:17px;line-height:1;cursor:pointer;padding:0 2px}
#sb-close:hover{color:#e2e8f0;background:none}
#sb-body{padding:14px;overflow-y:auto;flex:1}
.sb-badge{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600;margin-bottom:10px}
.sb-title{font-size:13px;font-weight:700;color:#f1f5f9;word-break:break-all;line-height:1.45;margin-bottom:10px}
.sb-sect{margin-top:14px}
.sb-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#475569;margin-bottom:5px}
.sb-val{color:#94a3b8;font-size:12px}
.sb-code{font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace;font-size:11px;color:#7dd3fc;background:#0f172a;padding:1px 4px;border-radius:3px}
.sb-list{list-style:none;display:flex;flex-direction:column;gap:3px}
.sb-list li{font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace;font-size:11px;color:#7dd3fc;padding:2px 0}
#legend{background:#1e293b;border-top:1px solid #334155;padding:7px 16px;display:flex;align-items:center;gap:14px;flex-shrink:0;flex-wrap:wrap}
.li{display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b}
.li-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;display:inline-block}
.li-dia{width:10px;height:10px;transform:rotate(45deg);flex-shrink:0;display:inline-block}
.li-sep{width:1px;height:14px;background:#334155;flex-shrink:0}
.li-head{font-size:11px;color:#475569;font-weight:700;letter-spacing:.04em}
</style>
</head>
<body>
<div id="toolbar">
  <span id="t-title">\u29e1 KGraph \u00b7 ${repoName}</span>
  <span id="t-stats">${meta.fileCount} files &middot; ${meta.symbolCount} symbols &middot; ${meta.atomCount} atoms${meta.hiddenAtomCount ? ' (' + meta.hiddenAtomCount + ' hidden)' : ''} &middot; ~${meta.tokenEstimate} tokens</span>
  <div id="t-controls">
    <label class="clabel"><input type="checkbox" id="tog-lbl" checked> Labels</label>
    <label class="clabel"><input type="checkbox" id="tog-cog" checked> Memory</label>
    <select id="sel-layout" title="Graph layout algorithm">
      <option value="dagre">Hierarchical</option>
      <option value="cose">Force-directed</option>
      <option value="grid">Grid</option>
      <option value="concentric">Concentric</option>
    </select>
    <button id="btn-fit" title="Fit graph to viewport">\u229f Fit</button>
    <button id="btn-png" title="Download as PNG">\u2193 PNG</button>
  </div>
</div>
<div id="main">
  <div id="cy"></div>
  <div id="sidebar">
    <div id="sb-head">
      <span id="sb-type">Details</span>
      <button id="sb-close" title="Close panel">\u00d7</button>
    </div>
    <div id="sb-body"></div>
  </div>
</div>
<div id="legend">
  <span class="li-head">Files</span>
  <span class="li"><span class="li-dot" style="background:#3b82f6"></span>TypeScript</span>
  <span class="li"><span class="li-dot" style="background:#f59e0b"></span>JavaScript</span>
  <span class="li"><span class="li-dot" style="background:#10b981"></span>Markdown</span>
  <span class="li"><span class="li-dot" style="background:#8b5cf6"></span>YAML</span>
  <span class="li"><span class="li-dot" style="background:#94a3b8"></span>Other</span>
  <span class="li"><span class="li-dot" style="background:#475569"></span>200+ tok</span>
  <span class="li"><span class="li-dot" style="background:#ef4444"></span>1000+ tok</span>
  <span class="li-sep"></span>
  <span class="li-head">Atoms</span>
  <span class="li"><span class="li-dia" style="background:#10b981"></span>Active</span>
  <span class="li"><span class="li-dia" style="background:#f59e0b"></span>Review</span>
  <span class="li"><span class="li-dia" style="background:#ef4444"></span>Stale</span>
  <span class="li-sep"></span>
  <span class="li" style="margin-left:auto;color:#334155;font-size:10px">KGraph v${meta.generatedAt.slice(0, 10)}</span>
</div>
<script>
(function () {
  var GRAPH_DATA = ${safeData};

  if (!GRAPH_DATA.elements.length) {
    document.getElementById('cy').innerHTML =
      '<div style="display:flex;height:100%;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#475569">' +
      '<span style="font-size:36px">\u29e1</span>' +
      '<span>No graph data found. Run <code style="color:#7dd3fc">kgraph scan</code> first.</span>' +
      '</div>';
    return;
  }

  if (typeof cytoscapeDagre !== 'undefined') {
    cytoscape.use(cytoscapeDagre);
  }

  // Separate symbol data from graph elements — symbols are shown in sidebar only.
  var SYMBOL_TYPES = { symbol: 1, contains: 1, 'symbol-contains': 1, calls: 1 };
  var coreElements = [];
  var symbolsByFile = {};
  GRAPH_DATA.elements.forEach(function (el) {
    if (el.data.type === 'symbol') {
      var fp = el.data.path;
      if (!symbolsByFile[fp]) symbolsByFile[fp] = [];
      symbolsByFile[fp].push(el.data);
    } else if (!SYMBOL_TYPES[el.data.type]) {
      coreElements.push(el);
    }
  });

  var LARGE_THRESHOLD = 200;
  var isLarge = coreElements.length > LARGE_THRESHOLD;

  if (isLarge) {
    document.getElementById('tog-lbl').checked = false;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  var cy = cytoscape({
    container: document.getElementById('cy'),
    elements: coreElements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          label: isLarge ? '' : 'data(label)',
          color: '#94a3b8',
          'font-size': '10px',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': '5px',
          'border-width': 1,
          'border-color': '#1e293b',
          width: isLarge ? 20 : 30,
          height: isLarge ? 20 : 30,
          'text-wrap': 'ellipsis',
          'text-max-width': '80px',
          'overlay-opacity': 0
        }
      },
      {
        selector: 'node.atom',
        style: {
          shape: 'diamond',
          width: 40,
          height: 40,
          'background-color': '#0f172a',
          'border-color': 'data(color)',
          'border-width': 2,
          color: '#e2e8f0'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#7dd3fc',
          'border-width': 3,
          'overlay-opacity': 0.06,
          'overlay-color': '#7dd3fc'
        }
      },
      {
        selector: 'node.token-medium',
        style: {
          'border-color': '#f59e0b',
          'border-width': 2
        }
      },
      {
        selector: 'node.token-large',
        style: {
          'border-color': '#ef4444',
          'border-width': 3
        }
      },
      {
        selector: 'edge.import',
        style: {
          width: 1,
          'line-color': '#2d3f55',
          'target-arrow-color': '#2d3f55',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          opacity: 0.7
        }
      },
      {
        selector: 'edge.atom-ref',
        style: {
          width: 1.5,
          'line-color': '#7dd3fc',
          'target-arrow-color': '#7dd3fc',
          'target-arrow-shape': 'triangle',
          'line-style': 'dashed',
          'line-dash-pattern': [5, 3],
          'curve-style': 'bezier',
          opacity: 0.5
        }
      },
      { selector: '.hidden', style: { display: 'none' } }
    ],
    layout: isLarge
      ? { name: 'cose', animate: false, padding: 40, nodeOverlap: 20, idealEdgeLength: 80, numIter: 100 }
      : { name: 'dagre', rankDir: 'LR', nodeSep: 60, rankSep: 120, padding: 40, animate: true, animationDuration: 400 }
  });

  var anim = !isLarge;
  var LAYOUTS = {
    dagre: { name: 'dagre', rankDir: 'LR', nodeSep: 60, rankSep: 120, animate: anim, animationDuration: 400, padding: 40 },
    cose: { name: 'cose', animate: anim, animationDuration: 600, padding: 40 },
    grid: { name: 'grid', animate: anim, animationDuration: 400, padding: 40 },
    concentric: {
      name: 'concentric',
      concentric: function (n) { return n.degree(); },
      levelWidth: function () { return 2; },
      animate: anim,
      animationDuration: 400,
      padding: 40
    }
  };

  var SYMBOL_KIND_COLORS = { 'function': '#22c55e', 'class': '#a855f7', method: '#14b8a6', 'export': '#f97316', 'import': '#64748b' };

  function renderFilePanel(d) {
    var syms = symbolsByFile[d.path] || [];
    var symHtml = '';
    if (syms.length) {
      symHtml = '<div class="sb-sect"><div class="sb-lbl">Symbols (' + syms.length + ')</div><ul class="sb-list">' +
        syms.map(function (s) {
          var c = SYMBOL_KIND_COLORS[s.kind] || '#94a3b8';
          return '<li><span style="color:' + c + ';font-weight:600">' + esc(s.kind) + '</span> <span class="sb-code">' + esc(s.label) + '</span>' +
            (s.parentName ? ' <span style="color:#475569">in ' + esc(s.parentName) + '</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }
    return '<div class="sb-badge" style="background:' + esc(d.color) + '22;color:' + esc(d.color) + ';border:1px solid ' + esc(d.color) + '44">' + esc(d.language) + '</div>' +
      '<div class="sb-title">' + esc(d.path) + '</div>' +
      '<div class="sb-sect"><div class="sb-lbl">Scan Status</div><div class="sb-val">' + esc(d.scanStatus) + '</div></div>' +
      '<div class="sb-sect"><div class="sb-lbl">File Size</div><div class="sb-val">' + bytes(d.size) + '</div></div>' +
      '<div class="sb-sect"><div class="sb-lbl">Estimated Tokens</div><div class="sb-val">~' + esc(d.tokenEstimate || 0) + ' tokens</div></div>' +
      symHtml;
  }

  function renderAtomPanel(d) {
    var sc = { active: '#10b981', 'needs-review': '#f59e0b', stale: '#ef4444', archived: '#6b7280' }[d.status] || '#6b7280';
    var files = d.relatedFiles && d.relatedFiles.length
      ? '<ul class="sb-list">' + d.relatedFiles.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>'
      : '<span class="sb-val">none</span>';
    var syms = d.relatedSymbols && d.relatedSymbols.length
      ? d.relatedSymbols.slice(0, 15).map(function (s) { return '<span class="sb-code">' + esc(s) + '</span>'; }).join(' ')
      : '<span class="sb-val">none</span>';
    var invalidated = d.invalidatedBy && d.invalidatedBy.length
      ? '<div class="sb-sect"><div class="sb-lbl">Invalidated By</div><ul class="sb-list">' + d.invalidatedBy.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>'
      : '';
    return '<div class="sb-badge" style="background:' + sc + '22;color:' + sc + ';border:1px solid ' + sc + '44">' + esc(d.status) + '</div>' +
      '<div class="sb-title">' + esc(d.label) + '</div>' +
      '<div class="sb-sect"><div class="sb-lbl">Atom</div><div class="sb-val"><span class="sb-code">' + esc(d.atomId) + '</span></div></div>' +
      '<div class="sb-sect"><div class="sb-lbl">Type / Confidence</div><div class="sb-val">' + esc(d.atomType) + ' / ' + esc(d.confidence) + '</div></div>' +
      '<div class="sb-sect"><div class="sb-lbl">Source</div><div class="sb-val">' + esc(d.sourceCommand) + '</div></div>' +
      (d.domain ? '<div class="sb-sect"><div class="sb-lbl">Domain</div><div class="sb-val">' + esc(d.domain) + '</div></div>' : '') +
      '<div class="sb-sect"><div class="sb-lbl">Related Files</div>' + files + '</div>' +
      '<div class="sb-sect"><div class="sb-lbl">Symbols</div><div class="sb-val">' + syms + '</div></div>' +
      invalidated;
  }

  cy.on('tap', 'node', function (evt) {
    var d = evt.target.data();
    document.getElementById('sb-type').textContent = d.type === 'atom' ? 'Knowledge Atom' : 'File';
    document.getElementById('sb-body').innerHTML = d.type === 'atom' ? renderAtomPanel(d) : renderFilePanel(d);
    document.getElementById('sidebar').classList.add('open');
  });

  cy.on('tap', function (evt) {
    if (evt.target === cy) {
      document.getElementById('sidebar').classList.remove('open');
    }
  });

  document.getElementById('sb-close').addEventListener('click', function () {
    document.getElementById('sidebar').classList.remove('open');
  });

  document.getElementById('tog-lbl').addEventListener('change', function (e) {
    cy.style().selector('node').style('label', e.target.checked ? 'data(label)' : '').update();
  });

  document.getElementById('tog-cog').addEventListener('change', function (e) {
    if (e.target.checked) {
      cy.nodes('.atom').removeClass('hidden');
      cy.edges('.atom-ref').removeClass('hidden');
    } else {
      cy.nodes('.atom').addClass('hidden');
      cy.edges('.atom-ref').addClass('hidden');
    }
  });

  document.getElementById('sel-layout').addEventListener('change', function (e) {
    cy.layout(LAYOUTS[e.target.value] || LAYOUTS.dagre).run();
  });

  document.getElementById('btn-fit').addEventListener('click', function () {
    cy.fit(undefined, 40);
  });

  document.getElementById('btn-png').addEventListener('click', function () {
    var png = cy.png({ output: 'base64uri', bg: '#0f172a', scale: 2, full: true });
    var a = document.createElement('a');
    a.href = png;
    a.download = 'kgraph-${repoName}.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
})();
</script>
</body>
</html>`;
}

function escAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
