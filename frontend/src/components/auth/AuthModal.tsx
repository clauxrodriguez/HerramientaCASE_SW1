import React, { useState } from 'react';
import { X, User, Key, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

export const AuthModal: React.FC = () => {
  const { user, isProfileModalOpen, closeProfileModal, setAuth, logout } = useAuthStore();
  
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  if (!isProfileModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      setAuth(
        { ...user, username: username.trim(), email: email.trim() },
        localStorage.getItem('auth_token') || 'token-123'
      );
    }
    closeProfileModal();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-floating space-y-5 animate-in fade-in duration-150">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Ajustes de Perfil</h3>
          </div>
          <button onClick={closeProfileModal} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Nombre de Usuario</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Token JWT Activo</label>
            <div className="flex items-center gap-2 p-2 bg-surface-panel rounded-lg border border-surface-border font-mono text-[11px] text-slate-600 truncate">
              <Key className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="truncate">{localStorage.getItem('auth_token') || 'demo-token-active'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={() => {
                logout();
                closeProfileModal();
              }}
              className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" /> Cerrar Sesión
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
