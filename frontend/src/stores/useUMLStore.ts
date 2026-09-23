import { create } from 'zustand';
import { UMLClass, Relation, UserPresence, ActiveTool, Attribute, Method } from '../types/uml';
import { emitDiagramUpdate } from '../services/socket';

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
  loadProjectState: (id: string, name?: string, pkg?: string, initialClasses?: UMLClass[], initialRelations?: Relation[]) => void;
  saveProjectState: () => void;
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

  // Remote Sync & Presence Batching
  setClassesFromRemote: (classes: UMLClass[]) => void;
  setRelationsFromRemote: (relations: Relation[]) => void;
  setDiagramDataFromRemote: (data: { classes?: UMLClass[]; relations?: Relation[] }) => void;
  setPresenceMap: (presence: Record<string, UserPresence>) => void;
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
  
  loadProjectState: (id, name, pkg, initialClasses, initialRelations) => {
    const savedDiagramRaw = localStorage.getItem(`uml_diagram_${id}`);
    if (savedDiagramRaw) {
      try {
        const savedDiagram = JSON.parse(savedDiagramRaw);
        set({
          projectId: id,
          projectName: savedDiagram.name || name || 'Sistema CASE UML',
          packageName: savedDiagram.package || pkg || 'com.example.uml',
          classes: savedDiagram.classes || [],
          relations: savedDiagram.relations || [],
          selectedClassId: null,
          selectedRelationId: null,
        });
        return;
      } catch (err) {
        console.error('Error al cargar diagrama guardado:', err);
      }
    }

    set({
      projectId: id,
      projectName: name || 'Sistema CASE UML',
      packageName: pkg || 'com.example.uml',
      classes: initialClasses || [],
      relations: initialRelations || [],
      selectedClassId: null,
      selectedRelationId: null,
    });
  },

  saveProjectState: () => {
    const { projectId, projectName, packageName, classes, relations } = get();
    if (!projectId) return;

    const diagramData = {
      id: `diag-${projectId}`,
      name: projectName,
      package: packageName,
      classes,
      relations,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    localStorage.setItem(`uml_diagram_${projectId}`, JSON.stringify(diagramData));

    const storedProjectsRaw = localStorage.getItem('uml_projects_list');
    let projectsList: any[] = storedProjectsRaw ? JSON.parse(storedProjectsRaw) : [];

    const nowStr = 'Justo ahora';
    const existingIndex = projectsList.findIndex((p) => p.id === projectId);
    if (existingIndex !== -1) {
      projectsList[existingIndex] = {
        ...projectsList[existingIndex],
        name: projectName,
        package: packageName,
        updatedAt: nowStr,
        diagram: diagramData,
      };
    } else {
      projectsList.unshift({
        id: projectId,
        name: projectName,
        package: packageName,
        description: 'Diagrama UML activo',
        updatedAt: nowStr,
        diagram: diagramData,
        collaborators: [{ user: { id: 'u1', username: 'Usuario', email: 'user@local' }, role: 'owner' }],
      });
    }

    localStorage.setItem('uml_projects_list', JSON.stringify(projectsList));
    const pId = get().projectId;
    if (pId) emitDiagramUpdate(pId, { classes, relations });
  },
  setClasses: (classes) => {
    set({ classes });
    const pId = get().projectId;
    if (pId) emitDiagramUpdate(pId, { classes, relations: get().relations });
  },
  setRelations: (relations) => {
    set({ relations });
    const pId = get().projectId;
    if (pId) emitDiagramUpdate(pId, { classes: get().classes, relations });
  },
  setActiveTool: (activeTool) => set({ activeTool, relationCreationSource: null }),
  selectClass: (id) => set({ selectedClassId: id, selectedRelationId: id ? null : get().selectedRelationId }),
  selectRelation: (id) => set({ selectedRelationId: id, selectedClassId: id ? null : get().selectedClassId }),
  setRelationCreationSource: (classId) => set({ relationCreationSource: classId }),

  addClass: (newClass) => {
    set((state) => ({ classes: [...state.classes, newClass] }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'CREATE_CLASS', payload: newClass });
    }
  },

  updateClass: (id, updated) => {
    set((state) => ({
      classes: state.classes.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
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
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'DELETE_CLASS', payload: { id } });
    }
  },

  addAttribute: (classId, attr) => {
    const newAttr: Attribute = { ...attr, id: (attr as any).id || crypto.randomUUID() };
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, attributes: [...c.attributes, newAttr] } : c
      ),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
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
              attributes: c.attributes.map((a, idx) =>
                a.id === attrId || (!a.id && `attr-${idx}` === attrId)
                  ? { ...a, ...attr }
                  : a
              ),
            }
          : c
      ),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  removeAttribute: (classId, attrId) => {
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? {
              ...c,
              attributes: c.attributes.filter(
                (a, idx) => a.id !== attrId && `attr-${idx}` !== attrId
              ),
            }
          : c
      ),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  addMethod: (classId, method) => {
    const newMethod: Method = { ...method, id: (method as any).id || crypto.randomUUID() };
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId ? { ...c, methods: [...c.methods, newMethod] } : c
      ),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
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
              methods: c.methods.map((m, idx) =>
                m.id === methodId || (!m.id && `meth-${idx}` === methodId)
                  ? { ...m, ...method }
                  : m
              ),
            }
          : c
      ),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  removeMethod: (classId, methodId) => {
    set((state) => ({
      classes: state.classes.map((c) =>
        c.id === classId
          ? {
              ...c,
              methods: c.methods.filter(
                (m, idx) => m.id !== methodId && `meth-${idx}` !== methodId
              ),
            }
          : c
      ),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    const targetClass = get().classes.find((c) => c.id === classId);
    if (targetClass && !get().isOnline) {
      get().addToSyncQueue({ type: 'UPDATE_CLASS', payload: targetClass });
    }
  },

  addRelation: (relation) => {
    set((state) => ({ relations: [...state.relations, relation] }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
    if (!get().isOnline) {
      get().addToSyncQueue({ type: 'ADD_RELATION', payload: relation });
    }
  },

  updateRelation: (id, updated) => {
    set((state) => ({
      relations: state.relations.map((r) => (r.id === id ? { ...r, ...updated } : r)),
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
  },

  removeRelation: (id) => {
    set((state) => ({
      relations: state.relations.filter((r) => r.id !== id),
      selectedRelationId: state.selectedRelationId === id ? null : state.selectedRelationId,
    }));
    const { projectId, classes, relations } = get();
    if (projectId) emitDiagramUpdate(projectId, { classes, relations });
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

  setClassesFromRemote: (classes) => set({ classes }),
  setRelationsFromRemote: (relations) => set({ relations }),
  setDiagramDataFromRemote: (data) =>
    set((state) => ({
      classes: data.classes ?? state.classes,
      relations: data.relations ?? state.relations,
    })),
  setPresenceMap: (presence) => set({ presence }),
}));
