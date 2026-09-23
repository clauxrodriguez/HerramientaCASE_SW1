import React, { useState } from 'react';
import { Sparkles, Mic, Upload, Check, Loader2, X, Bot, Edit3 } from 'lucide-react';
import { aiService } from '../../services/api';
import { useUMLStore } from '../../stores/useUMLStore';
import { UMLClass, Relation } from '../../types/uml';

export const AIAssistantDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loadingMode, setLoadingMode] = useState<'generate' | 'modify' | 'image' | null>(null);
  const [suggestions, setSuggestions] = useState<any | null>(null);

  const { classes, relations, setClasses, setRelations, projectName, packageName } = useUMLStore();

  if (!isOpen) return null;

  // Reconocimiento de voz por micrófono (Web Speech API)
  const handleVoiceCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta el API de reconocimiento de voz por micrófono.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const parseAttr = (attr: any, classId: string, aIdx: number) => {
    if (typeof attr === 'object' && attr !== null) {
      const name = attr.name || attr.title || `campo${aIdx + 1}`;
      const isPk = !!(attr.isId || attr.isPrimaryKey || name.toLowerCase() === 'id' || name.toLowerCase().endsWith('_id'));
      return {
        id: attr.id || `attr-${classId}-${aIdx}`,
        name,
        type: attr.type || 'String',
        visibility: attr.visibility && attr.visibility !== 'undefined' ? attr.visibility : (isPk ? '-' : '+'),
        isPrimaryKey: isPk,
      };
    }

    const rawStr = String(attr).trim();
    let visibility = '+';
    let cleanStr = rawStr;

    if (cleanStr.startsWith('+') || cleanStr.startsWith('-') || cleanStr.startsWith('#')) {
      visibility = cleanStr[0];
      cleanStr = cleanStr.substring(1).trim();
    }

    let name = cleanStr;
    let type = 'String';

    if (cleanStr.includes(':')) {
      const parts = cleanStr.split(':');
      name = parts[0].trim();
      type = parts[1].trim() || 'String';
    } else if (cleanStr.includes(' ')) {
      const parts = cleanStr.split(/\s+/);
      name = parts[0].trim();
      type = parts[1].trim() || 'String';
    }

    const isPk = name.toLowerCase() === 'id' || name.toLowerCase().endsWith('_id') || name.toLowerCase().startsWith('id_');
    if (isPk && visibility === '+') {
      visibility = '-';
    }

    return {
      id: `attr-${classId}-${aIdx}`,
      name: name || `campo${aIdx + 1}`,
      type: type || 'String',
      visibility,
      isPrimaryKey: isPk,
    };
  };

  const parseMeth = (meth: any, classId: string, mIdx: number) => {
    if (typeof meth === 'object' && meth !== null) {
      return {
        id: meth.id || `meth-${classId}-${mIdx}`,
        name: meth.name || `metodo${mIdx + 1}`,
        returnType: meth.returnType || 'void',
        visibility: meth.visibility && meth.visibility !== 'undefined' ? meth.visibility : '+',
      };
    }

    const rawStr = String(meth).trim();
    let visibility = '+';
    let cleanStr = rawStr;

    if (cleanStr.startsWith('+') || cleanStr.startsWith('-') || cleanStr.startsWith('#')) {
      visibility = cleanStr[0];
      cleanStr = cleanStr.substring(1).trim();
    }

    let name = cleanStr;
    let returnType = 'void';

    if (cleanStr.includes(':')) {
      const parts = cleanStr.split(':');
      name = parts[0].trim();
      returnType = parts[1].trim() || 'void';
    }

    name = name.replace(/\(\)/g, '').trim();

    return {
      id: `meth-${classId}-${mIdx}`,
      name: name || `metodo${mIdx + 1}`,
      returnType,
      visibility,
    };
  };

  const applySuggestionsData = (data: any) => {
    if (!data) return;

    const classNameToIdMap = new Map<string, string>();
    const formattedClasses: UMLClass[] = [];
    const formattedRelations: Relation[] = [];

    // 1. Normalizar Clases e IDs + Layout sin Solapamiento (Grilla 2x2)
    if (data.classes && Array.isArray(data.classes)) {
      data.classes.forEach((c: any, index: number) => {
        const classId = c.id || `cls-${(c.name || 'clase').toLowerCase().replace(/\s+/g, '')}`;
        if (c.name) classNameToIdMap.set(c.name.toLowerCase(), classId);
        if (c.id) classNameToIdMap.set(c.id.toLowerCase(), classId);

        // Posicionamiento en grilla 2 columnas x N filas para evitar solapamientos
        const col = index % 2;
        const row = Math.floor(index / 2);
        const posX = 80 + col * 340;
        const posY = 80 + row * 280;

        const attributes = (c.attributes || []).map((attr: any, aIdx: number) => parseAttr(attr, classId, aIdx));
        const methods = (c.methods || []).map((meth: any, mIdx: number) => parseMeth(meth, classId, mIdx));

        formattedClasses.push({
          id: classId,
          name: c.name || 'ClaseSinNombre',
          x: c.x || posX,
          y: c.y || posY,
          attributes,
          methods,
          isAbstract: !!c.isAbstract,
        });
      });
    }

    // 2. Normalizar Relaciones asociando por ID o por Nombre de Clase
    if (data.relations && Array.isArray(data.relations)) {
      data.relations.forEach((r: any, index: number) => {
        const rawSource = (r.sourceId || r.source || r.from || '').toString().toLowerCase();
        const rawTarget = (r.targetId || r.target || r.to || '').toString().toLowerCase();

        const resolvedSourceId = classNameToIdMap.get(rawSource) || r.sourceId || r.source || r.from;
        const resolvedTargetId = classNameToIdMap.get(rawTarget) || r.targetId || r.target || r.to;

        if (resolvedSourceId && resolvedTargetId) {
          formattedRelations.push({
            id: r.id || `rel-${index + 1}`,
            sourceId: resolvedSourceId,
            targetId: resolvedTargetId,
            type: r.type || 'ONE_TO_MANY',
            sourceCardinality: r.sourceCardinality || '1',
            targetCardinality: r.targetCardinality || '*',
          });
        }
      });
    }

    // Fallback de relaciones lógicas para veterinaria si faltan
    if (formattedClasses.length >= 3 && formattedRelations.length === 0) {
      const propClass = formattedClasses.find(c => c.name.toLowerCase().includes('propietario'));
      const mascClass = formattedClasses.find(c => c.name.toLowerCase().includes('mascota'));
      const vetClass = formattedClasses.find(c => c.name.toLowerCase().includes('veterinario'));
      const citaClass = formattedClasses.find(c => c.name.toLowerCase().includes('cita'));

      if (propClass && mascClass) {
        formattedRelations.push({
          id: 'rel-prop-masc',
          sourceId: propClass.id,
          targetId: mascClass.id,
          type: 'ONE_TO_MANY',
          sourceCardinality: '1',
          targetCardinality: '*'
        });
      }
      if (mascClass && citaClass) {
        formattedRelations.push({
          id: 'rel-masc-cita',
          sourceId: mascClass.id,
          targetId: citaClass.id,
          type: 'ONE_TO_MANY',
          sourceCardinality: '1',
          targetCardinality: '*'
        });
      }
      if (vetClass && citaClass) {
        formattedRelations.push({
          id: 'rel-vet-cita',
          sourceId: vetClass.id,
          targetId: citaClass.id,
          type: 'ONE_TO_MANY',
          sourceCardinality: '1',
          targetCardinality: '*'
        });
      }
    }

    setClasses(formattedClasses);
    setRelations(formattedRelations);
  };

  // Modificar diagrama existente sin borrar lo actual
  const handleModifyText = async () => {
    if (!prompt.trim()) return;
    setLoadingMode('modify');
    try {
      const currentDiagram = {
        id: 'diag-1',
        name: projectName || 'DiagramaUML',
        package: packageName || 'com.ejemplo',
        classes,
        relations,
      };

      const data = await aiService.modifyDiagramFromText(prompt, currentDiagram);
      const modifiedDiagram = data?.updatedDiagram || data;
      if (modifiedDiagram && (modifiedDiagram.classes || modifiedDiagram.relations)) {
        setSuggestions(modifiedDiagram);
        applySuggestionsData(modifiedDiagram);
      } else {
        alert('No se pudieron aplicar las modificaciones al diagrama actual.');
      }
    } catch (err: any) {
      console.error('Error modificando diagrama:', err);
      alert('Error al modificar el diagrama con la IA.');
    } finally {
      setLoadingMode(null);
    }
  };

  // Generar nuevo diagrama desde cero (reemplaza)
  const handleGenerateText = async () => {
    if (!prompt.trim()) return;
    setLoadingMode('generate');
    try {
      const data = await aiService.generateDiagramFromText(prompt);
      if (data) {
        setSuggestions(data);
        applySuggestionsData(data);
      }
    } catch (err: any) {
      console.error('Error generando diagrama:', err);
      alert('No se pudo conectar con el endpoint de IA. Verifica que el servidor backend esté corriendo.');
    } finally {
      setLoadingMode(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingMode('image');
    try {
      const data = await aiService.generateFromImage(file);
      if (data?.diagram) {
        setSuggestions(data.diagram);
        applySuggestionsData(data.diagram);
      } else {
        alert('El servidor no devolvió un diagrama de imagen válido.');
      }
    } catch (err) {
      console.error('Error al procesar la imagen:', err);
      alert('Error procesando imagen en el backend.');
    } finally {
      setLoadingMode(null);
    }
  };

  const applySuggestions = () => {
    if (!suggestions) return;
    applySuggestionsData(suggestions);
    setSuggestions(null);
    setPrompt('');
    onClose();
  };

  // Generar sugerencias contextuales rápidas basándose en el lienzo actual
  const getContextualSuggestions = () => {
    const list: string[] = [];

    if (classes.length >= 2) {
      const c1 = classes[0].name;
      const c2 = classes[1].name;
      const hasRel = relations.some(r => 
        (r.sourceId === classes[0].id && r.targetId === classes[1].id) ||
        (r.sourceId === classes[1].id && r.targetId === classes[0].id)
      );
      if (!hasRel) {
        list.push(`Añade una relación entre ${c1} y ${c2}`);
      }
    }

    const classWithoutEmail = classes.find(c => !c.attributes.some(a => a.name.toLowerCase() === 'email'));
    if (classWithoutEmail) {
      list.push(`Agrega el atributo email a ${classWithoutEmail.name}`);
    }

    const classWithoutDate = classes.find(c => !c.attributes.some(a => a.name.toLowerCase().includes('fecha')));
    if (classWithoutDate) {
      list.push(`Agrega atributo fechaCreacion a ${classWithoutDate.name}`);
    }

    if (list.length < 3) {
      list.push('Crea una clase Factura con id, fecha y total');
    }

    return list.slice(0, 4);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-surface-border shadow-floating z-30 flex flex-col h-full animate-in slide-in-from-right duration-200 font-sans">
      <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-bg">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-lavender-100 text-lavender-600 rounded-lg">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Asistente IA</h3>
            <p className="text-[10px] text-surface-subtext">Generador & Asistente Diagramador</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-md">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-5">
        {/* Input de Prompt escrito + Modulador de Voz */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">Comando de Lenguaje Natural</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ejemplo: Agrega una clase Factura con id, fecha y total, y relaciónala con Cliente..."
              className="w-full text-xs p-3 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none resize-none h-28 pr-9"
            />
            <button
              type="button"
              onClick={handleVoiceCommand}
              className={`absolute bottom-3 right-3 p-1.5 rounded-full transition ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-surface-panel hover:bg-slate-200 text-slate-600'
              }`}
              title="Dictar comando por voz"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sugerencias Rápidas de la IA */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-500" /> Sugerencias Inteligentes:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {getContextualSuggestions().map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sug)}
                className="text-[10px] bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition text-left font-medium"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Botones de Acción de IA: Modificar Existente vs Generar Nuevo */}
        <div className="space-y-2">
          <button
            onClick={handleModifyText}
            disabled={loadingMode !== null || !prompt.trim()}
            className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-subtle"
            title="Modificar o añadir elementos al diagrama existente en el lienzo sin borrar lo anterior"
          >
            {loadingMode === 'modify' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Edit3 className="w-4 h-4 text-brand-200" />
            )}
            Modificar Diagrama Existente
          </button>

          <button
            onClick={handleGenerateText}
            disabled={loadingMode !== null || !prompt.trim()}
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 font-medium text-xs rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-subtle border border-slate-700"
            title="Generar un nuevo diagrama desde cero (reemplaza las clases actuales)"
          >
            {loadingMode === 'generate' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-brand-300" />
            )}
            Generar Nuevo Diagrama
          </button>
        </div>

        {/* Zona Image-to-Diagram */}
        <div className="space-y-1.5 pt-3 border-t border-surface-border">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Image-to-Diagram (Vision Parser)
          </span>
          <label className="border-2 border-dashed border-surface-border rounded-xl p-4 text-center hover:border-brand-300 transition cursor-pointer bg-surface-bg flex flex-col items-center justify-center space-y-1">
            <Upload className="w-5 h-5 text-brand-600" />
            <span className="text-xs font-medium text-slate-800">Subir Bosquejo o Imagen</span>
            <span className="text-[10px] text-surface-subtext">JPG, PNG o WEBP de diagrama de clases</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {/* Previsualización de Sugerencias y Estado de Aplicación */}
        {suggestions && (
          <div className="border border-brand-200 bg-brand-50/60 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-brand-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" /> Diagrama Reconocido:
              </h4>
              <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Aplicado al lienzo
              </span>
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto text-xs text-slate-700">
              {suggestions.classes?.map((c: any) => (
                <div key={c.name} className="flex items-center justify-between bg-white px-2 py-1 rounded border border-brand-100 text-[11px]">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="text-[10px] text-slate-500">
                    {c.attributes?.length || 0} attrs, {c.methods?.length || 0} métodos
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={applySuggestions}
              className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <Check className="w-3.5 h-3.5" /> Re-aplicar y Cerrar Asistente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
