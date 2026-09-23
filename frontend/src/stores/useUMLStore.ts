import { create } from 'zustand';
import { UMLClass, Relation, UserPresence, ActiveTool, Attribute, Method } from '../types/uml';

export interface PendingSyncAction {
  id: string;
  type: 'CREATE_CLASS' | 'UPDATE_CLASS' | 'DELETE_CLASS' | 'ADD_RELATION' | 'DELETE_RELATION';
  payload: any;
  timestamp: number;
}

interface UMLStoreState {
  projectId: string;
  projectName: string;
  packageName: string;
  classes: UMLClass[];
  relations: Relation[];
  selectedClassId: string | null;
  selectedRelationId: string | null;
  activeTool: ActiveTool;
  isOnline: boolean;
  syncQueue: PendingSyncAction[];
  presence: Record<string, UserPresence>;
  relationCreationSource: string | null;

  // Actions - Project & Canvas
  setProjectInfo: (id: string, name: string, packageName: string) => void;
  setClasses: (classes: UMLClass[]) => void;
  setRelations: (relations: Relation[]) => void;
  setActiveTool: (tool: ActiveTool) => void;
  selectClass: (id: string | null) => void;
  selectRelation: (id: string | null) => void;
  setRelationCreationSource: (classId: string | null) => void;

  // Actions - UML Class CRUD
  addClass: (newClass: UMLClass) => void;
  updateClass: (id: string, updated: Partial<UMLClass>) => void;
  removeClass: (id: string) => void;
  
  // Actions - Attributes & Methods
  addAttribute: (classId: string, attr: Omit<Attribute, 'id'>) => void;
  updateAttribute: (classId: string, attrId: string, attr: Partial<Attribute>) => void;
  removeAttribute: (classId: string, attrId: string) => void;

  addMethod: (classId: string, method: Omit<Method, 'id'>) => void;
  updateMethod: (classId: string, methodId: string, method: Partial<Method>) => void;
  removeMethod: (classId: string, methodId: string) => void;

  // Actions - Relations CRUD
  addRelation: (relation: Relation) => void;
  updateRelation: (id: string, updated: Partial<Relation>) => void;
  removeRelation: (id: string) => void;

  // Network & Sync Queue
  setOnlineStatus: (status: boolean) => void;
  addToSyncQueue: (action: Omit<PendingSyncAction, 'id' | 'timestamp'>) => void;
  clearSyncQueue: () => void;

  // Presence
  updatePresence: (presence: UserPresence) => void;
  removePresence: (userId: string) => void;
}

export const useUMLStore = create<UMLStoreState>((set, get) => ({
  projectId: 'demo-project-1',
  projectName: 'Sistema CASE UML',
  packageName: 'com.example.uml',
  classes: [
    {
      id: 'cls-1',
      name: 'Usuario',
      x: 120,
      y: 120,
      attributes: [
        { id: 'a1', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
        { id: 'a2', name: 'nombre', type: 'String', visibility: '+' },
        { id: 'a3', name: 'email', type: 'String', visibility: '#' }
      ],
      methods: [
        { id: 'm1', name: 'autenticar', returnType: 'Boolean', visibility: '+' },
        { id: 'm2', name: 'obtenerPerfil', returnType: 'UserDto', visibility: '+' }
      ]
    },
    {
      id: 'cls-2',
      name: 'Pedido',
      x: 480,
      y: 120,
      attributes: [
        { id: 'a4', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
        { id: 'a5', name: 'montoTotal', type: 'Double', visibility: '+' },
        { id: 'a6', name: 'fecha', type: 'Date', visibility: '#' }
      ],
      methods: [
        { id: 'm3', name: 'procesarPago', returnType: 'Boolean', visibility: '+' }
      ]
    }
  ],
  relations: [
    {
      id: 'rel-1',
      sourceId: 'cls-1',
      targetId: 'cls-2',
      type: 'ONE_TO_MANY',
      sourceCardinality: '1',
      targetCardinality: '*'
    }
  ],
  selectedClassId: null,
  selectedRelationId: null,
  activeTool: 'select',
  isOnline: navigator.onLine,
  syncQueue: JSON.parse(localStorage.getItem('uml_sync_queue') || '[]'),
  presence: {},
  relationCreationSource: null,

  setProjectInfo: (id, name, packageName) => set({ projectId: id, projectName: name, packageName }),
  setClasses: (classes) => set({ classes }),
  setRelations: (relations) => set({ relations }),
  setActiveTool: (activeTool) => set({ activeTool, relationCreationSource: null }),
  selectClass: (id) => set({ selectedClassId: id, selectedRelationId: id ? null : get().selectedRelationId }),
  selectRelation: (id) => set({ selectedRelationId: id, selectedClassId: id ? null : get().selectedClassId }),
  setRelationCreationSource: (classId) => set({ relationCreationSource: classId }),

  addClass: (newClass) => {
    set((state) => ({ classes: [...state.classes, newClass] }));
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'CREATE_CLASS', payload: newClass });
    }
  },

  updateClass: (id, updated) => {
    set((state) => ({
      classes: state.classes.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }));
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: { id, ...updated } });
    }
  },

  removeClass: (id) => {
    set((state) => ({
      classes: state.classes.filter((c) => c.id !== id),
      relations: state.relations.filter((r) => r.sourceId !== id && r.targetId !== id),
      selectedClassId: state.selectedClassId === id ? null : state.selectedClassId,
    }));
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'DELETE_CLASS', payload: { id } });
    }
  },

  addAttribute: (classId, attr) => {
    const newAttr: Attribute = { ...attr, id: crypto.randomUUID() };
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, attributes: [...c.attributes, newAttr] } : c
      ),
    }));
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  updateAttribute: (classId, attrId, attr) => {
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? {
              ...c,
              attributes: c.attributes.map((a) => (a.id === attrId ? { ...a, ...attr } : a)),
            }
          : c
      ),
    }));
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  removeAttribute: (classId, attrId) => {
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? { ...c, attributes: c.attributes.filter((a) => a.id !== attrId) }
          : c
      ),
    }));
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  addMethod: (classId, method) => {
    const newMethod: Method = { ...method, id: crypto.randomUUID() };
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, methods: [...c.methods, newMethod] } : c
      ),
    }));
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  updateMethod: (classId, methodId, method) => {
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? {
              ...c,
              methods: c.methods.map((m) => (m.id === methodId ? { ...m, ...method } : m)),
            }
          : c
      ),
    }));
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  removeMethod: (classId, methodId) => {
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? { ...c, methods: c.methods.filter((m) => m.id !== methodId) }
          : c
      ),
    }));
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  addRelation: (relation) => {
    set((state) => ({ relations: [...state.relations, relation] }));
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'ADD_RELATION', payload: relation });
    }
  },

  updateRelation: (id, updated) => {
    set((state) => ({
      relations: state.relations.map((r) => (r.id === id ? { ...r, ...updated } : r)),
    }));
  },

  removeRelation: (id) => {
    set((state) => ({
      relations: state.relations.filter((r) => r.id !== id),
      selectedRelationId: state.selectedRelationId === id ? null : state.selectedRelationId,
    }));
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'DELETE_RELATION', payload: { id } });
    }
  },

  setOnlineStatus: (isOnline) => set({ isOnline }),

  addToSyncQueue: (action) => {
    const queueItem: PendingSyncAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    const updatedQueue = [...get().syncQueue, queueItem];
    set({ syncQueue: updatedQueue });
    localStorage.setItem('uml_sync_queue', JSON.stringify(updatedQueue));
  },

  clearSyncQueue: () => {
    set({ syncQueue: [] });
    localStorage.removeItem('uml_sync_queue');
  },

  updatePresence: (userPresence) =>
    set((state) => ({
      presence: { ...state.presence, [userPresence.userId]: userPresence },
    })),

  removePresence: (userId) =>
    set((state) => {
      const next = { ...state.presence };
      delete next[userId];
      return { presence: next };
    }),
}));
