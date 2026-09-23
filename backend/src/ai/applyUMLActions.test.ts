import applyActionsToDiagram from './applyUMLActions';

describe('applyActionsToDiagram - relations', () => {
  test('creates relation resolving classes by name to ids', () => {
    const diagram = {
      classes: [
        { id: 'c1', name: 'Usuario' },
        { id: 'c2', name: 'Pedido' }
      ],
      relations: []
    };

    const actions = [
      {
        type: 'CREATE_RELATION',
        payload: {
          type: 'ONE_TO_MANY',
          source: 'Usuario',
          target: 'Pedido',
          label: 'realiza'
        }
      }
    ];

    const result = applyActionsToDiagram(diagram, actions);
    expect(result.relations).toHaveLength(1);
    const rel = result.relations[0];
    expect(rel.source).toBe('c1');
    expect(rel.target).toBe('c2');
    expect(rel.type).toBe('ONE_TO_MANY');
    expect(typeof rel.id).toBe('string');
  });

  test('skips create relation when classes missing and adds warning', () => {
    const diagram = {
      classes: [ { id: 'c1', name: 'Usuario' } ],
      relations: []
    };

    const actions = [
      { type: 'CREATE_RELATION', payload: { type: 'ONE_TO_MANY', source: 'Usuario', target: 'NoExiste' } }
    ];

    const result = applyActionsToDiagram(diagram, actions);
    expect(result.relations).toHaveLength(0);
    expect(Array.isArray(result._aiWarnings)).toBe(true);
    expect(result._aiWarnings.some((w: string) => w.includes('CREATE_RELATION skipped'))).toBe(true);
  });

  test('deletes relation by resolving source/target names', () => {
    const diagram = {
      classes: [ { id: 'c1', name: 'Usuario' }, { id: 'c2', name: 'Pedido' } ],
      relations: [ { id: 'r1', type: 'ONE_TO_MANY', source: 'c1', target: 'c2' } ]
    };

    const actions = [ { type: 'DELETE_RELATION', target: { sourceClassName: 'Usuario', targetClassName: 'Pedido', type: 'ONE_TO_MANY' } } ];

    const result = applyActionsToDiagram(diagram, actions);
    expect(result.relations).toHaveLength(0);
  });

  test('updates relation when searching by source/target names', () => {
    const diagram = {
      classes: [ { id: 'c1', name: 'Usuario' }, { id: 'c2', name: 'Pedido' } ],
      relations: [ { id: 'r1', type: 'ONE_TO_MANY', source: 'c1', target: 'c2', label: 'old' } ]
    };

    const actions = [ { type: 'UPDATE_RELATION', target: { source: 'Usuario', target: 'Pedido', type: 'ONE_TO_MANY' }, payload: { label: 'nuevo' } } ];

    const result = applyActionsToDiagram(diagram, actions);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].label).toBe('nuevo');
  });
});
