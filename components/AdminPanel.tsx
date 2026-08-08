
import React, { useState } from 'react';
import { User, Announcement } from '../types';

interface AdminPanelProps {
  users: User[];
  announcements: Announcement[];
  onAddAnnouncement: (text: string) => void;
  onUpdateAnnouncement: (id: string, text: string) => void;
  onDeleteAnnouncement: (id: string) => void;
  onSetRole: (userId: string, role: string, color?: string) => void;
  onBanUser: (userId: string) => void;
  onUserClick: (uid: string) => void;
}

const PRESET_COLORS = [
  '#000000', '#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280', '#06B6D4', '#00000000'
];

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  users, announcements, onAddAnnouncement, onUpdateAnnouncement, onDeleteAnnouncement, onSetRole, onBanUser, onUserClick 
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'broadcast'>('users');
  const [adminSearch, setAdminSearch] = useState('');
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [newRoleValue, setNewRoleValue] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#000000');
  
  const [broadcastText, setBroadcastText] = useState('');
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);

  const filteredUsers = users.filter(u => {
    const safeSearch = (adminSearch || '').toLowerCase();
    return (u.name || '').toLowerCase().includes(safeSearch) || (u.email || '').toLowerCase().includes(safeSearch);
  });

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    if (editingAnnId) {
      onUpdateAnnouncement(editingAnnId, broadcastText);
      setEditingAnnId(null);
    } else {
      onAddAnnouncement(broadcastText);
    }
    setBroadcastText('');
  };

  const startEditAnn = (ann: Announcement) => {
    setEditingAnnId(ann.id);
    setBroadcastText(ann.text);
  };

  return (
    <div className="p-6 pb-24 animate-fade-in relative">
      <div className="mb-8">
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Command Center</h2>
        <div className="flex space-x-4 border-b-2 border-black/5">
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'users' ? 'border-black text-black' : 'border-transparent text-gray-300'}`}
          >
            User Orchestration
          </button>
          <button 
            onClick={() => setActiveTab('broadcast')}
            className={`pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'broadcast' ? 'border-black text-black' : 'border-transparent text-gray-300'}`}
          >
            Broadcast Center
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <>
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black opacity-30">
              <i className="fas fa-filter text-xs"></i>
            </span>
            <input 
              type="text" 
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Filter by name or email..."
              className="w-full bg-gray-50 border-2 border-black rounded-2xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:ring-0 transition-all font-bold"
            />
          </div>

          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="py-20 text-center opacity-20">
                <i className="fas fa-search-minus text-4xl mb-4"></i>
                <p className="font-black uppercase tracking-widest text-xs">No records found</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="p-4 border-2 border-black rounded-2xl bg-white shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <img 
                        src={user.photoURL} 
                        className={`w-12 h-12 rounded-full border-2 border-black object-cover cursor-pointer ${user.isBanned ? 'grayscale opacity-30' : ''}`}
                        onClick={() => onUserClick(user.id)}
                        alt={user.name}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-black uppercase tracking-tighter truncate ${user.isBanned ? 'text-gray-400 line-through' : 'text-black'}`}>
                            {user.name}
                          </h4>
                          {user.isAdmin && <span className="bg-yellow-400 text-black text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Admin</span>}
                          {user.role && <span className="text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter" style={{ backgroundColor: user.roleColor || '#000000' }}>{user.role}</span>}
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 truncate uppercase tracking-widest">{user.email}</p>
                      </div>
                    </div>
                    {user.isBanned && <span className="text-[8px] font-black text-red-600 border border-red-600 px-2 py-1 rounded-full uppercase tracking-tighter">Banished</span>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => { setEditingRoleUser(user); setNewRoleValue(user.role || ''); setNewRoleColor(user.roleColor || '#000000'); }} className="flex-1 bg-white border-2 border-black text-black py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">Set Role</button>
                    <button onClick={() => onBanUser(user.id)} className={`flex-1 border-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${user.isBanned ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'}`}>{user.isBanned ? 'Restore' : 'Banish'}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleBroadcastSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Proclamation Message</label>
              <textarea 
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="What must the shadows know?"
                className="w-full bg-gray-50 border-2 border-black rounded-2xl p-4 text-sm font-bold focus:outline-none focus:bg-white transition-all h-32 resize-none"
              />
            </div>
            <div className="flex space-x-2">
              {editingAnnId && (
                <button 
                  type="button" 
                  onClick={() => { setEditingAnnId(null); setBroadcastText(''); }}
                  className="px-6 border-2 border-black rounded-xl text-[10px] font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit"
                className="flex-1 bg-black text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                {editingAnnId ? 'Update Proclamation' : 'Post Proclamation'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Active Proclamations</h3>
            {announcements.length === 0 ? (
              <p className="text-center py-10 text-[10px] text-gray-300 font-black uppercase tracking-widest">Silence persists...</p>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className="p-4 border-2 border-black rounded-2xl bg-white shadow-sm space-y-3">
                  <p className="text-sm font-bold">{ann.text}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{new Date(ann.timestamp).toLocaleString()}</span>
                    <div className="flex space-x-2">
                      <button onClick={() => startEditAnn(ann)} className="text-[8px] font-black uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Edit</button>
                      <button onClick={() => onDeleteAnnouncement(ann.id)} className="text-[8px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-3 py-1 rounded-full">Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editingRoleUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-4 border-black w-full max-w-sm rounded-3xl overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="p-6 border-b-4 border-black bg-black text-white">
              <h3 className="font-black uppercase tracking-[0.2em] text-sm">Update Destiny</h3>
              <p className="text-[8px] uppercase tracking-widest opacity-60 mt-1">Assign role to {editingRoleUser.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" autoFocus value={newRoleValue} onChange={(e) => setNewRoleValue(e.target.value)} placeholder="Role Name" className="w-full bg-gray-50 border-2 border-black rounded-xl p-4 font-bold focus:outline-none" />
              <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-xl">
                {PRESET_COLORS.map(color => (
                  <button key={color} onClick={() => setNewRoleColor(color)} className={`w-7 h-7 rounded-full border-2 ${newRoleColor === color ? 'border-black scale-110' : 'border-transparent'}`} style={{ backgroundColor: color === '#00000000' ? '#fff' : color }} />
                ))}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setEditingRoleUser(null)} className="flex-1 border-2 border-black p-3 rounded-xl font-black uppercase text-xs">Cancel</button>
                <button onClick={() => { onSetRole(editingRoleUser.id, newRoleValue.trim(), newRoleColor); setEditingRoleUser(null); }} className="flex-1 bg-black text-white p-3 rounded-xl font-black uppercase text-xs">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
