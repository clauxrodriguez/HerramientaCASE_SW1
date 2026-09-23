export type Visibility = '+' | '-' | '#';

export interface Attribute {
  id: string;
  name: string;
  type: string;
  visibility: Visibility;
  isPrimaryKey?: boolean;
}

export interface Method {
  id: string;
  name: string;
  returnType: string;
  visibility: Visibility;
  parameters?: string;
}

export interface UMLClass {
  id: string;
  name: string;
  x: number;
  y: number;
  attributes: Attribute[];
  methods: Method[];
  isAbstract?: boolean;
}

export type RelationType = 
  | 'association' 
  | 'inheritance' 
  | 'aggregation' 
  | 'composition' 
  | 'dependency'
  | 'ONE_TO_ONE'
  | 'ONE_TO_MANY'
  | 'MANY_TO_ONE'
  | 'MANY_TO_MANY';

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  sourceCardinality?: string;
  targetCardinality?: string;
}

export interface DiagramData {
  id: string;
  name: string;
  package: string;
  classes: UMLClass[];
  relations: Relation[];
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  package: string;
  description: string;
  updatedAt: string;
  diagram: DiagramData;
  collaborators: { user: User; role: 'owner' | 'editor' | 'viewer' }[];
}

export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  cursor: { x: number; y: number } | null;
  activeClassId?: string;
}

export type ActiveTool = 'select' | 'addClass' | 'addRelation';

export const COMMON_DATA_TYPES = [
  'Long',
  'Integer',
  'String',
  'Boolean',
  'Double',
  'Float',
  'Date',
  'Timestamp',
  'BigDecimal',
  'UUID',
  'Byte[]'
] as const;
