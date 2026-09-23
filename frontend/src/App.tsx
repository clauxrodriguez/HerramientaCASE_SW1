import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  User 
} from 'lucide-react';
import { ProjectDashboard } from './components/dashboard/ProjectDashboard';
import { LeftToolbar } from './components/canvas/LeftToolbar';
import { UMLCanvas } from './components/canvas/UMLCanvas';
import { ClassEditorPanel } from './components/editor/ClassEditorPanel';
import { RelationEditorPanel } from './components/editor/RelationEditorPanel';
import { AIAssistantDrawer } from './components/ai/AIAssistantDrawer';
import { SQLModal } from './components/canvas/SQLModal';
import { AuthModal } from './components/auth/AuthModal';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useUMLStore } from './stores/useUMLStore';
import { useAuthStore } from './stores/useAuthStore';
import { initSocket, disconnectSocket } from './services/socket';

export const App: React.FC = () => {
  useNetworkStatus();

  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace'>('dashboard');
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [sqlModalContent, setSqlModalContent] = useState<string | null>(null);

  const { projectId, projectName, packageName, presence, selectedRelationId } = useUMLStore();
  const { token, openProfileModal } = useAuthStore();

  useEffect(() => {
    if (currentView === 'workspace' && projectId && token) {
      initSocket(projectId, token);
    }
    return () => {
      if (projectId) disconnectSocket(projectId);
    };
  }, [currentView, projectId, token]);

  const handleOpenProject = () => {
    setCurrentView('workspace');
  };

  const handleOpenSQLModal = (sql: string) => {
    setSqlModalContent(sql);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-surface-bg font-sans">
      {currentView === 'dashboard' ? (
        <ProjectDashboard onOpenProject={handleOpenProject} />
      ) : (
        <div className="h-full w-full flex flex-col overflow-hidden">
          {/* Header Superior del Workspace */}
          <header className="h-14 border-b border-surface-border bg-white px-4 flex items-center justify-between shadow-subtle z-30">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="p-1.5 text-surface-subtext hover:text-slate-900 hover:bg-surface-panel rounded-lg transition flex items-center gap-1.5 text-xs font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Proyectos
              </button>

              <div className="h-4 w-px bg-surface-border" />

              <div>
                <h2 className="font-bold text-slate-900 text-sm">{projectName}</h2>
                <p className="text-[10px] font-mono text-brand-600">{packageName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Avatares de Presencia Colaborativa */}
              <div className="flex items-center -space-x-2 overflow-hidden px-2">
                {Object.values(presence).map((p) => (
                  <div
                    key={p.userId}
                    className="inline-block h-7 w-7 rounded-full ring-2 ring-white text-[11px] font-bold text-white flex items-center justify-center uppercase shadow-sm"
                    style={{ backgroundColor: p.color || '#0284C7' }}
                    title={`Colaborador en línea: ${p.userName}`}
                  >
                    {p.userName.slice(0, 2)}
                  </div>
                ))}
              </div>

              {/* Botón Asistente IA Gemini */}
              <button
                onClick={() => setIsAIDrawerOpen(!isAIDrawerOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-subtle ${
                  isAIDrawerOpen
                    ? 'bg-lavender-500 text-white shadow-md'
                    : 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100 border border-lavender-200'
                }`}
              >
                <Sparkles className="w-4 h-4" /> Asistente IA Gemini
              </button>

              {/* Perfil de Usuario */}
              <button
                onClick={openProfileModal}
                className="p-1.5 text-slate-700 hover:bg-surface-panel rounded-lg transition"
                title="Ajustes de Perfil"
              >
                <User className="w-5 h-5 text-brand-600" />
              </button>
            </div>
          </header>

          {/* Área Principal de Diagramación */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Barra de Herramientas Principal en Lateral Izquierdo */}
            <LeftToolbar onOpenSQLModal={handleOpenSQLModal} />

            {/* Lienzo Konva Central */}
            <UMLCanvas />

            {/* Panel Editor Derecha (Clase o Relación) */}
            {selectedRelationId ? <RelationEditorPanel /> : <ClassEditorPanel />}

            {/* Asistente IA Gemini Drawer (Flotante Derecha) */}
            <AIAssistantDrawer
              isOpen={isAIDrawerOpen}
              onClose={() => setIsAIDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Modales Globales */}
      <AuthModal />
      <SQLModal
        sql={sqlModalContent || ''}
        isOpen={!!sqlModalContent}
        onClose={() => setSqlModalContent(null)}
      />
    </div>
  );
};
