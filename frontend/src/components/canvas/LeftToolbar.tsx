import React, { useRef, useState } from 'react';
import { 
  MousePointer, 
  PlusSquare, 
  GitCommit, 
  Download, 
  Upload, 
  FileCode, 
  Database, 
  Save, 
  Check,
  Wifi, 
  WifiOff, 
  RefreshCw,
  Box,
  Layers
} from 'lucide-react';
import { useUMLStore } from '../../stores/useUMLStore';
import { codeGeneratorService, xmiService } from '../../services/api';

export const LeftToolbar: React.FC<{
  onOpenSQLModal: (sql: string) => void;
}> = ({ onOpenSQLModal }) => {
  const [isSaved, setIsSaved] = useState(false);

  const { 
    classes, 
    relations, 
    activeTool, 
    setActiveTool, 
    addClass, 
    setClasses,
    setRelations,
    isOnline, 
    syncQueue, 
    clearSyncQueue,
    projectName,
    packageName,
    saveProjectState
  } = useUMLStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveState = () => {
    saveProjectState();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddNewClass = () => {
    const newClassId = `cls-${Date.now()}`;
    const newClass = {
      id: newClassId,
      name: `NuevaClase${classes.length + 1}`,
      x: 200 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      attributes: [
        { id: `attr-${Date.now()}-1`, name: 'id', type: 'Long', visibility: '-' as const, isPrimaryKey: true }
      ],
      methods: [
        { id: `meth-${Date.now()}-1`, name: 'ejecutar', returnType: 'void', visibility: '+' as const }
      ]
    };
    addClass(newClass);
    setActiveTool('select');
  };

  const handleExportXMI = () => {
    const xmlContent = xmiService.exportXMI({
      id: 'diag-1',
      name: projectName,
      package: packageName,
      classes,
      relations
    });
    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const result = xmiService.importXMI(content);
        if (result && result.classes && result.classes.length > 0) {
          setClasses(result.classes);
          setRelations(result.relations);
          alert(`¡Archivo XML "${file.name}" cargado e importado con ${result.classes.length} clase(s) y ${result.relations.length} relación(es)!`);
        } else {
          alert('No se pudieron extraer clases del archivo XML seleccionado.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportPostgreSQL = () => {
    const sql = codeGeneratorService.exportPostgreSQL(classes, relations);
    onOpenSQLModal(sql);
  };

  // Referencias para evitar advertencias de variables no usadas mientras los botones están ocultos en la vista
  void [Database, Layers, handleExportPostgreSQL];

  return (
    <aside className="w-64 border-r border-surface-border bg-white flex flex-col justify-between h-full shadow-subtle z-20 select-none font-sans">
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header / Identidad */}
        <div className="p-4 border-b border-surface-border flex items-center gap-3 bg-surface-bg">
          <div className="p-2 bg-brand-600 rounded-lg text-white shadow-sm">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm tracking-tight">CASE UML Studio</h1>
            <p className="text-[11px] text-surface-subtext font-medium">Modelador Colaborativo</p>
          </div>
        </div>

        {/* Indicador de Estado de Red / Sincronización */}
        <div className="p-3 border-b border-surface-border bg-slate-50/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-subtext font-medium">Estado de Red:</span>
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                <Wifi className="w-3 h-3" /> En línea
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full text-[11px]">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </div>

          {syncQueue.length > 0 && (
            <button
              onClick={clearSyncQueue}
              className="mt-2 w-full py-1 px-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition"
              title="Click para vaciar/sincronizar acciones pendientes"
            >
              <RefreshCw className="w-3 h-3 animate-spin" /> {syncQueue.length} cambio(s) pendiente(s)
            </button>
          )}
        </div>

        <div className="p-3 space-y-5">
          {/* Herramientas de Dibujo */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
              Herramientas UML
            </span>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTool('select')}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                  activeTool === 'select'
                    ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                    : 'text-surface-subtext hover:bg-surface-panel hover:text-slate-900'
                }`}
              >
                <MousePointer className="w-4 h-4" /> Seleccionar / Mover
              </button>

              <button
                onClick={handleAddNewClass}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-surface-subtext hover:bg-brand-50 hover:text-brand-700 flex items-center gap-2.5 transition border border-transparent hover:border-brand-200"
              >
                <PlusSquare className="w-4 h-4 text-brand-600" /> Añadir Clase UML
              </button>

              <button
                onClick={() => setActiveTool('addRelation')}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                  activeTool === 'addRelation'
                    ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                    : 'text-surface-subtext hover:bg-surface-panel hover:text-slate-900'
                }`}
              >
                <GitCommit className="w-4 h-4 text-lavender-500" /> Conectar Relación
              </button>
            </div>
          </div>

          {/* Sección de Intercambio XML / XMI */}
          <div className="space-y-1.5 pt-2 border-t border-surface-border">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
              Intercambio XML
            </span>
            <div className="space-y-1">
              <button
                onClick={handleExportXMI}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-lavender-50 hover:text-lavender-700 border border-surface-border flex items-center gap-2.5 transition shadow-subtle"
              >
                <Upload className="w-4 h-4 text-lavender-600" /> Exportar XML
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-lavender-50 hover:text-lavender-700 border border-surface-border flex items-center gap-2.5 transition shadow-subtle"
              >
                <Download className="w-4 h-4 text-lavender-600" /> Importar XML
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.xmi"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Generadores de Código */}
          <div className="space-y-1.5 pt-2 border-t border-surface-border">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
              Generadores de Código
            </span>
            <div className="space-y-1">
              <button
                onClick={() => codeGeneratorService.exportSpringBoot(packageName, classes, relations)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-surface-border flex items-center gap-2.5 transition shadow-subtle"
              >
                <FileCode className="w-4 h-4 text-emerald-600" /> Spring Boot ZIP
              </button>

              {/* Botones de Flutter y DDL deshabilitados en la vista (implementación preservada) */}
              {/* 
              <button
                onClick={() => codeGeneratorService.exportFlutter(projectName, classes, relations)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-brand-50 hover:text-brand-700 border border-surface-border flex items-center gap-2.5 transition shadow-subtle"
              >
                <Layers className="w-4 h-4 text-brand-600" /> Flutter App ZIP
              </button>

              <button
                onClick={handleExportPostgreSQL}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-surface-border flex items-center gap-2.5 transition shadow-subtle"
              >
                <Database className="w-4 h-4 text-slate-600" /> DDL PostgreSQL
              </button>
              */}
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Botón Guardar */}
      <div className="p-3 border-t border-surface-border bg-surface-bg">
        <button
          onClick={handleSaveState}
          className={`w-full py-2 font-medium text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : 'bg-brand-600 hover:bg-brand-700 text-white'
          }`}
          title="Guardar el estado actual del diagrama en la memoria local"
        >
          {isSaved ? <Check className="w-4 h-4 animate-bounce" /> : <Save className="w-4 h-4" />}
          {isSaved ? '¡Estado Guardado!' : 'Guardar Estado'}
        </button>
      </div>
    </aside>
  );
};
