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

test('B3 holds a vanished prop state and removes unwanted duplicate objects', () => {
  const project = {shots:[
    {layers:[{type:'rect',id:'milk_0',alpha:0,keys:[{t:0,alpha:0},{t:5,alpha:.5}]}]},
    {layers:[{type:'rect',id:'milk_1',alpha:.5,keys:[{t:0,alpha:.5},{t:5,alpha:1}]},
      {type:'ellipse',fill:'#777'},{type:'ellipse',fill:'#777'}]},
  ]};
  const plan = {tracks:[{id:'milk',id_pattern:'^milk_',states:{},instances:[],motion_runs:[
    {shots:[0],axis:'alpha',from:0,to:1,hold_after:1},
    {shots:[1],axis:'alpha',from:1,to:1},
  ]}],absent_layers:[{shot:1,match:{type:'ellipse',fill:'#777'}}],
    layer_properties:[{shot:1,id_pattern:'^milk_',properties:{fill:'#191919'}}]};
  assert.equal(reconcileProps(project,plan).valid,false);
  reconcileProps(project,plan,true);
  assert.equal(reconcileProps(project,plan).valid,true);
  assert.deepEqual(project.shots[0].layers[0].keys.map(key => [key.t,key.alpha]),[[0,0],[1,1],[5,1]]);
  assert.equal(project.shots[1].layers.length,1);
  assert.equal(project.shots[1].layers[0].fill,'#191919');
});
