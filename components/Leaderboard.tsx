import React, { useState } from 'react';
import { User, Post } from '../types.ts';
import { calculateUserRank } from '../services/rankService.ts';
import RankShowcaseModal from './RankShowcaseModal.tsx';

interface LeaderboardProps {
  users: User[];
  posts: Post[];
  currentUser?: User;
  onUserClick: (uid: string) => void;
  onUpdateUser?: (updated: Partial<User>) => void;
  onOpenQuestHub?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ 
  users, 
  posts, 
  currentUser, 
  onUserClick,
  onOpenQuestHub 
}) => {
  const [activeTab, setActiveTab] = useState<'season' | 'likes'>('season');
  const [showRankModal, setShowRankModal] = useState<boolean>(false);

  // 1. Season XP Leaderboard Ranking
  const rankedSeasonUsers = [...users]
    .filter((u) => !u.isBanned)
    .map((u) => {
      const seasonXp = Number(u.seasonXp) || 0;
      const rankInfo = calculateUserRank(seasonXp);
      return {
        ...u,
        seasonXp,
        rankInfo
      };
    })
    .sort((a, b) => b.seasonXp - a.seasonXp);

  // 2. Post Likes Ranking
  const rankedPostUsers = [...users]
    .filter((u) => !u.isBanned)
    .map((u) => {
      const userLikes = posts
        .filter((p) => p.userId === u.id)
        .reduce((acc, p) => acc + (p.likes?.length || 0), 0);
      return { ...u, score: userLikes };
    })
    .sort((a, b) => b.score - a.score);

  const currentUserRank = currentUser ? calculateUserRank(Number(currentUser.seasonXp) || 0) : null;
  const mySeasonRankPosition = currentUser 
    ? rankedSeasonUsers.findIndex(u => u.id === currentUser.id) + 1 
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
      {/* HEADER TITLE */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-black uppercase tracking-widest shadow-2xs mb-1">
          <i className="fas fa-trophy text-amber-600"></i>
          <span>Papan Peringkat Komunitas</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-900">
          Leaderboard Vimos
        </h2>
        <p className="text-xs text-neutral-500 max-w-md mx-auto">
          Lihat peringkat tertinggi anggota komunitas berdasarkan akumulasi Season XP dan apresiasi suka postingan.
        </p>
      </div>

      {/* CURRENT USER RANK SUMMARY CARD */}
      {currentUser && currentUserRank && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-neutral-950 via-zinc-900 to-black text-white border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center space-x-3.5">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900/90 border border-white/10 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
              <img 
                src={currentUserRank.tier.badgeUrl} 
                alt={currentUserRank.tier.name}
                className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(255,255,255,0.2)]" 
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Peringkat Saya</span>
                {mySeasonRankPosition && mySeasonRankPosition > 0 && (
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Posisi #{mySeasonRankPosition}
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">{currentUserRank.divisionName}</h3>
              <p className="text-xs text-neutral-300 font-medium">
                {currentUserRank.currentXp.toLocaleString()} Season XP
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenQuestHub && (
              <button
                type="button"
                onClick={onOpenQuestHub}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <i className="fas fa-scroll"></i>
                <span>Buka GUI Quest (+XP)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowRankModal(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl border border-white/15 transition-all active:scale-95 cursor-pointer"
            >
              <i className="fas fa-circle-info mr-1"></i>
              <span>Info Rank</span>
            </button>
          </div>
        </div>
      )}

      {/* LEADERBOARD TABS */}
      <div className="flex items-center space-x-2 border-b border-neutral-200 overflow-x-auto scrollbar-none text-xs font-black uppercase tracking-tight">
        <button
          type="button"
          onClick={() => setActiveTab('season')}
          className={`pb-3 px-3 transition-all flex items-center space-x-1.5 relative cursor-pointer ${
            activeTab === 'season' ? 'text-neutral-900 font-black' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <i className="fas fa-trophy text-amber-500"></i>
          <span>Peringkat Season XP</span>
          {activeTab === 'season' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full"></div>}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('likes')}
          className={`pb-3 px-3 transition-all flex items-center space-x-1.5 relative cursor-pointer ${
            activeTab === 'likes' ? 'text-neutral-900 font-black' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <i className="fas fa-heart text-red-500"></i>
          <span>Top Likes Postingan</span>
          {activeTab === 'likes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full"></div>}
        </button>
      </div>

      {/* TAB 1: SEASON XP LEADERBOARD */}
      {activeTab === 'season' && (
        <div className="space-y-3 animate-fade-in">
          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
            <span className="font-bold">Urutan Berdasarkan Season XP Terkumpul</span>
            <span className="text-[11px] text-neutral-400">Musim 1 Aktif</span>
          </div>

          <div className="space-y-2.5">
            {rankedSeasonUsers.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200">
                <p className="text-xs text-neutral-500 font-bold">Belum ada pengguna di leaderboard.</p>
              </div>
            ) : (
              rankedSeasonUsers.map((user, index) => {
                const fallbackPhoto = `https://api.dicebear.com/7.x/initials/svg?seed=${
                  encodeURIComponent(user.name || 'User')
                }&backgroundColor=000000&fontFamily=Inter&fontWeight=700`;

                const isCurrentUser = currentUser?.id === user.id;

                return (
                  <div
                    key={`season-user-${user.id}-${index}`}
                    onClick={() => onUserClick(user.id)}
                    className={`flex items-center p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer group ${
                      isCurrentUser 
                        ? 'bg-neutral-50/90 border-neutral-900 shadow-md ring-2 ring-black/5' 
                        : 'bg-white border-neutral-200/90 hover:border-neutral-400 shadow-xs'
                    }`}
                  >
                    {/* Position Badge */}
                    <div className="w-9 font-black italic text-base sm:text-lg flex items-center justify-center shrink-0">
                      {index === 0 ? (
                        <span className="text-amber-500 text-xl filter drop-shadow-xs">👑 1</span>
                      ) : index === 1 ? (
                        <span className="text-slate-400 text-lg font-bold">🥈 2</span>
                      ) : index === 2 ? (
                        <span className="text-amber-700 text-lg font-bold">🥉 3</span>
                      ) : (
                        <span className="text-neutral-400 font-extrabold text-sm">{index + 1}</span>
                      )}
                    </div>

                    {/* User Photo & Rank Tier Emblem */}
                    <div className="relative mr-3.5 shrink-0">
                      <img
                        src={user.photoURL || fallbackPhoto}
                        alt={user.name}
                        className="w-11 h-11 rounded-full object-cover border border-neutral-200 bg-neutral-100"
                      />
                      <img 
                        src={user.rankInfo.tier.badgeUrl} 
                        alt={user.rankInfo.tier.name}
                        className="w-5 h-5 object-contain absolute -bottom-1 -right-1 filter drop-shadow-xs"
                        title={user.rankInfo.divisionName}
                      />
                    </div>

                    {/* User Details */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <h4 className="font-black text-xs sm:text-sm text-neutral-900 truncate">
                          {user.name || 'Pengguna Vimos'}
                        </h4>

                        {/* Special Non-XP Rank Badge */}
                        {user.specialRank && (
                          <span className="px-2 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-black text-yellow-400 shadow-2xs">
                            {user.specialRank}
                          </span>
                        )}

                        {user.isAdmin && (
                          <span className="px-1.5 py-0.2 rounded-md text-[8px] font-black bg-neutral-900 text-white">
                            ADMIN
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {user.rankInfo.divisionName}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-semibold">
                          {(user.followers || []).length} Pengikut
                        </span>
                      </div>
                    </div>

                    {/* XP Score */}
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm sm:text-base text-neutral-900">
                        {user.seasonXp.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Season XP</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: POST LIKES RANKING */}
      {activeTab === 'likes' && (
        <div className="space-y-3 animate-fade-in">
          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
            <span className="font-bold">Urutan Berdasarkan Total Likes Postingan</span>
            <span className="text-[11px] text-neutral-400">Apresiasi Komunitas</span>
          </div>

          <div className="space-y-2.5">
            {rankedPostUsers.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-neutral-200">
                <p className="text-xs text-neutral-500 font-bold">Belum ada data likes postingan.</p>
              </div>
            ) : (
              rankedPostUsers.map((user, index) => {
                const fallbackPhoto = `https://api.dicebear.com/7.x/initials/svg?seed=${
                  encodeURIComponent(user.name || 'User')
                }&backgroundColor=000000&fontFamily=Inter&fontWeight=700`;

                return (
                  <div
                    key={`postuser-${user.id}-${index}`}
                    onClick={() => onUserClick(user.id)}
                    className="flex items-center p-3.5 sm:p-4 rounded-3xl border border-neutral-200/90 bg-white hover:border-neutral-400 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="w-8 font-black italic text-base sm:text-lg flex items-center justify-center shrink-0">
                      {index === 0 ? (
                        <span className="text-amber-500 text-xl">👑 1</span>
                      ) : index === 1 ? (
                        <span className="text-slate-400 text-lg">🥈 2</span>
                      ) : index === 2 ? (
                        <span className="text-amber-700 text-lg">🥉 3</span>
                      ) : (
                        <span className="text-neutral-400 font-bold text-sm">{index + 1}</span>
                      )}
                    </div>
                    <img
                      src={user.photoURL || fallbackPhoto}
                      className="w-10 h-10 rounded-full mr-3.5 border border-neutral-200 bg-neutral-100 object-cover"
                      alt={user.name}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-xs sm:text-sm text-neutral-900 truncate">
                        {user.name || 'Anonymous'}
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-semibold uppercase">
                        {(user.followers || []).length} Followers
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-base text-neutral-900">{user.score.toLocaleString()}</p>
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">Total Likes</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL SHOWCASE */}
      {showRankModal && (
        <RankShowcaseModal 
          currentUser={currentUser}
          onClose={() => setShowRankModal(false)}
        />
      )}
    </div>
  );
};

export default Leaderboard;
