import React, { useState } from 'react';
import { Trash2, Plus, Edit3, Key } from 'lucide-react';
import { useUMLStore } from '../../stores/useUMLStore';
import { Visibility, COMMON_DATA_TYPES } from '../../types/uml';

export const ClassEditorPanel: React.FC = () => {
  const {
    classes,
    selectedClassId,
    updateClass,
    removeClass,
    addAttribute,
    updateAttribute,
    removeAttribute,
    addMethod,
    updateMethod,
    removeMethod,
  } = useUMLStore();

  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrType, setNewAttrType] = useState<string>('String');
  const [customAttrType, setCustomAttrType] = useState('');
  const [newAttrVis, setNewAttrVis] = useState<Visibility>('+');
  const [newAttrPK, setNewAttrPK] = useState(false);

  const [newMethName, setNewMethName] = useState('');
  const [newMethReturn, setNewMethReturn] = useState<string>('void');
  const [newMethVis, setNewMethVis] = useState<Visibility>('+');

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  if (!selectedClass) {
    return (
      <div className="w-80 border-l border-surface-border bg-white p-6 flex flex-col items-center justify-center text-center h-full select-none">
        <div className="p-3 bg-surface-panel rounded-full mb-3 text-surface-subtext">
          <Edit3 className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-800 text-sm">Sin Selección</h3>
        <p className="text-xs text-surface-subtext mt-1 max-w-[200px]">
          Haz clic en cualquier clase del lienzo para editar sus atributos, tipos de datos y llave primaria.
        </p>
      </div>
    );
  }

  const handleAddAttributeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttrName.trim()) return;

    const finalType = newAttrType === 'Otro' ? (customAttrType.trim() || 'Object') : newAttrType;

    addAttribute(selectedClass.id, {
      name: newAttrName.trim(),
      type: finalType,
      visibility: newAttrVis,
      isPrimaryKey: newAttrPK,
    });
    setNewAttrName('');
    setNewAttrPK(false);
  };

  const handleAddMethodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethName.trim()) return;
    addMethod(selectedClass.id, {
      name: newMethName.trim(),
      returnType: newMethReturn,
      visibility: newMethVis,
    });
    setNewMethName('');
  };

  return (
    <div className="w-80 border-l border-surface-border bg-white flex flex-col h-full shadow-subtle z-10 overflow-y-auto font-sans">
      {/* Header del Panel */}
      <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-bg sticky top-0 z-10">
        <h3 className="font-semibold text-slate-900 text-sm">Editor de Clase</h3>
        <button
          onClick={() => removeClass(selectedClass.id)}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
          title="Eliminar clase"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Nombre de la Clase y Modificadores */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700">Nombre de Clase</label>
          <input
            type="text"
            value={selectedClass.name}
            onChange={(e) => updateClass(selectedClass.id, { name: e.target.value })}
            className="w-full text-xs px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none font-semibold text-slate-800"
          />

          <label className="flex items-center gap-2 text-xs text-surface-subtext cursor-pointer">
            <input
              type="checkbox"
              checked={selectedClass.isAbstract || false}
              onChange={(e) => updateClass(selectedClass.id, { isAbstract: e.target.checked })}
              className="rounded border-surface-border text-brand-600 focus:ring-brand-400"
            />
            <span>Clase Abstracta</span>
          </label>
        </div>

        {/* Sección de Atributos */}
        <div className="space-y-3 pt-4 border-t border-surface-border">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800">Atributos ({selectedClass.attributes.length})</h4>
          </div>

          {/* Lista de Atributos Existentes */}
          <div className="space-y-2">
            {selectedClass.attributes.map((attr) => (
              <div
                key={attr.id}
                className={`flex flex-col gap-1.5 p-2.5 border rounded-xl transition ${
                  attr.isPrimaryKey
                    ? 'border-brand-300 bg-brand-50/50'
                    : 'border-surface-border bg-surface-bg'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  {/* Visibilidad */}
                  <select
                    value={attr.visibility}
                    onChange={(e) =>
                      updateAttribute(selectedClass.id, attr.id, { visibility: e.target.value as Visibility })
                    }
                    className="bg-white border border-surface-border rounded px-1 text-xs font-mono font-bold"
                  >
                    <option value="+">+</option>
                    <option value="-">-</option>
                    <option value="#">#</option>
                  </select>

                  {/* Nombre */}
                  <input
                    type="text"
                    value={attr.name}
                    onChange={(e) => updateAttribute(selectedClass.id, attr.id, { name: e.target.value })}
                    className="w-1/3 px-1.5 py-1 border border-surface-border rounded bg-white text-xs font-medium"
                    placeholder="nombre"
                  />

                  {/* Menú Desplegable de Tipo de Dato */}
                  <select
                    value={COMMON_DATA_TYPES.includes(attr.type as any) ? attr.type : 'Otro'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'Otro') {
                        updateAttribute(selectedClass.id, attr.id, { type: val });
                      }
                    }}
                    className="w-1/3 px-1 py-1 border border-surface-border rounded bg-white text-xs font-medium text-slate-700"
                  >
                    {COMMON_DATA_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="Otro">Personalizado</option>
                  </select>

                  <button
                    onClick={() => removeAttribute(selectedClass.id, attr.id)}
                    className="text-slate-400 hover:text-red-500 ml-auto"
                    title="Eliminar atributo"
                  >
                    &times;
                  </button>
                </div>

                {/* Si seleccionó tipo personalizado */}
                {!COMMON_DATA_TYPES.includes(attr.type as any) && (
                  <input
                    type="text"
                    value={attr.type}
                    onChange={(e) => updateAttribute(selectedClass.id, attr.id, { type: e.target.value })}
                    className="w-full text-[11px] px-2 py-0.5 border border-surface-border rounded bg-white text-slate-600"
                    placeholder="Tipo personalizado (ej. List<String>)"
                  />
                )}

                {/* Checkbox de Llave Primaria (PK) */}
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={attr.isPrimaryKey || false}
                    onChange={(e) =>
                      updateAttribute(selectedClass.id, attr.id, { isPrimaryKey: e.target.checked })
                    }
                    className="rounded border-surface-border text-brand-600 focus:ring-brand-400"
                  />
                  <span className="flex items-center gap-1">
                    <Key className={`w-3 h-3 ${attr.isPrimaryKey ? 'text-brand-600' : 'text-slate-400'}`} />
                    Llave Primaria (PK)
                  </span>
                </label>
              </div>
            ))}
          </div>

          {/* Formulario Agregar Nuevo Atributo */}
          <form onSubmit={handleAddAttributeSubmit} className="space-y-2 pt-2 border-t border-dashed border-surface-border">
            <span className="text-[11px] font-semibold text-slate-600">Nuevo Atributo:</span>
            <div className="flex items-center gap-1.5">
              <select
                value={newAttrVis}
                onChange={(e) => setNewAttrVis(e.target.value as Visibility)}
                className="bg-white border border-surface-border rounded p-1 text-xs font-mono"
              >
                <option value="+">+</option>
                <option value="-">-</option>
                <option value="#">#</option>
              </select>

              <input
                type="text"
                placeholder="nombreAtributo"
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                className="w-1/3 text-xs px-2 py-1 border border-surface-border rounded"
              />

              {/* Selector de Tipo de Dato */}
              <select
                value={newAttrType}
                onChange={(e) => setNewAttrType(e.target.value)}
                className="w-1/3 text-xs px-1 py-1 border border-surface-border rounded bg-white"
              >
                {COMMON_DATA_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="Otro">Otro...</option>
              </select>

              <button
                type="submit"
                className="p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm ml-auto"
                title="Agregar Atributo"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {newAttrType === 'Otro' && (
              <input
                type="text"
                placeholder="Tipo personalizado (ej: List<Producto>)"
                value={customAttrType}
                onChange={(e) => setCustomAttrType(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-surface-border rounded"
              />
            )}

            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={newAttrPK}
                onChange={(e) => setNewAttrPK(e.target.checked)}
                className="rounded border-surface-border text-brand-600 focus:ring-brand-400"
              />
              <Key className="w-3.5 h-3.5 text-brand-600" />
              <span>Marcar como Llave Primaria (PK)</span>
            </label>
          </form>
        </div>

        {/* Sección de Métodos */}
        <div className="space-y-3 pt-4 border-t border-surface-border">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800">Métodos ({selectedClass.methods.length})</h4>
          </div>

          <div className="space-y-2">
            {selectedClass.methods.map((meth) => (
              <div
                key={meth.id}
                className="flex items-center gap-2 p-2 border border-surface-border rounded-lg bg-surface-bg text-xs"
              >
                <select
                  value={meth.visibility}
                  onChange={(e) =>
                    updateMethod(selectedClass.id, meth.id, { visibility: e.target.value as Visibility })
                  }
                  className="bg-white border border-surface-border rounded px-1 text-xs font-mono font-bold"
                >
                  <option value="+">+</option>
                  <option value="-">-</option>
                  <option value="#">#</option>
                </select>

                <input
                  type="text"
                  value={meth.name}
                  onChange={(e) => updateMethod(selectedClass.id, meth.id, { name: e.target.value })}
                  className="w-1/2 px-1.5 py-0.5 border border-surface-border rounded bg-white text-xs font-medium"
                />

                <input
                  type="text"
                  value={meth.returnType}
                  onChange={(e) => updateMethod(selectedClass.id, meth.id, { returnType: e.target.value })}
                  className="w-1/2 px-1.5 py-0.5 border border-surface-border rounded bg-white text-xs text-slate-600"
                />

                <button
                  onClick={() => removeMethod(selectedClass.id, meth.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Agregar Nuevo Método */}
          <form onSubmit={handleAddMethodSubmit} className="flex items-center gap-1.5 pt-1">
            <select
              value={newMethVis}
              onChange={(e) => setNewMethVis(e.target.value as Visibility)}
              className="bg-white border border-surface-border rounded p-1 text-xs font-mono"
            >
              <option value="+">+</option>
              <option value="-">-</option>
              <option value="#">#</option>
            </select>
            <input
              type="text"
              placeholder="nombreMetodo"
              value={newMethName}
              onChange={(e) => setNewMethName(e.target.value)}
              className="w-1/2 text-xs px-2 py-1 border border-surface-border rounded"
            />
            <input
              type="text"
              placeholder="retorno"
              value={newMethReturn}
              onChange={(e) => setNewMethReturn(e.target.value)}
              className="w-1/2 text-xs px-2 py-1 border border-surface-border rounded"
            />
            <button
              type="submit"
              className="p-1 bg-brand-600 text-white rounded hover:bg-brand-700 transition"
              title="Agregar Método"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
