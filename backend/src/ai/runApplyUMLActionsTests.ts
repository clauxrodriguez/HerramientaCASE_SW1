import assert from 'assert';
import applyActionsToDiagram from './applyUMLActions';

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function testCreateRelationByName() {
  const diagram = {
    classes: [ { id: 'c1', name: 'Usuario' }, { id: 'c2', name: 'Pedido' } ],
    relations: []
  };
  const actions = [ { type: 'CREATE_RELATION', payload: { type: 'ONE_TO_MANY', source: 'Usuario', target: 'Pedido' } } ];
  const res = applyActionsToDiagram(deepClone(diagram), actions);
  assert.strictEqual(res.relations.length, 1, 'Should have created one relation');
  assert.strictEqual(res.relations[0].source, 'c1');
  assert.strictEqual(res.relations[0].target, 'c2');
}

function testSkipCreateWhenMissing() {
  const diagram = { classes: [ { id: 'c1', name: 'Usuario' } ], relations: [] };
  const actions = [ { type: 'CREATE_RELATION', payload: { type: 'ONE_TO_MANY', source: 'Usuario', target: 'NoExiste' } } ];
  const res = applyActionsToDiagram(deepClone(diagram), actions);
  assert.strictEqual(res.relations.length, 0, 'Should not create relation when target missing');
  assert.ok(Array.isArray(res._aiWarnings) && res._aiWarnings.length > 0, 'Should include warnings');
}

function testDeleteRelationByNames() {
  const diagram = {
    classes: [ { id: 'c1', name: 'Usuario' }, { id: 'c2', name: 'Pedido' } ],
    relations: [ { id: 'r1', type: 'ONE_TO_MANY', source: 'c1', target: 'c2' } ]
  };
  const actions = [ { type: 'DELETE_RELATION', target: { sourceClassName: 'Usuario', targetClassName: 'Pedido', type: 'ONE_TO_MANY' } } ];
  const res = applyActionsToDiagram(deepClone(diagram), actions);
  assert.strictEqual(res.relations.length, 0, 'Relation should be deleted');
}

function testUpdateRelationByNames() {
  const diagram = {
    classes: [ { id: 'c1', name: 'Usuario' }, { id: 'c2', name: 'Pedido' } ],
    relations: [ { id: 'r1', type: 'ONE_TO_MANY', source: 'c1', target: 'c2', label: 'old' } ]
  };
  const actions = [ { type: 'UPDATE_RELATION', target: { source: 'Usuario', target: 'Pedido', type: 'ONE_TO_MANY' }, payload: { label: 'nuevo' } } ];
  const res = applyActionsToDiagram(deepClone(diagram), actions);
  assert.strictEqual(res.relations.length, 1);
  assert.strictEqual(res.relations[0].label, 'nuevo');
}

async function run() {
  try {
    testCreateRelationByName();
    testSkipCreateWhenMissing();
    testDeleteRelationByNames();
    testUpdateRelationByNames();
    console.log('All applyUMLActions quick tests passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(2);
  }
}

run();
