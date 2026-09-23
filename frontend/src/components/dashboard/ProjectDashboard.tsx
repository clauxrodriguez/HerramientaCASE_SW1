import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Users, 
  Copy, 
  Trash2, 
  FolderPlus, 
  UserPlus, 
  User, 
  Box, 
  ArrowRight
} from 'lucide-react';
import { Project } from '../../types/uml';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUMLStore } from '../../stores/useUMLStore';

export const ProjectDashboard: React.FC<{ onOpenProject: (projectId: string) => void }> = ({
  onOpenProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPkg, setNewProjectPkg] = useState('com.ejemplo.diagrama');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');

  const { user, openProfileModal } = useAuthStore();
  const setProjectInfo = useUMLStore((s) => s.setProjectInfo);

  const [projects, setProjects] = useState<Project[]>([
    {
      id: 'demo-project-1',
      name: 'Sistema de Comercio Electrónico',
      package: 'com.ecommerce.app',
      description: 'Modelo de clases principal para la tienda online con usuarios, pedidos y pagos.',
      updatedAt: 'Hace 20 min',
      diagram: {
        id: 'diag-1',
        name: 'E-Commerce Core',
        package: 'com.ecommerce.app',
        classes: [],
        relations: [],
      },
      collaborators: [
        { user: { id: 'u1', username: 'Ana María', email: 'ana@empresa.com' }, role: 'owner' },
        { user: { id: 'u2', username: 'Carlos R.', email: 'carlos@empresa.com' }, role: 'editor' },
      ],
    },
    {
      id: 'demo-project-2',
      name: 'Gestión Hospitalaria & Citas',
      package: 'org.hospital.core',
      description: 'Plataforma para reservas de citas médicas e historias clínicas.',
      updatedAt: 'Ayer',
      diagram: {
        id: 'diag-2',
        name: 'Hospital Core',
        package: 'org.hospital.core',
        classes: [],
        relations: [],
      },
      collaborators: [
        { user: { id: 'u1', username: 'Ana María', email: 'ana@empresa.com' }, role: 'owner' },
      ],
    },
  ]);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.package.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      package: newProjectPkg.trim() || 'com.example.uml',
      description: newProjectDesc.trim() || 'Diagrama UML sin descripción.',
      updatedAt: 'Justo ahora',
      diagram: {
        id: `diag-${Date.now()}`,
        name: newProjectName.trim(),
        package: newProjectPkg.trim() || 'com.example.uml',
        classes: [],
        relations: [],
      },
      collaborators: [{ user: user!, role: 'owner' }],
    };

    setProjects([newProj, ...projects]);
    setIsNewModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    
    setProjectInfo(newProj.id, newProj.name, newProj.package);
    onOpenProject(newProj.id);
  };

  const handleCloneProject = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const cloned: Project = {
      ...proj,
      id: `proj-${Date.now()}`,
      name: `${proj.name} (Copia)`,
      updatedAt: 'Justo ahora',
    };
    setProjects([cloned, ...projects]);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
      setProjects(projects.filter((p) => p.id !== id));
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    alert(`Invitación enviada a ${inviteEmail} con rol de ${inviteRole}`);
    setInviteEmail('');
    setIsInviteModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-surface-bg p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Superior del Dashboard */}
        <header className="flex items-center justify-between bg-white p-6 rounded-2xl border border-surface-border shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-600 rounded-xl text-white shadow-sm">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Proyectos CASE UML</h1>
              <p className="text-xs text-surface-subtext">Plataforma de modelado colaborativo de arquitectura software.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openProfileModal}
              className="px-3.5 py-2 border border-surface-border rounded-xl text-xs font-medium text-slate-700 hover:bg-surface-panel flex items-center gap-2 transition"
            >
              <User className="w-4 h-4 text-brand-600" />
              <span>{user?.username || 'Mi Perfil'}</span>
            </button>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Nuevo Proyecto
            </button>
          </div>
        </header>

        {/* Barra de Filtro y Búsqueda */}
        <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-surface-border shadow-subtle">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-surface-subtext absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar proyecto por nombre, paquete o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-surface-border rounded-lg text-xs focus:ring-2 focus:ring-brand-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Grilla de Tarjetas de Proyecto */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => {
                setProjectInfo(proj.id, proj.name, proj.package);
                onOpenProject(proj.id);
              }}
              className="bg-white border border-surface-border rounded-xl p-5 hover:shadow-floating hover:border-brand-300 transition cursor-pointer flex flex-col justify-between group space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="p-2 bg-brand-50 text-brand-600 rounded-lg group-hover:bg-brand-600 group-hover:text-white transition">
                    <FolderPlus className="w-5 h-5" />
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsInviteModalOpen(true);
                      }}
                      className="p-1.5 text-surface-subtext hover:bg-surface-panel hover:text-brand-600 rounded-md transition"
                      title="Invitar Colaborador"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleCloneProject(proj, e)}
                      className="p-1.5 text-surface-subtext hover:bg-surface-panel hover:text-brand-600 rounded-md transition"
                      title="Clonar Diagrama"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      className="p-1.5 text-surface-subtext hover:bg-red-50 hover:text-red-600 rounded-md transition"
                      title="Eliminar Proyecto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-600 transition">
                    {proj.name}
                  </h3>
                  <span className="text-[11px] font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md inline-block mt-1">
                    {proj.package}
                  </span>
                </div>

                <p className="text-xs text-surface-subtext line-clamp-2 leading-relaxed">
                  {proj.description}
                </p>
              </div>

              <div className="pt-4 border-t border-surface-border flex items-center justify-between text-xs text-surface-subtext">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-lavender-500" />
                  <span>{proj.collaborators.length} Colaborador(es)</span>
                </div>
                <span className="flex items-center gap-1 font-medium group-hover:text-brand-600">
                  {proj.updatedAt} <ArrowRight className="w-3 h-3 transition transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Nuevo Proyecto */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-floating space-y-4 animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-slate-900">Crear Nuevo Proyecto UML</h3>

            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nombre del Proyecto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sistema de Pedidos"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Paquete Java (Package)</label>
                <input
                  type="text"
                  required
                  placeholder="com.miempresa.modulo"
                  value={newProjectPkg}
                  onChange={(e) => setNewProjectPkg(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Descripción</label>
                <textarea
                  placeholder="Descripción del modelo..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-surface-border rounded-lg text-slate-700 font-medium hover:bg-surface-panel transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  Crear e Iniciar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Invitar Colaboradores */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-floating space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" /> Invitar Colaborador por Email
            </h3>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="colaborador@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Rol</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
                >
                  <option value="editor">Editor (Puede modificar clases y relaciones)</option>
                  <option value="viewer">Lector (Solo vista)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 border border-surface-border rounded-lg text-slate-700 font-medium hover:bg-surface-panel transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  Enviar Invitación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
