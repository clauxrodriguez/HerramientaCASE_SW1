export interface UMLAttribute {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;
  isId?: boolean;
}

export interface UMLMethod {
  name: string;
  returnType: string;
  parameters: Array<{
    name: string;
    type: string;
  }>;
}

export interface UMLRelation {
  type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY' | 'INHERITANCE' | 'COMPOSITION' | 'AGGREGATION';
  source?: string; // Nombre de la clase origen
  target: string; // Nombre de la clase destino
  sourceCardinality?: string; // Cardinalidad en el origen
  targetCardinality?: string; // Cardinalidad en el destino
  mappedBy?: string;
  joinColumn?: string;
  label?: string;
}

export interface UMLClass {
  name: string;
  attributes: UMLAttribute[];
  methods: UMLMethod[];
  relations: UMLRelation[];
}

export interface UMLDiagramJSON {
  package: string;
  classes: UMLClass[];
  relations?: UMLRelation[]; // Relaciones como array separado (opcional para compatibilidad)
}

