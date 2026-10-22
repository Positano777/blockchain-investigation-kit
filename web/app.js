'use strict';
const $ = id => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
let current;
function element(tag, attrs, text) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}
function inspect(index) {
  const edge = current.edges[index];
  $('details').replaceChildren();
  for (const [label, value] of [['Record', edge.id], ['Relationship', edge.kind], ['Amount', `${edge.amount} ${edge.unit}`], ['From / observation anchor', edge.from], ['To / observed fee payer', edge.to], ['Time', edge.timestamp === null ? 'Not supplied in observation export' : new Date(edge.timestamp * 1000).toISOString()]]) {
    const p = document.createElement('p');
    const title = document.createElement('strong'); title.textContent = label + ': ';
    const content = document.createElement('code'); content.textContent = value;
    p.append(title, content); $('details').append(p);
  }
  const warning = document.createElement('p'); warning.textContent = 'Synthetic identifier: this explorer link is a format example, not evidence of an existing transaction.';
  const link = document.createElement('a'); link.textContent = 'Explorer reference'; link.href = edge.source; link.rel = 'noopener noreferrer'; link.target = '_blank';
  $('details').append(warning, link);
  document.querySelectorAll('.edge').forEach((line, i) => line.classList.toggle('active', i === index));
}
async function show(network) {
  const response = await fetch(`${network}-case.json`);
  if (!response.ok) throw new Error('Case unavailable');
  current = await response.json();
  for (const key of ['eth', 'sol']) $(key).setAttribute('aria-pressed', String(key === network));
  $('download').href = `${network}-case.json`;
  $('coverage').textContent = `SYNTHETIC EXAMPLE. ${current.coverage} Case digest: ${current.digest}`;
  $('graph-title').textContent = `${current.nodes.length} nodes / ${current.edges.length} ${network === 'eth' ? 'reported transfers' : 'observations'}`;
  const positions = new Map(current.nodes.map((node, i) => [node.id, network === 'eth' ? [100 + i * 240, 175] : i === 0 ? [350, 175] : [350 + 240 * Math.cos((i - 1) * Math.PI / 3), 175 + 135 * Math.sin((i - 1) * Math.PI / 3)]]));
  $('graph').replaceChildren(); $('records').replaceChildren();
  current.edges.forEach((edge, i) => {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    const line = element('line', {x1:a[0], y1:a[1], x2:b[0], y2:b[1], class:'edge'});
    line.addEventListener('click', () => inspect(i)); $('graph').append(line);
    const row = document.createElement('button'); row.className = 'row';
    row.textContent = `${i + 1}. ${edge.kind.replaceAll('_', ' ')} / ${edge.amount} ${edge.unit}`;
    const sub = document.createElement('span'); sub.textContent = edge.id.slice(0, 22) + '...'; row.append(sub);
    row.addEventListener('click', () => inspect(i)); $('records').append(row);
  });
  for (const node of current.nodes) {
    const [x,y] = positions.get(node.id);
    $('graph').append(element('circle', {cx:x,cy:y,r:17}), element('text', {x,y:y+35,'text-anchor':'middle'}, node.id.slice(0, 7)+'...'+node.id.slice(-4)));
  }
  if (current.edges.length) inspect(0);
}
for (const network of ['eth','sol']) $(network).addEventListener('click', () => show(network).catch(() => { $('details').textContent = 'Unable to load bundled case.'; }));
show('eth').catch(() => { $('details').textContent = 'Serve this folder over localhost using the README command.'; });
