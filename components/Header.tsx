
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { useLanguage } from '../LanguageContext';

interface HeaderProps {
  onSearch: (term: string) => void;
  users: User[];
  onUserClick: (userId: string) => void;
  onLeaderboardClick: () => void;
  onShopClick?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onLiveClick?: () => void;
  activeLiveCount?: number;
  userCoins?: number;
}

const Header: React.FC<HeaderProps> = ({ 
  onSearch, 
  users, 
  onUserClick, 
  onLeaderboardClick, 
  onShopClick,
  isAdmin, 
  onAdminClick,
  onLiveClick,
  activeLiveCount = 0,
  userCoins = 500
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length > 0) {
      const filtered = users.filter(u => 
        (u.name || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setResults(filtered);
    } else {
      setResults([]);
    }
    onSearch(query);
  }, [query, users, onSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (uid: string) => {
    onUserClick(uid);
    setQuery('');
    setResults([]);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-black/10 px-4 py-3 backdrop-blur-md bg-white/80">
      <div className="flex items-center w-full space-x-2">
        <button 
          onClick={onLeaderboardClick}
          className="w-9 h-9 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white transition-all active:scale-90"
          title="Elite Rankings"
        >
          <i className="fas fa-medal text-xs"></i>
        </button>

        {onShopClick && (
          <button 
            onClick={onShopClick}
            className="h-9 px-3 flex items-center justify-center space-x-1 border-2 border-black bg-yellow-400 hover:bg-yellow-300 text-black rounded-full transition-all active:scale-90 shadow-sm"
            title={t('shop')}
          >
            <i className="fas fa-store text-xs"></i>
            <span className="text-[10px] font-black uppercase">{t('shop')}</span>
          </button>
        )}

        {isAdmin && (
          <button 
            onClick={onAdminClick}
            className="w-9 h-9 flex items-center justify-center border-2 border-black bg-black text-white rounded-full hover:bg-white hover:text-black transition-all active:scale-90"
            title={t('admin')}
          >
            <i className="fas fa-shield-halved text-xs"></i>
          </button>
        )}
        
        <div className="flex-1 relative" ref={dropdownRef}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <i className="fas fa-search text-xs"></i>
          </span>
          <input
            type="search"
            value={query}
            placeholder={t('search')}
            className="w-full bg-gray-50 border border-black/5 rounded-full pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-black transition-all"
            onChange={(e) => setQuery(e.target.value)}
          />

          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-black rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50">
              <div className="p-2 border-b border-black/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">{t('found_shadows')}</p>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {results.map(user => {
                  const fallbackPhoto = `https://api.dicebear.com/7.x/initials/svg?seed=${user.name || 'Shadow'}&backgroundColor=000000&fontFamily=Inter&fontWeight=700`;
                  return (
                    <div 
                      key={user.id}
                      onClick={() => handleSelect(user.id)}
                      className="flex items-center p-3 hover:bg-black hover:text-white transition-all cursor-pointer group"
                    >
                      <img 
                        src={user.photoURL || fallbackPhoto} 
                        alt={user.name} 
                        className="w-10 h-10 rounded-full border border-black/10 mr-3 group-hover:border-white/20 object-cover" 
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate uppercase tracking-tight">{user.name || 'Unknown'}</p>
                        <p className="text-[9px] font-medium opacity-50 truncate">{(user.followers || []).length} Following</p>
                      </div>
                      <i className="fas fa-arrow-right text-xs opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"></i>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center">
          <h1 className="text-lg font-black tracking-tighter ml-1">VIMOS</h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
