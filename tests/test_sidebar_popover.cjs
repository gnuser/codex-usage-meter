'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; this.hidden = false; this._text = ''; }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  setAttribute(k,v) { this.attributes[k] = v; }
  append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
  appendChild(n) { n.remove(); n.parent = this; this.children.push(n); }
  replaceChildren(...nodes) { this.children.forEach(n => n.parent = null); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; }
  insertBefore(n,b) { n.remove(); const i = b ? this.children.indexOf(b) : this.children.length; this.children.splice(i,0,n); n.parent = this; }
}
const context = {document: {createElement: tag => new Element(tag)}, Date};
vm.createContext(context);
vm.runInContext(fs.readFileSync('integrations/sidebar/popover.js','utf8'), context);
const panel = new Element('div');
const view = context.createUsagePopover(panel, () => {}, () => {});
const find = cls => {
 const walk = n => n.className === cls ? n : n.children.map(walk).find(Boolean);
 return walk(panel);
};
const item = {id:'00000000-0000-0000-0000-000000000001', title:'<script>plain text</script>',updatedAt:Date.now()/1000,usage:{totals:'Turn 10K',io:'In 9K',bars:[null,0,10],models:[{name:'Model',io:'In 9K'}]}};
const data = {tooltipRows:[{label:'Week',value:'68% left',tone:'normal'},{label:'Resets in',value:'5d 12h',tone:'info'},{label:'Reset credits',value:'3'},{label:'First expires',value:'5d 6h'}],activeSessions:{ok:true,checkedAt:Date.now(),items:[item]}};
view.update(data);
assert.equal(find('up-link').textContent, item.title);
assert.equal(find('up-remaining').textContent,'68% left');
assert.equal(find('up-reset').textContent,'Reset in 5d 12h');
assert.equal(find('up-expiry').textContent,'Expires in 5d 6h');
const card = find('up-card');
const toggle = card.children[0].children[3];
toggle.onclick();
assert.equal(find('up-models').hidden, false);
find('up-news up-section').open = true;
view.update({...data,activeSessions:{...data.activeSessions, items:[{...item,usage:{...item.usage,totals:'Turn 20K'}}]}});
assert.equal(find('up-card'),card,'refresh preserves card and controls');
assert.equal(find('up-models').hidden,false,'refresh preserves expansion');
assert.equal(find('up-news up-section').open,true);
assert.equal(find('up-total').textContent,'Turn 20K');
view.update({...data,activeSessions:{...data.activeSessions,checkedAt:Date.now()-31000}});
assert.match(find('up-list').textContent,/unavailable/);
view.update({...data,activeSessions:{...data.activeSessions,items:[{...item,id:'javascript:bad'}]}});
assert.match(find('up-list').textContent,/No recent/);
view.update({...data,activeSessions:{...data.activeSessions,items:[{...item,updatedAt:Date.now()/1000-1801}]}});
assert.match(find('up-list').textContent,/No recent/);
console.log('Unified popover: safe text, validated links, freshness and stable expanded controls passed');
