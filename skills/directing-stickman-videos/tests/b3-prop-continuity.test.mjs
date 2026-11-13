import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileProps} from '../scripts/b3-prop-continuity.mjs';

test('B3 repairs repeated prop artwork and motion resets across cuts', () => {
  const project = {shots:[
    {layers:[{type:'group',id:'paper_0',x:0,keys:[{t:0,x:0},{t:5,x:50}],children:[{type:'text',text:'MILK',color:'#222'}]}]},
    {layers:[{type:'group',id:'paper_1',x:0,keys:[{t:0,x:0},{t:5,x:50}],children:[{type:'text',text:'MILK',color:'#222'}]}]},
  ]};
  const plan = {tracks:[{id:'receipt',id_pattern:'^paper_',states:{fresh:{source_shot:0},used:{inherits:'fresh',text_color:{MILK:'#888'}}},
    instances:[{shot:0,state:'fresh'},{shot:1,state:'used',reason:'milk disappeared'}],
    motion_runs:[{shots:[0,1],axis:'x',from:0,to:100}]}]};
  assert.equal(reconcileProps(project,plan).valid,false);
  assert.ok(reconcileProps(project,plan,true).repaired >= 2);
  assert.equal(reconcileProps(project,plan).valid,true);
  assert.equal(project.shots[1].layers[0].children[0].color,'#888');
  assert.equal(project.shots[0].layers[0].keys.at(-1).x,project.shots[1].layers[0].keys[0].x);
});
