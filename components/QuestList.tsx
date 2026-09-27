import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { 
  QuestItem, 
  QuestCategory, 
  UserQuestProgress, 
  DEFAULT_DAILY_QUESTS, 
  DEFAULT_HARD_QUESTS, 
  DEFAULT_ELITE_QUESTS 
} from '../services/questService.ts';
import { calculateUserRank } from '../services/rankService.ts';
import { ref, onValue, set, get, update } from 'firebase/database';
import { db } from '../firebase.ts';
import { playChatNotificationSound } from './HeadsUpNotification.tsx';

interface QuestListProps {
  currentUser: User;
  onUpdateUser?: (updated: Partial<User>) => void;
  onOpenRankInfo?: () => void;
}

export const QuestList: React.FC<QuestListProps> = ({ currentUser, onUpdateUser, onOpenRankInfo }) => {
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory>('daily');
  const [userProgress, setUserProgress] = useState<Record<string, UserQuestProgress>>({});
  const [customAdminQuests, setCustomAdminQuests] = useState<QuestItem[]>([]);
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; xp: number } | null>(null);
  const [dailyTimeLeft, setDailyTimeLeft] = useState<string>('');

  // 1. Calculate time remaining until midnight reset
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setDailyTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Listen to User Quest Progress and Admin Custom Quests
  useEffect(() => {
    if (!currentUser?.id) return;

    const progressRef = ref(db, `users/${currentUser.id}/questProgress`);
    const unsubProgress = onValue(progressRef, (snap) => {
      if (snap.exists()) {
        setUserProgress(snap.val() || {});
      } else {
        // Initialize basic login quest progress
        const initProg: Record<string, UserQuestProgress> = {
          daily_login: {
            questId: 'daily_login',
            currentCount: 1,
            isCompleted: true,
            isClaimed: false
          }
        };
        setUserProgress(initProg);
      }
    });

    const adminQuestsRef = ref(db, 'adminQuests');
    const unsubAdminQuests = onValue(adminQuestsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list: QuestItem[] = Object.values(val);
        setCustomAdminQuests(list);
      } else {
        setCustomAdminQuests([]);
      }
    });

    return () => {
      unsubProgress();
      unsubAdminQuests();
    };
  }, [currentUser?.id]);

  // Handle claiming quest rewards
  const handleClaimReward = async (quest: QuestItem) => {
    if (!currentUser?.id || claimingQuestId) return;
    setClaimingQuestId(quest.id);

    try {
      const rewardXp = Number(quest.xpReward) || 0;
      const currentXp = Number(currentUser.seasonXp) || 0;
      const newSeasonXp = currentXp + rewardXp;
      const newLifetimeXp = (Number(currentUser.lifetimeXp) || 0) + rewardXp;
      const rankCalc = calculateUserRank(newSeasonXp);
      const completedCount = (Number(currentUser.completedQuestsCount) || 0) + 1;

      // 1. Immediate optimistic UI update of quest progress
      const updatedProgress: UserQuestProgress = {
        questId: quest.id,
        currentCount: quest.targetCount,
        isCompleted: true,
        isClaimed: true,
        claimedAt: Date.now()
      };

      setUserProgress(prev => ({
        ...prev,
        [quest.id]: updatedProgress
      }));

      // If quest grants a special limited badge, add it to user badges
      const userBadges = Array.isArray(currentUser.seasonBadges) ? [...currentUser.seasonBadges] : [];
      if (quest.badgeReward && !userBadges.includes(quest.badgeReward)) {
        userBadges.push(quest.badgeReward);
      }

      // Update User Season XP & Rank
      const userUpdates: Partial<User> = {
        seasonXp: newSeasonXp,
        lifetimeXp: newLifetimeXp,
        seasonRank: rankCalc.divisionName,
        completedQuestsCount: completedCount,
        seasonBadges: userBadges
      };

      // 2. Synchronously update parent user state
      if (onUpdateUser) {
        onUpdateUser(userUpdates);
      }

      // 3. Persist to Firebase Realtime Database
      await update(ref(db, `users/${currentUser.id}/questProgress/${quest.id}`), updatedProgress);
      await update(ref(db, `users/${currentUser.id}`), userUpdates);

      try { playChatNotificationSound(); } catch {}

      // Show toast celebration
      setToastMessage({
        text: `Hadiah Quest "${quest.title}" Berhasil Diklaim!`,
        xp: rewardXp
      });
      setTimeout(() => setToastMessage(null), 3500);

    } catch (err) {
      console.error('Failed to claim quest reward:', err);
    } finally {
      setClaimingQuestId(null);
    }
  };

  // Get active quest list for current tab
  const getActiveQuests = (): QuestItem[] => {
    switch (selectedCategory) {
      case 'daily':
        return DEFAULT_DAILY_QUESTS;
      case 'hard':
        return DEFAULT_HARD_QUESTS;
      case 'elite':
        return DEFAULT_ELITE_QUESTS;
      case 'admin':
        return customAdminQuests.length > 0 ? customAdminQuests : [];
      default:
        return DEFAULT_DAILY_QUESTS;
    }
  };

  const activeQuests = getActiveQuests();
  const currentRank = calculateUserRank(currentUser?.seasonXp || 0);

  // Calculate completed count in selected tab
  const completedInTab = activeQuests.filter(q => {
    const prog = userProgress[q.id];
    return prog && (prog.currentCount >= q.targetCount || prog.isCompleted);
  }).length;

  return (
    <div className="space-y-6">
      {/* Toast Reward Animation */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[160] px-6 py-3.5 rounded-3xl bg-neutral-950 text-white border-2 border-amber-400 shadow-2xl flex items-center space-x-3 animate-scale-up backdrop-blur-md">
          <div className="w-9 h-9 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-sm">
            <i className="fas fa-bolt"></i>
          </div>
          <div>
            <p className="text-xs font-black tracking-tight">{toastMessage.text}</p>
            <p className="text-[11px] text-amber-400 font-bold">+{toastMessage.xp.toLocaleString()} Season XP Ditambahkan!</p>
          </div>
        </div>
      )}

      {/* TOP USER PROGRESS HERO BANNER */}
      <div className="bg-gradient-to-br from-neutral-950 via-zinc-900 to-black text-white p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900 border-2 border-white/10 p-2 flex items-center justify-center shrink-0 shadow-lg shadow-black/40">
              <img 
                src={currentRank.tier.badgeUrl} 
                alt={currentRank.tier.name}
                className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(255,255,255,0.2)]" 
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-amber-400 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Season 1 • Genesis
                </span>
                <span className="text-xs text-neutral-400 font-bold">
                  {currentUser.completedQuestsCount || 0} Quest Selesai
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-0.5 text-white">
                {currentRank.divisionName}
              </h3>
              <p className="text-xs text-neutral-300 font-medium">
                {currentRank.currentXp.toLocaleString()} / {currentRank.maxXp > 100000 ? '15.000+' : currentRank.maxXp.toLocaleString()} Season XP
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenRankInfo && (
              <button
                type="button"
                onClick={onOpenRankInfo}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-2xl border border-white/15 transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <i className="fas fa-trophy text-amber-400"></i>
                <span>Lihat Semua Rank</span>
              </button>
            )}
          </div>
        </div>

        {/* PROGRESS BAR TO NEXT RANK */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-neutral-400">Progres Menuju Rank Berikutnya</span>
            <span className="text-amber-400 font-black">{currentRank.progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
            <div 
              style={{ width: `${currentRank.progressPercent}%` }}
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-500 shadow-sm"
            ></div>
          </div>
        </div>
      </div>

      {/* QUEST CATEGORY TABS & RESET COUNTDOWN */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-neutral-100 p-2 rounded-2xl border border-neutral-200/80">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('daily')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-1.5 ${
              selectedCategory === 'daily' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-neutral-700 hover:bg-neutral-200/70'
            }`}
          >
            <span>🟢 Daily Quest</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-black/20 rounded-full">10</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('hard')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-1.5 ${
              selectedCategory === 'hard' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'text-neutral-700 hover:bg-neutral-200/70'
            }`}
          >
            <span>🟡 Hard Quest</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-black/20 rounded-full">10</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('elite')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-1.5 ${
              selectedCategory === 'elite' 
                ? 'bg-red-600 text-white shadow-md' 
                : 'text-neutral-700 hover:bg-neutral-200/70'
            }`}
          >
            <span>🔴 Quest Elite</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-black/20 rounded-full">7</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('admin')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-1.5 ${
              selectedCategory === 'admin' 
                ? 'bg-neutral-950 text-amber-400 shadow-md border border-amber-400/40' 
                : 'text-neutral-700 hover:bg-neutral-200/70'
            }`}
          >
            <span>👑 Event Khusus</span>
            {customAdminQuests.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] bg-amber-400 text-black rounded-full font-black">
                {customAdminQuests.length}
              </span>
            )}
          </button>
        </div>

        {/* Daily Reset Timer Indicator */}
        <div className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-600 flex items-center space-x-2 shrink-0 self-start sm:self-auto">
          <i className="fas fa-clock text-neutral-400 text-[11px]"></i>
          <span>Reset Harian: <strong className="text-neutral-900 font-mono">{dailyTimeLeft}</strong></span>
        </div>
      </div>

      {/* TAB SUMMARY BANNER */}
      <div className="flex items-center justify-between px-2 text-xs font-bold text-neutral-500">
        <span>
          Menampilkan {activeQuests.length} tantangan • {completedInTab} selesai
        </span>
        <span className="text-[11px] text-neutral-400 font-semibold">
          XP dihitung dari interaksi valid
        </span>
      </div>

      {/* QUEST CARDS GRID */}
      {activeQuests.length === 0 ? (
        <div className="text-center py-12 px-4 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
          <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center mx-auto mb-3 text-neutral-400">
            <i className="fas fa-calendar-xmark text-xl"></i>
          </div>
          <h4 className="text-xs font-black text-neutral-800 uppercase">Belum Ada Event Khusus Aktif</h4>
          <p className="text-[11px] text-neutral-400 max-w-xs mx-auto mt-1">
            Admin belum meluncurkan tantangan event berbatas waktu saat ini. Cek kembali nanti!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {activeQuests.map((quest) => {
            const progress = userProgress[quest.id] || {
              questId: quest.id,
              currentCount: quest.actionType === 'login' ? 1 : 0,
              isCompleted: quest.actionType === 'login',
              isClaimed: false
            };

            const currentVal = Math.min(quest.targetCount, progress.currentCount || (progress.isCompleted ? quest.targetCount : 0));
            const isReadyToClaim = currentVal >= quest.targetCount && !progress.isClaimed;
            const isClaimed = !!progress.isClaimed;
            const percent = Math.min(100, Math.floor((currentVal / quest.targetCount) * 100));

            return (
              <div
                key={quest.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden ${
                  isClaimed 
                    ? 'bg-neutral-50/70 border-neutral-200/60 opacity-70' 
                    : isReadyToClaim
                      ? 'bg-white border-amber-400 shadow-md ring-2 ring-amber-400/20'
                      : 'bg-white border-neutral-200/90 hover:border-neutral-300 shadow-xs'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                        quest.category === 'daily'
                          ? 'bg-emerald-100 text-emerald-800'
                          : quest.category === 'hard'
                            ? 'bg-amber-100 text-amber-900'
                            : quest.category === 'elite'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-purple-100 text-purple-900'
                      }`}>
                        <i className={`fas ${quest.icon}`}></i>
                      </div>

                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-black text-sm text-neutral-900">{quest.title}</h4>
                          {quest.badgeReward && (
                            <span className="px-2 py-0.2 rounded-full text-[8px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">
                              🎁 {quest.badgeReward}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {quest.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-950 border border-amber-300 flex items-center space-x-1 shadow-2xs">
                        <i className="fas fa-bolt text-amber-500 text-[10px]"></i>
                        <span>+{quest.xpReward} XP</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Actions */}
                <div className="space-y-2 pt-1 border-t border-neutral-100">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-neutral-500">
                      Progres: <strong className="text-neutral-900">{currentVal}</strong> / {quest.targetCount}
                    </span>
                    <span className="text-neutral-400">{percent}%</span>
                  </div>

                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/60">
                    <div 
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        isClaimed
                          ? 'bg-neutral-400'
                          : isReadyToClaim
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-neutral-900'
                      }`}
                    ></div>
                  </div>

                  {/* Claim Button */}
                  <div className="pt-1">
                    {isClaimed ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 rounded-xl bg-neutral-100 text-neutral-400 text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-not-allowed"
                      >
                        <i className="fas fa-check"></i>
                        <span>Hadiah Sudah Diklaim</span>
                      </button>
                    ) : isReadyToClaim ? (
                      <button
                        type="button"
                        onClick={() => handleClaimReward(quest)}
                        disabled={claimingQuestId === quest.id}
                        className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer animate-bounce-subtle"
                      >
                        <i className={`fas ${claimingQuestId === quest.id ? 'fa-spinner fa-spin' : 'fa-gift'}`}></i>
                        <span>{claimingQuestId === quest.id ? 'Mengklaim...' : `Klaim +${quest.xpReward} XP!`}</span>
                      </button>
                    ) : (
                      <div className="text-center py-1 text-[11px] text-neutral-400 font-semibold">
                        Selesaikan aksi untuk mengklaim XP
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestList;
