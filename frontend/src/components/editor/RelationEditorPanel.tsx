import React from 'react';
import { Trash2, Link2, ArrowRight } from 'lucide-react';
import { useUMLStore } from '../../stores/useUMLStore';
import { RelationType } from '../../types/uml';

export const RelationEditorPanel: React.FC = () => {
  const {
    relations,
    classes,
    selectedRelationId,
    updateRelation,
    removeRelation,
    selectRelation,
  } = useUMLStore();

  const selectedRelation = relations.find((r) => r.id === selectedRelationId);

  if (!selectedRelation) return null;

  const sourceClass = classes.find(
    (c) => c.id === selectedRelation.sourceId || c.name.toLowerCase() === selectedRelation.sourceId.toLowerCase()
  );
  const targetClass = classes.find(
    (c) => c.id === selectedRelation.targetId || c.name.toLowerCase() === selectedRelation.targetId.toLowerCase()
  );

  const cardOptions = ['1', '*', '0..1', '1..*', '0..*'];

  return (
    <div className="w-80 border-l border-surface-border bg-white flex flex-col h-full shadow-subtle z-10 overflow-y-auto font-sans">
      {/* Header del Panel */}
      <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-bg sticky top-0 z-10">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="p-1 bg-brand-100 text-brand-600 rounded">
            <Link2 className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm">Editar Relación</h3>
        </div>
        <button
          onClick={() => {
            removeRelation(selectedRelation.id);
            selectRelation(null);
          }}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
          title="Eliminar relación"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Banner Entidades Conectadas */}
        <div className="p-3 bg-surface-panel rounded-xl border border-surface-border flex items-center justify-between text-xs font-semibold text-slate-800">
          <span className="px-2 py-1 bg-white rounded border border-surface-border truncate max-w-[90px]">
            {sourceClass?.name || 'Origen'}
          </span>
          <ArrowRight className="w-4 h-4 text-brand-500 shrink-0" />
          <span className="px-2 py-1 bg-white rounded border border-surface-border truncate max-w-[90px]">
            {targetClass?.name || 'Destino'}
          </span>
        </div>

        {/* Selector de Tipo de Relación */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">Tipo de Relación UML</label>
          <select
            value={selectedRelation.type}
            onChange={(e) => updateRelation(selectedRelation.id, { type: e.target.value as RelationType })}
            className="w-full text-xs px-3 py-2 border border-surface-border rounded-lg bg-white focus:ring-2 focus:ring-brand-400 focus:outline-none font-medium text-slate-800"
          >
            <option value="ONE_TO_MANY">Uno a Muchos (1 ── *) - Asociación Estándar</option>
            <option value="MANY_TO_ONE">Muchos a Uno (* ── 1)</option>
            <option value="ONE_TO_ONE">Uno a Uno (1 ── 1)</option>
            <option value="MANY_TO_MANY">Muchos a Muchos (* ── *)</option>
            <option value="COMPOSITION">Composición (◆ ── Contiene)</option>
            <option value="AGGREGATION">Agregación (◇ ── Agrega)</option>
            <option value="INHERITANCE">Herencia / Generalización (△ ── Hereda)</option>
          </select>
        </div>

        {/* Multiplicidad Origen */}
        <div className="space-y-2 pt-3 border-t border-surface-border">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Multiplicidad Origen ({sourceClass?.name || 'Origen'})</span>
          </label>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {cardOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateRelation(selectedRelation.id, { sourceCardinality: opt })}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition ${
                  selectedRelation.sourceCardinality === opt
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-surface-border'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={selectedRelation.sourceCardinality || ''}
            onChange={(e) => updateRelation(selectedRelation.id, { sourceCardinality: e.target.value })}
            placeholder="Personalizada (ej. 0..1, 1..5)"
            className="w-full text-xs px-3 py-1.5 border border-surface-border rounded-lg bg-white focus:ring-2 focus:ring-brand-400 focus:outline-none font-mono"
          />
        </div>

        {/* Multiplicidad Destino */}
        <div className="space-y-2 pt-3 border-t border-surface-border">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Multiplicidad Destino ({targetClass?.name || 'Destino'})</span>
          </label>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {cardOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateRelation(selectedRelation.id, { targetCardinality: opt })}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition ${
                  selectedRelation.targetCardinality === opt
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-surface-border'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={selectedRelation.targetCardinality || ''}
            onChange={(e) => updateRelation(selectedRelation.id, { targetCardinality: e.target.value })}
            placeholder="Personalizada (ej. *, 1..*)"
            className="w-full text-xs px-3 py-1.5 border border-surface-border rounded-lg bg-white focus:ring-2 focus:ring-brand-400 focus:outline-none font-mono"
          />
        </div>

        {/* Botón Eliminar */}
        <div className="pt-4 border-t border-surface-border">
          <button
            onClick={() => {
              removeRelation(selectedRelation.id);
              selectRelation(null);
            }}
            className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs rounded-lg flex items-center justify-center gap-2 border border-red-200 transition"
          >
            <Trash2 className="w-4 h-4" /> Eliminar Esta Relación
          </button>
        </div>
      </div>
    </div>
  );
};
