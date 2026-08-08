
import React from 'react';
import { View } from '../types';
import { useLanguage } from '../LanguageContext';

interface NavbarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  unreadCount?: number;
}

const Navbar: React.FC<NavbarProps> = ({ activeView, onViewChange, unreadCount = 0 }) => {
  const { t } = useLanguage();

  const tabs = [
    { id: View.FEED, icon: 'fa-home', label: t('home') },
    { id: View.LIVESTREAM, icon: 'fa-tower-broadcast', label: 'Live', isLive: true },
    { id: View.REELS, icon: 'fa-film', label: t('reels') },
    { id: View.SHOP, icon: 'fa-store', label: t('shop') },
    { id: View.POST, icon: 'fa-plus-circle', label: t('create') },
    { id: View.NOTIFICATIONS, icon: 'fa-bell', label: t('alerts'), count: unreadCount },
    { id: View.CHAT, icon: 'fa-comments', label: t('inbox') },
    { id: View.PROFILE, icon: 'fa-user', label: t('you') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/10 shadow-lg max-w-xl mx-auto flex h-16 px-1 z-40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          className={`flex-1 flex flex-col items-center justify-center transition-all relative ${
            activeView === tab.id
              ? tab.isLive ? 'text-red-600 scale-105' : 'text-black scale-105'
              : tab.isLive ? 'text-red-500/70 hover:text-red-600' : 'text-gray-300'
          }`}
        >
          <div className="relative">
            <i className={`fas ${tab.icon} text-lg mb-0.5 ${tab.isLive ? 'animate-pulse' : ''}`}></i>
            {tab.count && tab.count > 0 ? (
              <span className="absolute -top-1 -right-2 bg-black text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white">
                {tab.count > 9 ? '9+' : tab.count}
              </span>
            ) : null}
            {tab.isLive && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            )}
          </div>
          <span className={`text-[8px] font-black uppercase tracking-widest ${tab.isLive ? 'text-red-600' : ''}`}>{tab.label}</span>
          {activeView === tab.id && (
             <div className={`w-1 h-1 rounded-full mt-1 ${tab.isLive ? 'bg-red-600' : 'bg-black'}`}></div>
          )}
        </button>
      ))}
    </nav>
  );
};

export default Navbar;
