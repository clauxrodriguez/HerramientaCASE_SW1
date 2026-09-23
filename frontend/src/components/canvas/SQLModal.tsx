import React, { useState } from 'react';
import { X, Copy, Check, Database, Download } from 'lucide-react';

export const SQLModal: React.FC<{ sql: string; isOpen: boolean; onClose: () => void }> = ({
  sql,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema_postgresql.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-floating space-y-4 animate-in fade-in duration-150 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <Database className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Esquema DDL PostgreSQL Generado</h3>
              <p className="text-xs text-surface-subtext">Script SQL de creación de tablas y llaves foráneas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs leading-relaxed border border-slate-800">
          <pre>{sql}</pre>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleDownload}
            className="px-3.5 py-2 border border-surface-border rounded-lg text-xs font-medium text-slate-700 hover:bg-surface-panel flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-brand-600" /> Descargar .sql
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '¡Copiado al portapapeles!' : 'Copiar SQL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
