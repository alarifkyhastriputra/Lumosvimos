import React from 'react';
import { RANK_TIERS, SPECIAL_RANKS, calculateUserRank } from '../services/rankService.ts';
import { User } from '../types.ts';

interface RankShowcaseModalProps {
  currentUser?: User | null;
  onClose: () => void;
}

export const RankShowcaseModal: React.FC<RankShowcaseModalProps> = ({ currentUser, onClose }) => {
  const currentRankInfo = currentUser ? calculateUserRank(currentUser.seasonXp || 0) : null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-neutral-100 overflow-hidden animate-scale-up">
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-neutral-950 via-zinc-900 to-black text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-black flex items-center justify-center font-black text-lg shadow-lg shadow-amber-400/20">
              <i className="fas fa-trophy text-neutral-950"></i>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">Daftar Rank Komunitas Vimos</h3>
                <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-400/30">
                  Official Tier
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Kumpulkan XP dari quest & interaksi valid untuk menaikkan divisi rank Anda.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <i className="fas fa-xmark text-sm"></i>
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* User Current Rank Summary Card */}
          {currentRankInfo && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-950 text-white border border-neutral-700 shadow-md flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <img 
                  src={currentRankInfo.tier.badgeUrl} 
                  alt={currentRankInfo.tier.name}
                  className="w-14 h-14 object-contain shrink-0 filter drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Rank Anda Saat Ini</span>
                  <h4 className="text-base sm:text-lg font-black">{currentRankInfo.divisionName}</h4>
                  <p className="text-xs text-neutral-300 mt-0.5 font-medium">
                    {currentRankInfo.currentXp.toLocaleString()} Season XP
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Target Berikutnya</span>
                <span className="text-xs sm:text-sm font-black text-amber-400">
                  {currentRankInfo.isMaxRank ? 'Puncak Mythic' : `${currentRankInfo.nextRankXp.toLocaleString()} XP`}
                </span>
              </div>
            </div>
          )}

          {/* SECTION 1: 8 TIER LEVELS */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-neutral-100 pb-2">
              <i className="fas fa-shield-halved text-amber-500 text-sm"></i>
              <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 tracking-wider">
                Tingkatan Rank Season (Berdasarkan XP)
              </h4>
            </div>

            <div className="space-y-3.5">
              {RANK_TIERS.map((tier, idx) => {
                const isCurrentTier = currentRankInfo?.tier.id === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrentTier 
                        ? 'bg-neutral-50/90 border-neutral-900 shadow-md ring-2 ring-black/5' 
                        : 'bg-white border-neutral-200/80 hover:border-neutral-300 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-14 h-14 rounded-2xl bg-neutral-950 p-1.5 flex items-center justify-center shrink-0 border border-neutral-800 shadow-inner">
                          <img 
                            src={tier.badgeUrl} 
                            alt={tier.name}
                            className="w-full h-full object-contain filter drop-shadow-sm" 
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-neutral-400">
                              {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][idx]}.
                            </span>
                            <h5 className="font-black text-base text-neutral-900">{tier.name}</h5>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-neutral-100 text-neutral-800 border border-neutral-200">
                              {tier.minXp.toLocaleString()} – {tier.maxXp > 100000 ? '15.000+' : tier.maxXp.toLocaleString()} XP
                            </span>
                            {isCurrentTier && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-black text-white">
                                Posisi Anda
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-1">{tier.description}</p>
                        </div>
                      </div>

                      {/* Division Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                        {tier.divisions.map((div) => {
                          const isCurrentDiv = currentRankInfo?.divisionName === div.name;
                          return (
                            <span
                              key={div.name}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                                isCurrentDiv
                                  ? 'bg-neutral-950 text-amber-400 border-neutral-900 font-black shadow-xs'
                                  : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                              }`}
                            >
                              {div.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: SPECIAL NON-XP RANKS */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2 border-b border-neutral-100 pb-2">
              <i className="fas fa-crown text-amber-500 text-sm"></i>
              <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 tracking-wider">
                👑 Rank Khusus Vimos (Gelar Kehormatan)
              </h4>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Rank khusus berikut tidak bisa diperoleh hanya dengan mengumpulkan XP, melainkan melalui verifikasi, pencapaian kompetisi season, kontribusi konten, atau peran staf pengelola.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SPECIAL_RANKS.map((sr) => (
                <div 
                  key={sr.id}
                  className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-start space-x-3"
                >
                  <div className={`w-8 h-8 rounded-xl ${sr.badgeBg} ${sr.textColor} flex items-center justify-center shrink-0 shadow-xs text-xs`}>
                    <i className={`fas ${sr.icon}`}></i>
                  </div>
                  <div>
                    <h5 className="font-black text-xs text-neutral-900">{sr.name}</h5>
                    <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{sr.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: RULES & ANTI-SPAM NOTICE */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-2">
            <div className="flex items-center space-x-2 font-black text-amber-900">
              <i className="fas fa-shield-halved text-amber-600"></i>
              <span>Aturan Integritas & Anti-Farming XP</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              XP hanya diberikan untuk interaksi nyata yang valid. Tindakan spam, botting, self-farming, atau kecurangan berulang akan dikenakan sanksi penalti pengurangan XP dan pencabutan riwayat season.
            </p>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-2xl transition-all active:scale-95 cursor-pointer shadow-md"
          >
            Tutup Informasi Rank
          </button>
        </div>
      </div>
    </div>
  );
};

export default RankShowcaseModal;
