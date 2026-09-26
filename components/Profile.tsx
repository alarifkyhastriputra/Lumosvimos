
import React, { useState, useEffect } from 'react';
import { User, Post } from '../types.ts';
import UserListModal from './UserListModal.tsx';
import PostCard from './PostCard.tsx';
import { useLanguage } from '../LanguageContext.tsx';
import { SHOP_ITEMS } from './Shop.tsx';
import { compressImage } from '../services/imageCompressor.ts';

interface ProfileProps {
  user: User;
  users: User[];
  posts?: Post[];
  currentUser?: User | null;
  onToggleFollow: (id: string) => void;
  onUpdateProfile: (data: Partial<User>) => void;
  onAddCapture: (url: string) => void;
  onUserClick: (userId: string) => void;
  onLogout: () => void;
  onBanUser?: (userId: string) => void;
  onSetRole?: (userId: string, role: string, color?: string) => void;
  onToggleAdmin?: (userId: string, currentStatus: boolean) => void;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onComment?: (postId: string, text: string) => void;
  onTakeDownPost?: (id: string) => void;
  onDeletePost?: (id: string) => void;
}

const Profile = ({ 
  user, 
  users = [], 
  posts = [],
  currentUser, 
  onToggleFollow, 
  onUpdateProfile, 
  onAddCapture, 
  onUserClick, 
  onLogout,
  onBanUser,
  onSetRole,
  onToggleAdmin,
  onLike,
  onDislike,
  onComment,
  onTakeDownPost,
  onDeletePost
}: ProfileProps) => {
  const { t, language, setLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ 
    name: user?.name || '', 
    bio: user?.bio || '' 
  });

  useEffect(() => {
    if (user) {
      setEditData({
        name: user.name || '',
        bio: user.bio || ''
      });
    }
  }, [user?.id, user?.name, user?.bio]);

  const isMe = Boolean(currentUser && user && user.id === currentUser.id);
  const isFollowing = Boolean(currentUser?.following && user?.id && currentUser.following.includes(user.id));
  const isAdminViewing = Boolean(currentUser?.isAdmin);
  const isTargetAdmin = Boolean(user?.isAdmin);
  const isBanned = Boolean(user?.isBanned);

  const followersList = users.filter(u => (user?.followers || []).includes(u.id));
  const followingList = users.filter(u => (user?.following || []).includes(u.id));

  // Fallback data
  const displayName = user?.name && user.name.trim() !== '' ? user.name : 'Unknown Orbit';
  const displayBio = user?.bio && user.bio.trim() !== '' ? user.bio : 'No bio shared yet.';
  const displayPhoto = user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=000000&fontFamily=Inter&fontWeight=700`;

  const handleSave = () => {
    onUpdateProfile({
      name: editData.name.trim(),
      bio: editData.bio.trim()
    });
    setIsEditing(false);
  };

  const handleCaptureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1080, 1080, 0.82);
        onAddCapture(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          onAddCapture(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSetRole = () => {
    // Note: To keep Profile simple, we'll use a prompt for role name, 
    // but the actual color selection is primarily in AdminPanel.
    // However, if onSetRole is called from here, it will use current color.
    const role = prompt("Assign a special role to this member (e.g., Visionary, Elite, Curator):", user.role || "");
    if (role !== null && onSetRole) {
      onSetRole(user.id, role, user.roleColor);
    }
  };

  const userPosts = posts.filter(p => p.userId === user.id && (p.photoURL || p.videoURL));
  const totalCaptures = userPosts.length + (user.recentCaptures || []).length;

  const equippedFrameItem = SHOP_ITEMS.find(i => i.id === user.equippedFrame);
  const frameClass = equippedFrameItem?.frameClass || '';

  return (
    <div className={`p-6 pb-24 relative transition-all duration-500 ${isBanned ? 'bg-red-50/30' : ''}`}>
      {/* Banned Investigation Banner */}
      {isBanned && (
        <div className="absolute top-0 left-0 right-0 z-50 animate-pulse">
          <div className="bg-red-600 text-white py-2 px-4 flex items-center justify-center space-x-2 shadow-lg">
            <i className="fas fa-triangle-exclamation text-xs"></i>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Hati-hati, akun ini sedang dalam penyelidikan</span>
          </div>
        </div>
      )}

      {/* Admin King Label */}
      {isTargetAdmin && (
        <div className={`absolute top-6 right-6 z-10 ${isBanned ? 'mt-8' : ''}`}>
          <div className="bg-black text-white px-3 py-1.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] flex items-center space-x-2 animate-bounce-subtle">
            <i className="fas fa-crown text-[10px] text-yellow-400"></i>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Admin King</span>
          </div>
        </div>
      )}

      {/* Custom Role Badge with color */}
      {user.role && !isTargetAdmin && (
        <div className={`absolute top-6 right-6 z-10 ${isBanned ? 'mt-8' : ''}`}>
          <div 
            className="text-white px-3 py-1.5 rounded-xl border-2 border-black/10 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] flex items-center space-x-2"
            style={{ backgroundColor: user.roleColor || '#000000' }}
          >
            <i className="fas fa-star text-[10px]"></i>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{user.role}</span>
          </div>
        </div>
      )}

      <div className={`flex flex-col items-center mb-8 ${isBanned ? 'pt-12' : ''}`}>
        <div className="relative group mb-4">
          <div className={`w-32 h-32 rounded-full border-4 overflow-hidden shadow-xl transition-all duration-500 ${isBanned ? 'border-red-600 grayscale' : 'border-black bg-gray-100'} ${frameClass}`}>
            <img 
              src={displayPhoto} 
              alt={displayName} 
              className="w-full h-full object-cover" 
            />
          </div>
          {isMe && !isBanned && (
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <label className="cursor-pointer flex items-center justify-center w-full h-full">
                <i className="fas fa-camera text-white text-xl"></i>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const compressed = await compressImage(file, 400, 400, 0.85);
                      onUpdateProfile({ photoURL: compressed });
                    } catch {
                      const reader = new FileReader();
                      reader.onloadend = () => onUpdateProfile({ photoURL: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }
                }} />
              </label>
            </div>
          )}
        </div>
        
        {isEditing ? (
          <div className="w-full space-y-4 animate-fade-in">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Identity</label>
              <input 
                type="text" 
                value={editData.name} 
                onChange={e => setEditData({...editData, name: e.target.value})}
                className="w-full border-2 border-black p-3 rounded-xl text-center font-bold focus:outline-none"
                placeholder="Name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Vibe</label>
              <textarea 
                value={editData.bio} 
                onChange={e => setEditData({...editData, bio: e.target.value})}
                className="w-full border-2 border-black p-3 rounded-xl text-sm text-center resize-none h-24 focus:outline-none"
                placeholder="Bio"
              />
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setIsEditing(false)} className="flex-1 border-2 border-black p-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="flex-1 bg-black text-white p-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        ) : (
          <div className="text-center w-full">
            <h2 
              className={`text-3xl font-black uppercase tracking-tighter mb-2 flex items-center justify-center space-x-1 ${isBanned ? 'text-red-600' : ''}`}
              style={user.roleColor ? { color: user.roleColor } : undefined}
            >
              <span>{displayName}</span>
              {user.equippedBadge && <span className="text-xl ml-1">{user.equippedBadge}</span>}
            </h2>

            {/* Online / Offline Presence Badge */}
            <div className="flex items-center justify-center space-x-2 mb-2">
              {user.isOnline ? (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-bold text-emerald-600 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{t('status_online_active')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-neutral-100 border border-neutral-200 rounded-full text-[10px] font-medium text-neutral-500 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
                  <span>{t('status_offline')}</span>
                </span>
              )}
            </div>

            {/* Google Verified Account Badge */}
            {Boolean(user.isGoogleLinked || user.googleEmail) && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-neutral-50 border border-neutral-200 rounded-full text-[10px] font-bold text-neutral-700 mb-2 shadow-2xs">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{t('link_google_badge_verified')}</span>
                {user.googleEmail && isMe && (
                  <span className="text-neutral-400 font-normal truncate max-w-[120px]">({user.googleEmail})</span>
                )}
              </div>
            )}
            
            {/* Admin-only Email View */}
            {isAdminViewing && (
              <div className="flex items-center justify-center space-x-1.5 mb-2 group">
                <i className={`fas fa-envelope text-[10px] group-hover:text-black transition-colors ${isBanned ? 'text-red-400' : 'text-gray-400'}`}></i>
                <span className={`text-[10px] font-black uppercase tracking-widest group-hover:text-black transition-colors ${isBanned ? 'text-red-400' : 'text-gray-400'}`}>
                  {user.email || 'No email data'}
                </span>
                <i className="fas fa-shield-halved text-[8px] text-red-500 opacity-50" title="Visible only to Admin King"></i>
              </div>
            )}

            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto italic font-medium">"{displayBio}"</p>
            <div className="flex flex-col items-center space-y-3">
              <div className="flex flex-wrap justify-center gap-2">
                {isMe ? (
                  <>
                    {!isBanned && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="px-8 py-2 border-2 border-black rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all shadow-md active:scale-95"
                      >
                        {t('edit_profile')}
                      </button>
                    )}
                    <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="w-10 h-10 flex items-center justify-center border-2 border-black text-black rounded-full hover:bg-black hover:text-white transition-all shadow-md active:scale-90"
                      title={t('settings')}
                    >
                      <i className="fas fa-cog"></i>
                    </button>
                  </>
                ) : (
                  <>
                    {!isBanned && (
                      <button 
                        onClick={() => onToggleFollow(user.id)}
                        className={`px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] transition-all border-2 shadow-lg active:scale-95 ${
                          isFollowing 
                            ? 'border-black/10 text-gray-400 bg-white hover:border-red-500 hover:text-red-500' 
                            : 'border-black bg-black text-white hover:opacity-80'
                        }`}
                      >
                        {isFollowing ? t('unfollow') : t('follow_soul')}
                      </button>
                    )}
                    
                    {isAdminViewing && (
                      <>
                        <button 
                          onClick={() => onToggleAdmin && onToggleAdmin(user.id, Boolean(user.isAdmin))}
                          className={`w-10 h-10 flex items-center justify-center border-2 rounded-full transition-all shadow-md active:scale-90 ${
                            user.isAdmin 
                              ? 'border-amber-500 bg-amber-400 text-black hover:bg-amber-500' 
                              : 'border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'
                          }`}
                          title={user.isAdmin ? 'Cabut Akses Admin Vimos' : 'Beri Akses Admin Vimos'}
                        >
                          <i className={`fas ${user.isAdmin ? 'fa-shield-minus' : 'fa-crown'} text-sm`}></i>
                        </button>
                        <button 
                          onClick={handleSetRole}
                          className="w-10 h-10 flex items-center justify-center border-2 border-blue-600 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-md active:scale-90"
                          title={t('assign_role')}
                        >
                          <i className="fas fa-id-badge text-sm"></i>
                        </button>
                        <button 
                          onClick={() => onBanUser && onBanUser(user.id)}
                          className={`w-10 h-10 flex items-center justify-center border-2 rounded-full transition-all shadow-md active:scale-90 ${isBanned ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'}`}
                          title={isBanned ? t('restore_user') : t('ban_user')}
                        >
                          <i className={`fas ${isBanned ? 'fa-user-check' : 'fa-user-slash'} text-sm`}></i>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-3 gap-4 border-y-2 py-8 mb-10 rounded-2xl transition-colors ${isBanned ? 'border-red-600 bg-red-100/30' : 'border-black bg-gray-50/30'}`}>
        <div className="text-center">
          <p className={`text-2xl font-black ${isBanned ? 'text-red-600' : ''}`}>{totalCaptures}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('captures')}</p>
        </div>
        <button onClick={() => setModalType('followers')} className={`text-center group border-x ${isBanned ? 'border-red-200' : 'border-black/5'}`}>
          <p className={`text-2xl font-black group-hover:scale-110 transition-transform ${isBanned ? 'text-red-600' : ''}`}>{(user.followers || []).length}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('followers')}</p>
        </button>
        <button onClick={() => setModalType('following')} className="text-center group">
          <p className={`text-2xl font-black group-hover:scale-110 transition-transform ${isBanned ? 'text-red-600' : ''}`}>{(user.following || []).length}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('following')}</p>
        </button>
      </div>

      <div className="space-y-6">
        <div className={`flex items-center justify-between border-b-2 pb-3 ${isBanned ? 'border-red-600' : 'border-black'}`}>
          <h3 className={`font-black uppercase tracking-[0.2em] text-xs ${isBanned ? 'text-red-600' : ''}`}>Visual Echoes</h3>
          {isMe && !isBanned && (
            <label className="cursor-pointer group flex items-center space-x-2 bg-black text-white px-3 py-1 rounded-full hover:bg-black/80 transition-colors">
              <i className="fas fa-plus text-[10px]"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Add</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCaptureUpload} />
            </label>
          )}
        </div>
        
        {totalCaptures === 0 ? (
          <div className="py-20 text-center flex flex-col items-center opacity-20">
            <i className={`fas fa-camera text-4xl mb-4 ${isBanned ? 'text-red-600' : ''}`}></i>
            <p className="italic text-sm uppercase font-bold tracking-widest">No captures found</p>
          </div>
        ) : (
          <div className={`grid grid-cols-3 gap-3 ${isBanned ? 'opacity-30' : ''}`}>
            {userPosts.map((post) => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPostId(post.id)}
                className={`aspect-square bg-gray-50 border rounded-2xl overflow-hidden hover:scale-[1.05] hover:z-10 transition-all cursor-pointer shadow-sm group relative ${isBanned ? 'border-red-200' : 'border-black/5'}`}
              >
                {post.photoURL ? (
                  <img src={post.photoURL} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="Post Capture" />
                ) : post.videoURL ? (
                  <video src={post.videoURL} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                ) : null}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute top-2 right-2 text-white opacity-0 group-hover:opacity-100 drop-shadow-md">
                   {post.videoURL ? <i className="fas fa-video"></i> : <i className="fas fa-image"></i>}
                </div>
              </div>
            ))}
            {(user.recentCaptures || []).map((url, i) => (
              <div key={`legacy_${i}`} className={`aspect-square bg-gray-50 border rounded-2xl overflow-hidden hover:scale-[1.05] hover:z-10 transition-all cursor-pointer shadow-sm group relative ${isBanned ? 'border-red-200' : 'border-black/5'}`}>
                <img src={url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt={`Capture ${i}`} />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-bold px-2 py-1 bg-black/50 rounded-full">Legacy</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalType && (
        <UserListModal 
          title={modalType === 'followers' ? 'Souls Following' : 'Souls Followed'}
          users={modalType === 'followers' ? followersList : followingList}
          currentUser={currentUser}
          onClose={() => setModalType(null)}
          onToggleFollow={onToggleFollow}
          onUserClick={(uid) => {
            setModalType(null);
            onUserClick(uid);
          }}
        />
      )}

      {selectedPostId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setSelectedPostId(null)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setSelectedPostId(null)}
              className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full hover:bg-black transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
            <div className="overflow-y-auto hide-scrollbar">
              {posts.find(p => p.id === selectedPostId) && (
                <PostCard 
                  post={posts.find(p => p.id === selectedPostId)!}
                  onLike={onLike!}
                  onDislike={onDislike!}
                  onComment={onComment!}
                  onUserClick={(uid) => {
                    setSelectedPostId(null);
                    onUserClick(uid);
                  }}
                  currentUser={currentUser}
                  onFollow={onToggleFollow}
                  onTakeDownPost={onTakeDownPost}
                  onDeletePost={onDeletePost}
                  users={users}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-10">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 text-black rounded-full hover:bg-black hover:text-white transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
            
            <h3 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center">
              <i className="fas fa-cog mr-2"></i>
              {t('settings')}
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {t('language')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLanguage('id')}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      language === 'id' 
                        ? 'border-black bg-black text-white shadow-md' 
                        : 'border-gray-200 hover:border-black text-gray-600'
                    }`}
                  >
                    <span>🇮🇩</span>
                    <span>{t('indonesian')}</span>
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      language === 'en' 
                        ? 'border-black bg-black text-white shadow-md' 
                        : 'border-gray-200 hover:border-black text-gray-600'
                    }`}
                  >
                    <span>🇺🇸</span>
                    <span>{t('english')}</span>
                  </button>
                  <button
                    onClick={() => setLanguage('ja')}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      language === 'ja' 
                        ? 'border-black bg-black text-white shadow-md' 
                        : 'border-gray-200 hover:border-black text-gray-600'
                    }`}
                  >
                    <span>🇯🇵</span>
                    <span>{t('japanese')}</span>
                  </button>
                  <button
                    onClick={() => setLanguage('zh')}
                    className={`p-3 rounded-2xl border-2 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      language === 'zh' 
                        ? 'border-black bg-black text-white shadow-md' 
                        : 'border-gray-200 hover:border-black text-gray-600'
                    }`}
                  >
                    <span>🇨🇳</span>
                    <span>{t('chinese')}</span>
                  </button>
                </div>
              </div>

              {/* Linked Google Account status */}
              <div className="space-y-1.5 p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span className="text-xs font-black text-neutral-900">Akun Google</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                    <i className="fas fa-check text-[8px]"></i>
                    <span>{t('link_google_badge_verified')}</span>
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 truncate pl-6">
                  {user.googleEmail || currentUser.googleEmail || currentUser.email || 'Akun Google Terhubung'}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4 flex flex-col space-y-2">
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    onLogout();
                  }}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-2xl font-black uppercase tracking-wider text-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <i className="fas fa-sign-out-alt"></i>
                  <span>{t('logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(Profile);
