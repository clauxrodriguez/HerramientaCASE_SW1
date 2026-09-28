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

describe('applyActionsToDiagram - generic class members', () => {
  test('adds, updates and deletes arbitrary attributes and methods case-insensitively', () => {
    const diagram = {
      classes: [{
        id: 'c1',
        name: 'FacturaEspecial',
        attributes: [{ id: 'a1', name: 'codigoExterno', type: 'String' }],
        methods: [{ id: 'm1', name: 'calcularImpuesto', returnType: 'BigDecimal' }]
      }],
      relations: []
    };

    const result = applyActionsToDiagram(diagram, [
      { type: 'ADD_ATTRIBUTE', target: { className: 'facturaespecial' }, payload: { name: 'fechaEmision' } },
      { type: 'UPDATE_ATTRIBUTE', target: { className: 'FACTURAESPECIAL', attributeName: 'codigoexterno' }, payload: { name: 'numeroFactura', type: 'Long' } },
      { type: 'ADD_METHOD', target: { className: 'FacturaEspecial' }, payload: { name: 'emitir', returnType: 'Boolean' } },
      { type: 'UPDATE_METHOD', target: { className: 'FacturaEspecial', methodName: 'CALCULARIMPUESTO' }, payload: { name: 'calcularTotal' } },
      { type: 'DELETE_METHOD', target: { className: 'facturaespecial', methodName: 'emitir' } },
      { type: 'DELETE_ATTRIBUTE', target: { className: 'FacturaEspecial', attributeName: 'FECHAEMISION' } }
    ]);

    expect(result.classes[0].attributes).toEqual([{ id: 'a1', name: 'numeroFactura', type: 'Long' }]);
    expect(result.classes[0].methods).toEqual([{ id: 'm1', name: 'calcularTotal', returnType: 'BigDecimal' }]);
  });

  test('updates, renames and deletes classes while preserving relation references', () => {
    const diagram = {
      classes: [{ id: 'c1', name: 'Persona' }, { id: 'c2', name: 'Perfil' }],
      relations: [{ id: 'r1', source: 'c1', target: 'c2', type: 'ONE_TO_ONE' }]
    };

    const renamed = applyActionsToDiagram(diagram, [
      { type: 'UPDATE_CLASS', target: { className: 'persona' }, payload: { isAbstract: true } },
      { type: 'RENAME_CLASS', target: { className: 'PERSONA', newClassName: 'UsuarioBase' } }
    ]);

    expect(renamed.classes[0]).toMatchObject({ name: 'UsuarioBase', isAbstract: true });
    expect(renamed.relations[0].source).toBe('c1');

    const deleted = applyActionsToDiagram(renamed, [{ type: 'DELETE_CLASS', target: { className: 'usuariobase' } }]);
    expect(deleted.classes).toHaveLength(1);
    expect(deleted.relations).toHaveLength(0);
  });
});
