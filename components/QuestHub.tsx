import React, { useState, useEffect, useMemo } from 'react';
import { User, View } from '../types.ts';
import { 
  QuestItem, 
  QuestCategory, 
  UserQuestProgress, 
  DEFAULT_DAILY_QUESTS, 
  DEFAULT_HARD_QUESTS, 
  DEFAULT_ELITE_QUESTS 
} from '../services/questService.ts';
import { calculateUserRank, RANK_TIERS, SPECIAL_RANKS } from '../services/rankService.ts';
import { ref, onValue, set, update, push, remove } from 'firebase/database';
import { db } from '../firebase.ts';
import RankShowcaseModal from './RankShowcaseModal.tsx';
import { playChatNotificationSound } from './HeadsUpNotification.tsx';

interface QuestHubProps {
  currentUser: User;
  onClose?: () => void;
  onNavigate?: (view: View) => void;
  onUpdateUser?: (updated: Partial<User>) => void;
}

export const QuestHub: React.FC<QuestHubProps> = ({
  currentUser,
  onClose,
  onNavigate,
  onUpdateUser
}) => {
  const [mainTab, setMainTab] = useState<'quests' | 'ranks'>('quests');
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory>('daily');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'progress' | 'claimed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userProgress, setUserProgress] = useState<Record<string, UserQuestProgress>>({});
  const [customAdminQuests, setCustomAdminQuests] = useState<QuestItem[]>([]);
  const [hiddenQuestIds, setHiddenQuestIds] = useState<Record<string, boolean>>({});
  
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState<boolean>(false);
  const [deletingQuestId, setDeletingQuestId] = useState<string | null>(null);
  const [questToDelete, setQuestToDelete] = useState<QuestItem | null>(null);
  
  const [toastMessage, setToastMessage] = useState<{ text: string; xp: number } | null>(null);
  const [dailyTimeLeft, setDailyTimeLeft] = useState<string>('');
  const [showRankModal, setShowRankModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Admin Create Quest Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<QuestCategory>('admin');
  const [newActionType, setNewActionType] = useState<QuestItem['actionType']>('post');
  const [newTarget, setNewTarget] = useState<number>(1);
  const [newXp, setNewXp] = useState<number>(100);
  const [newBadge, setNewBadge] = useState<string>('');
  const [newIcon, setNewIcon] = useState<string>('fa-pen-to-square');
  const [isSubmittingQuest, setIsSubmittingQuest] = useState<boolean>(false);

  // Auto icon assignment when actionType changes
  const handleActionTypeChange = (type: QuestItem['actionType']) => {
    setNewActionType(type);
    switch (type) {
      case 'post':
        setNewIcon('fa-pen-to-square');
        if (!newTitle) setNewTitle('Upload Postingan Baru');
        break;
      case 'like':
        setNewIcon('fa-heart');
        if (!newTitle) setNewTitle('Apresiasi Like Postingan');
        break;
      case 'comment':
        setNewIcon('fa-comment-dots');
        if (!newTitle) setNewTitle('Tulis Komentar');
        break;
      case 'reply':
        setNewIcon('fa-reply');
        if (!newTitle) setNewTitle('Balas Pesan atau Komentar');
        break;
      case 'follow':
        setNewIcon('fa-user-plus');
        if (!newTitle) setNewTitle('Ikuti / Follow Teman Baru');
        break;
      case 'explore':
        setNewIcon('fa-compass');
        if (!newTitle) setNewTitle('Jelajahi Profil Komunitas');
        break;
      case 'receive_like':
        setNewIcon('fa-thumbs-up');
        if (!newTitle) setNewTitle('Dapatkan Like di Postingan');
        break;
      case 'receive_comment':
        setNewIcon('fa-comments');
        if (!newTitle) setNewTitle('Dapatkan Komentar di Postingan');
        break;
      case 'login':
        setNewIcon('fa-calendar-check');
        if (!newTitle) setNewTitle('Login Harian Vimos');
        break;
      case 'custom':
      default:
        setNewIcon('fa-fire');
        break;
    }
  };

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
      
      setDailyTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Listen to User Quest Progress, Admin Custom Quests, and Hidden Quests from Firebase
  useEffect(() => {
    if (!currentUser?.id) return;

    const progressRef = ref(db, `users/${currentUser.id}/questProgress`);
    const unsubProgress = onValue(progressRef, (snap) => {
      if (snap.exists()) {
        setUserProgress(snap.val() || {});
      } else {
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

    const hiddenQuestsRef = ref(db, 'hiddenQuests');
    const unsubHiddenQuests = onValue(hiddenQuestsRef, (snap) => {
      if (snap.exists()) {
        setHiddenQuestIds(snap.val() || {});
      } else {
        setHiddenQuestIds({});
      }
    });

    return () => {
      unsubProgress();
      unsubAdminQuests();
      unsubHiddenQuests();
    };
  }, [currentUser?.id]);

  // Handle deleting a quest (Admin action)
  const confirmDeleteQuest = async () => {
    if (!questToDelete || !currentUser?.isAdmin) return;
    setDeletingQuestId(questToDelete.id);

    try {
      if (questToDelete.createdByAdmin) {
        // Remove custom admin quest from database
        await remove(ref(db, `adminQuests/${questToDelete.id}`));
      } else {
        // Hide built-in quest for all users
        await set(ref(db, `hiddenQuests/${questToDelete.id}`), true);
      }

      setToastMessage({
        text: `Quest "${questToDelete.title}" Berhasil Dihapus!`,
        xp: 0
      });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to delete quest:', err);
    } finally {
      setDeletingQuestId(null);
      setQuestToDelete(null);
    }
  };

  // Handle claiming single quest reward
  const handleClaimReward = async (quest: QuestItem) => {
    if (!currentUser?.id || claimingQuestId || isClaimingAll) return;
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

      const userBadges = Array.isArray(currentUser.seasonBadges) ? [...currentUser.seasonBadges] : [];
      if (quest.badgeReward && !userBadges.includes(quest.badgeReward)) {
        userBadges.push(quest.badgeReward);
      }

      const userUpdates: Partial<User> = {
        seasonXp: newSeasonXp,
        lifetimeXp: newLifetimeXp,
        seasonRank: rankCalc.divisionName,
        completedQuestsCount: completedCount,
        seasonBadges: userBadges
      };

      // 2. Synchronously update parent user state so XP increases across entire app instantly
      if (onUpdateUser) {
        onUpdateUser(userUpdates);
      }

      // 3. Persist progress and XP to Firebase
      await update(ref(db, `users/${currentUser.id}/questProgress/${quest.id}`), updatedProgress);
      await update(ref(db, `users/${currentUser.id}`), userUpdates);

      // 4. Play cheerful reward sound & show visual notification
      try { playChatNotificationSound(); } catch {}

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

  // Get active quest list for current tab (excluding hidden quests)
  const allQuestsInCurrentCategory = useMemo((): QuestItem[] => {
    let sourceList: QuestItem[] = [];
    switch (selectedCategory) {
      case 'daily':
        sourceList = DEFAULT_DAILY_QUESTS;
        break;
      case 'hard':
        sourceList = DEFAULT_HARD_QUESTS;
        break;
      case 'elite':
        sourceList = DEFAULT_ELITE_QUESTS;
        break;
      case 'admin':
        sourceList = customAdminQuests;
        break;
      default:
        sourceList = DEFAULT_DAILY_QUESTS;
        break;
    }

    return sourceList.filter(q => !hiddenQuestIds[q.id]);
  }, [selectedCategory, customAdminQuests, hiddenQuestIds]);

  // Calculate all claimable quests across all non-hidden categories
  const allClaimableQuests = useMemo(() => {
    const all = [
      ...DEFAULT_DAILY_QUESTS,
      ...DEFAULT_HARD_QUESTS,
      ...DEFAULT_ELITE_QUESTS,
      ...customAdminQuests
    ].filter(q => !hiddenQuestIds[q.id]);

    return all.filter((q) => {
      const prog = userProgress[q.id];
      const count = prog?.currentCount ?? (q.actionType === 'login' ? 1 : 0);
      const isCompleted = prog?.isCompleted || count >= q.targetCount;
      const isClaimed = !!prog?.isClaimed;
      return isCompleted && !isClaimed;
    });
  }, [userProgress, customAdminQuests, hiddenQuestIds]);

  const totalClaimableXp = useMemo(() => {
    return allClaimableQuests.reduce((acc, q) => acc + (Number(q.xpReward) || 0), 0);
  }, [allClaimableQuests]);

  // Batch Claim All Claimable Quests
  const handleClaimAll = async () => {
    if (allClaimableQuests.length === 0 || isClaimingAll || !currentUser?.id) return;
    setIsClaimingAll(true);

    try {
      const totalEarnedXp = totalClaimableXp;
      const currentXp = Number(currentUser.seasonXp) || 0;
      const newSeasonXp = currentXp + totalEarnedXp;
      const newLifetimeXp = (Number(currentUser.lifetimeXp) || 0) + totalEarnedXp;
      const rankCalc = calculateUserRank(newSeasonXp);
      const completedCount = (Number(currentUser.completedQuestsCount) || 0) + allClaimableQuests.length;

      const progressUpdates: Record<string, any> = {};
      const optimisticProgressMap: Record<string, UserQuestProgress> = { ...userProgress };
      const userBadges = Array.isArray(currentUser.seasonBadges) ? [...currentUser.seasonBadges] : [];

      allClaimableQuests.forEach((q) => {
        const itemProg: UserQuestProgress = {
          questId: q.id,
          currentCount: q.targetCount,
          isCompleted: true,
          isClaimed: true,
          claimedAt: Date.now()
        };
        optimisticProgressMap[q.id] = itemProg;
        progressUpdates[`users/${currentUser.id}/questProgress/${q.id}`] = itemProg;
        if (q.badgeReward && !userBadges.includes(q.badgeReward)) {
          userBadges.push(q.badgeReward);
        }
      });

      // 1. Instant local progress update
      setUserProgress(optimisticProgressMap);

      const userUpdates: Partial<User> = {
        seasonXp: newSeasonXp,
        lifetimeXp: newLifetimeXp,
        seasonRank: rankCalc.divisionName,
        completedQuestsCount: completedCount,
        seasonBadges: userBadges
      };

      // 2. Synchronous parent update
      if (onUpdateUser) {
        onUpdateUser(userUpdates);
      }

      // 3. Batch write to Firebase
      await update(ref(db), {
        ...progressUpdates,
        [`users/${currentUser.id}/seasonXp`]: newSeasonXp,
        [`users/${currentUser.id}/lifetimeXp`]: newLifetimeXp,
        [`users/${currentUser.id}/seasonRank`]: rankCalc.divisionName,
        [`users/${currentUser.id}/completedQuestsCount`]: completedCount,
        [`users/${currentUser.id}/seasonBadges`]: userBadges
      });

      try { playChatNotificationSound(); } catch {}

      setToastMessage({
        text: `Semua ${allClaimableQuests.length} Quest Berhasil Diklaim!`,
        xp: totalEarnedXp
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Failed to claim all rewards:', err);
    } finally {
      setIsClaimingAll(false);
    }
  };

  // Filter and search active quests
  const filteredQuests = useMemo(() => {
    return allQuestsInCurrentCategory.filter((quest) => {
      // Search filter
      if (searchQuery.trim().length > 0) {
        const matchTitle = quest.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchDesc = quest.description.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchTitle && !matchDesc) return false;
      }

      // Status filter
      const prog = userProgress[quest.id];
      const count = prog?.currentCount ?? (quest.actionType === 'login' ? 1 : 0);
      const isCompleted = prog?.isCompleted || count >= quest.targetCount;
      const isClaimed = !!prog?.isClaimed;

      if (filterStatus === 'ready') {
        return isCompleted && !isClaimed;
      }
      if (filterStatus === 'progress') {
        return !isCompleted;
      }
      if (filterStatus === 'claimed') {
        return isClaimed;
      }

      return true;
    });
  }, [allQuestsInCurrentCategory, searchQuery, filterStatus, userProgress]);

  // Action dispatcher for "Kerjakan Quest"
  const handleDoQuestAction = (quest: QuestItem) => {
    if (!onNavigate) return;
    switch (quest.actionType) {
      case 'post':
        onNavigate(View.POST);
        break;
      case 'like':
      case 'comment':
      case 'receive_like':
      case 'receive_comment':
        onNavigate(View.FEED);
        break;
      case 'reply':
        onNavigate(View.CHAT);
        break;
      case 'explore':
      case 'follow':
        onNavigate(View.FEED);
        break;
      default:
        onNavigate(View.FEED);
        break;
    }
  };

  // Admin: Create Quest Submit
  const handleCreateQuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !currentUser.isAdmin) return;

    setIsSubmittingQuest(true);
    try {
      const qRef = push(ref(db, 'adminQuests'));
      const qId = qRef.key || `quest_${Date.now()}`;
      
      const newQuestItem: QuestItem = {
        id: qId,
        category: newCategory,
        title: newTitle.trim(),
        description: newDesc.trim() || 'Tantangan resmi dari pengelola Vimos.',
        targetCount: Number(newTarget) || 1,
        xpReward: Number(newXp) || 100,
        icon: newIcon || 'fa-fire',
        badgeReward: newBadge.trim() || undefined,
        actionType: newActionType,
        createdAt: Date.now(),
        createdByAdmin: true
      };

      await set(qRef, newQuestItem);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewBadge('');
      setSelectedCategory(newCategory);
      
      setToastMessage({
        text: `Quest Resmi "${newQuestItem.title}" Berhasil Diterbitkan!`,
        xp: newQuestItem.xpReward
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Failed to create admin quest:', err);
    } finally {
      setIsSubmittingQuest(false);
    }
  };

  const currentRank = calculateUserRank(Number(currentUser?.seasonXp) || 0);

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-28 text-neutral-900 animate-fade-in">
      {/* Top Header Sticky Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-all cursor-pointer"
                title="Kembali"
              >
                <i className="fas fa-arrow-left text-xs"></i>
              </button>
            )}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black shadow-xs">
                <i className="fas fa-scroll text-sm"></i>
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-neutral-950 flex items-center gap-1.5">
                  <span>Pusat Quest & Tingkat Rank</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Season 1 Hub
                  </span>
                </h1>
                <p className="text-[10px] text-neutral-500 font-medium">
                  Selesaikan misi, kumpulkan Season XP & kelola quest komunitas
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowRankModal(true)}
              className="px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold border border-neutral-300 flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <i className="fas fa-circle-info text-amber-500 text-xs"></i>
              <span className="hidden sm:inline">Info Modal</span>
            </button>

            {currentUser.isAdmin && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-1.5 rounded-full bg-black text-amber-400 hover:bg-neutral-900 text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer shadow-md border border-amber-400/40 active:scale-95"
              >
                <i className="fas fa-plus text-xs"></i>
                <span>+ Buat Quest</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[160] px-6 py-3.5 rounded-3xl bg-neutral-950 text-white border-2 border-amber-400 shadow-2xl flex items-center space-x-3.5 animate-scale-up backdrop-blur-md max-w-md w-[90%]">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-base shrink-0 shadow-md">
              <i className="fas fa-bolt"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-tight truncate">{toastMessage.text}</p>
              {toastMessage.xp > 0 && (
                <p className="text-[11px] text-amber-400 font-bold">+{toastMessage.xp.toLocaleString()} Season XP Berhasil Ditambahkan!</p>
              )}
            </div>
          </div>
        )}

        {/* HERO SECTION: USER CURRENT RANK & CLAIM ALL ACTIONS */}
        <div className="bg-gradient-to-br from-neutral-950 via-zinc-900 to-black text-white p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900/90 border-2 border-white/15 p-2 flex items-center justify-center shrink-0 shadow-lg shadow-black/60">
                <img 
                  src={currentRank.tier.badgeUrl} 
                  alt={currentRank.tier.name}
                  className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(255,255,255,0.25)]" 
                />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-amber-400 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-2xs">
                    Season 1 • Genesis
                  </span>
                  <span className="text-xs text-neutral-400 font-bold">
                    {currentUser.completedQuestsCount || 0} Quest Selesai
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-1 text-white">
                  {currentRank.divisionName}
                </h2>
                <p className="text-xs text-neutral-300 font-medium mt-0.5">
                  <strong className="text-amber-400 font-mono">{currentRank.currentXp.toLocaleString()}</strong> / {currentRank.maxXp > 100000 ? '15.000+' : currentRank.maxXp.toLocaleString()} Season XP
                </p>
              </div>
            </div>

            {/* Quick Actions & One-Tap Claim All */}
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              {allClaimableQuests.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClaimAll}
                  disabled={isClaimingAll}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-400/20 transition-all active:scale-95 flex items-center space-x-2 cursor-pointer animate-pulse"
                >
                  <i className={`fas ${isClaimingAll ? 'fa-spinner fa-spin' : 'fa-gift'} text-sm`}></i>
                  <span>
                    {isClaimingAll 
                      ? 'Mengklaim Semua...' 
                      : `Klaim Semua (${allClaimableQuests.length} Quest • +${totalClaimableXp.toLocaleString()} XP)`}
                  </span>
                </button>
              ) : (
                <div className="px-3.5 py-1.5 rounded-xl bg-white/10 text-neutral-300 text-[11px] font-bold border border-white/10 flex items-center space-x-1.5">
                  <i className="fas fa-check-circle text-emerald-400"></i>
                  <span>Semua reward selesai telah diklaim</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMainTab('ranks')}
                className="text-xs text-neutral-400 hover:text-white transition-colors font-medium flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
              >
                <span>Lihat Daftar 8 Tier Rank Lengkap</span>
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>

          {/* XP PROGRESS BAR TO NEXT TIER */}
          <div className="mt-5 space-y-1.5 relative z-10">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-neutral-400">Progres Menuju Rank Berikutnya</span>
              <span className="text-amber-400 font-mono font-black">{currentRank.progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/80 p-0.5">
              <div 
                style={{ width: `${currentRank.progressPercent}%` }}
                className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-500 shadow-sm"
              ></div>
            </div>
          </div>
        </div>

        {/* PRIMARY VIEW NAVIGATION: QUESTS VS DAFTAR RANK */}
        <div className="flex items-center space-x-2 border-b border-neutral-200 overflow-x-auto scrollbar-none text-xs font-black uppercase tracking-tight">
          <button
            type="button"
            onClick={() => setMainTab('quests')}
            className={`pb-3 px-4 transition-all flex items-center space-x-2 relative cursor-pointer ${
              mainTab === 'quests' ? 'text-neutral-900 font-black' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <i className="fas fa-scroll text-amber-500"></i>
            <span>Pusat Quest & Misi (+XP)</span>
            {allClaimableQuests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-black font-black">
                {allClaimableQuests.length} Siap
              </span>
            )}
            {mainTab === 'quests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full"></div>}
          </button>

          <button
            type="button"
            onClick={() => setMainTab('ranks')}
            className={`pb-3 px-4 transition-all flex items-center space-x-2 relative cursor-pointer ${
              mainTab === 'ranks' ? 'text-neutral-900 font-black' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <i className="fas fa-shield-halved text-cyan-500"></i>
            <span>Daftar Rank (8 Tier & Gelar)</span>
            {mainTab === 'ranks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full"></div>}
          </button>
        </div>

        {/* VIEW 1: QUESTS & MISSIONS */}
        {mainTab === 'quests' && (
          <div className="space-y-4 animate-fade-in">
            {/* CATEGORY SELECTOR TABS & COUNTDOWN TIMER */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-2 rounded-2xl border border-neutral-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('daily')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-2 ${
                    selectedCategory === 'daily' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <i className="fas fa-sun text-xs"></i>
                  <span>🟢 Daily Quest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory('hard')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-2 ${
                    selectedCategory === 'hard' 
                      ? 'bg-amber-500 text-black shadow-md' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <i className="fas fa-fire text-xs"></i>
                  <span>🟡 Hard Quest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory('elite')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-2 ${
                    selectedCategory === 'elite' 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <i className="fas fa-dragon text-xs"></i>
                  <span>🔴 Quest Elite</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory('admin')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer flex items-center space-x-2 ${
                    selectedCategory === 'admin' 
                      ? 'bg-neutral-950 text-amber-400 shadow-md border border-amber-400/40' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <i className="fas fa-crown text-xs"></i>
                  <span>👑 Event Admin</span>
                  {customAdminQuests.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[9px] bg-amber-400 text-black rounded-full font-black">
                      {customAdminQuests.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Daily Reset Timer */}
              <div className="px-3.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-neutral-600 flex items-center space-x-2 shrink-0 self-start sm:self-auto">
                <i className="fas fa-clock text-neutral-400 text-[11px]"></i>
                <span>Reset Harian: <strong className="text-neutral-950 font-mono font-bold">{dailyTimeLeft}</strong></span>
              </div>
            </div>

            {/* SEARCH & STATUS FILTER BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              {/* Status Filter Pills */}
              <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === 'all' 
                      ? 'bg-neutral-900 text-white shadow-2xs' 
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  Semua ({allQuestsInCurrentCategory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('ready')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === 'ready' 
                      ? 'bg-amber-500 text-black font-black shadow-2xs' 
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  ✨ Siap Klaim
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('progress')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === 'progress' 
                      ? 'bg-blue-600 text-white shadow-2xs' 
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  ⚡ Sedang Berjalan
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('claimed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === 'claimed' 
                      ? 'bg-emerald-600 text-white shadow-2xs' 
                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  ✅ Selesai Diklaim
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Cari quest misi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs font-medium focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            {/* QUEST CARDS GRID */}
            {filteredQuests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto text-lg">
                  <i className="fas fa-inbox"></i>
                </div>
                <h4 className="text-sm font-black text-neutral-800">Tidak Ada Quest yang Ditemukan</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Coba ganti filter status atau periksa kategori quest lainnya.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredQuests.map((quest) => {
                  const prog = userProgress[quest.id];
                  const currentVal = prog?.currentCount ?? (quest.actionType === 'login' ? 1 : 0);
                  const isCompleted = prog?.isCompleted || currentVal >= quest.targetCount;
                  const isClaimed = !!prog?.isClaimed;
                  const isReadyToClaim = isCompleted && !isClaimed;
                  const progressPct = Math.min(100, Math.round((currentVal / quest.targetCount) * 100));

                  return (
                    <div
                      key={quest.id}
                      className={`p-4 rounded-3xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                        isClaimed
                          ? 'bg-neutral-100/70 border-neutral-200 opacity-70'
                          : isReadyToClaim
                          ? 'bg-gradient-to-br from-amber-50/80 via-white to-amber-100/40 border-amber-300 shadow-md ring-2 ring-amber-400/20'
                          : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Quest Header & XP Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                              quest.category === 'daily'
                                ? 'bg-emerald-100 text-emerald-700'
                                : quest.category === 'hard'
                                ? 'bg-amber-100 text-amber-700'
                                : quest.category === 'elite'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-neutral-900 text-yellow-400'
                            }`}>
                              <i className={`fas ${quest.icon || 'fa-fire'} text-base`}></i>
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <h4 className="font-black text-xs sm:text-sm text-neutral-900 leading-tight">
                                  {quest.title}
                                </h4>
                              </div>
                              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                {quest.category.toUpperCase()} • TARGET: {quest.targetCount} ({quest.actionType})
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0 gap-1">
                            <div className="flex items-center space-x-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neutral-900 text-amber-400 shadow-2xs">
                                +{quest.xpReward} XP
                              </span>

                              {/* Admin Delete Button */}
                              {currentUser.isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setQuestToDelete(quest)}
                                  className="w-6 h-6 rounded-lg bg-red-100 hover:bg-red-600 text-red-600 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                  title="Hapus Quest Ini (Admin)"
                                >
                                  <i className="fas fa-trash-can text-[10px]"></i>
                                </button>
                              )}
                            </div>

                            {quest.badgeReward && (
                              <span className="text-[9px] font-bold text-neutral-500 mt-0.5">
                                🎖️ {quest.badgeReward}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          {quest.description}
                        </p>
                      </div>

                      {/* Quest Progress & Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-neutral-100 space-y-2.5">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                          <span className="text-neutral-500">Progres Misi</span>
                          <span className="font-mono text-neutral-900">
                            {currentVal} / {quest.targetCount} ({progressPct}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/80">
                          <div
                            style={{ width: `${progressPct}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${
                              isClaimed
                                ? 'bg-neutral-400'
                                : isReadyToClaim
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                                : 'bg-neutral-900'
                            }`}
                          ></div>
                        </div>

                        {/* Action Buttons */}
                        <div>
                          {isClaimed ? (
                            <button
                              disabled
                              className="w-full py-2 rounded-xl bg-neutral-200 text-neutral-500 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-not-allowed"
                            >
                              <i className="fas fa-check-circle text-emerald-600"></i>
                              <span>Telah Diklaim</span>
                            </button>
                          ) : isReadyToClaim ? (
                            <button
                              type="button"
                              onClick={() => handleClaimReward(quest)}
                              disabled={claimingQuestId === quest.id}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-black text-xs font-black uppercase tracking-wider shadow-md shadow-amber-400/20 transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer animate-pulse"
                            >
                              <i className={`fas ${claimingQuestId === quest.id ? 'fa-spinner fa-spin' : 'fa-bolt'} text-xs`}></i>
                              <span>{claimingQuestId === quest.id ? 'Mengklaim...' : `Klaim +${quest.xpReward} XP!`}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDoQuestAction(quest)}
                              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <i className="fas fa-play text-[10px] text-amber-400"></i>
                              <span>Kerjakan Misi</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: DAFTAR RANK (8 TIER HIERARKI & GELAR SPESIAL) */}
        {mainTab === 'ranks' && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner Guide Header */}
            <div className="p-5 rounded-3xl bg-neutral-950 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-white/10 shadow-lg">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-black">
                    8 TIER RESMI
                  </span>
                  <span className="text-xs text-neutral-400 font-bold">Hierarki Musim 1</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white mt-1">
                  Daftar Tingkat Rank & Syarat Season XP
                </h3>
                <p className="text-xs text-neutral-400 max-w-lg mt-0.5">
                  Setiap tier terdiri dari 3 Divisi Kejuaraan. Selesaikan quest setiap hari untuk menaikkan Season XP dan meningkatkan rank akun Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMainTab('quests')}
                className="px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <i className="fas fa-scroll"></i>
                <span>Kerjakan Quest (+XP)</span>
              </button>
            </div>

            {/* 8 TIERS GRID SHOWCASE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {RANK_TIERS.map((tier, idx) => {
                const isCurrentTier = currentRank.tier.id === tier.id;

                return (
                  <div 
                    key={tier.id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                      isCurrentTier
                        ? 'bg-neutral-950 text-white border-amber-400 shadow-xl ring-2 ring-amber-400/30'
                        : 'bg-white text-neutral-900 border-neutral-200/90 shadow-xs hover:border-neutral-400'
                    }`}
                  >
                    {isCurrentTier && (
                      <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow-md">
                        Rank Anda Saat Ini
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-900/90 p-1.5 flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
                          <img 
                            src={tier.badgeUrl} 
                            alt={tier.name}
                            className="w-full h-full object-contain filter drop-shadow-md" 
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-neutral-400">#{idx + 1}</span>
                            <h4 className={`font-black text-lg ${isCurrentTier ? 'text-white' : 'text-neutral-900'}`}>
                              {tier.name}
                            </h4>
                          </div>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border mt-0.5 ${
                            isCurrentTier
                              ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {tier.minXp.toLocaleString()} – {tier.maxXp > 100000 ? '15.000+' : tier.maxXp.toLocaleString()} Season XP
                          </span>
                          <p className={`text-[11px] mt-1 leading-relaxed ${isCurrentTier ? 'text-neutral-300' : 'text-neutral-500'}`}>
                            {tier.description}
                          </p>
                        </div>
                      </div>

                      {/* Division breakdown */}
                      <div className="pt-3 border-t border-neutral-100/10 flex flex-wrap gap-1.5">
                        {tier.divisions.map((div) => {
                          const isCurrentDiv = currentRank.divisionName === div.name;

                          return (
                            <span 
                              key={div.name} 
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                                isCurrentDiv
                                  ? 'bg-amber-400 text-black border-amber-300 font-black shadow-xs'
                                  : isCurrentTier
                                  ? 'bg-white/10 text-neutral-300 border-white/10'
                                  : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                              }`}
                            >
                              {div.name} ({div.minXp.toLocaleString()} XP)
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SPECIAL COMMUNITY TITLES & RANKS */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase text-neutral-900 flex items-center gap-2">
                  <span>👑 Gelar & Rank Khusus Vimos</span>
                  <span className="text-[10px] font-normal text-neutral-500 lowercase">(non-XP)</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SPECIAL_RANKS.map((sr) => (
                  <div key={sr.id} className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl ${sr.badgeBg} ${sr.textColor} flex items-center justify-center shrink-0 text-sm shadow-2xs`}>
                      <i className={`fas ${sr.icon}`}></i>
                    </div>
                    <div>
                      <h5 className="font-black text-xs text-neutral-900">{sr.name}</h5>
                      <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{sr.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFIRM DELETE QUEST (ADMIN) */}
      {questToDelete && currentUser.isAdmin && (
        <div className="fixed inset-0 z-[160] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-neutral-100 animate-scale-up">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl shadow-inner">
              <i className="fas fa-trash-can"></i>
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">Hapus Quest Ini?</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Anda akan menghapus quest <strong className="text-neutral-900 font-bold">"{questToDelete.title}"</strong>. Misi ini tidak akan lagi muncul untuk semua pengguna.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setQuestToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteQuest}
                disabled={deletingQuestId === questToDelete.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
              >
                <i className={`fas ${deletingQuestId === questToDelete.id ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                <span>{deletingQuestId === questToDelete.id ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DAFTAR LENGKAP RANK KOMUNITAS VIMOS */}
      {showRankModal && (
        <RankShowcaseModal
          currentUser={currentUser}
          onClose={() => setShowRankModal(false)}
        />
      )}

      {/* MODAL: ADMIN BUAT EVENT QUEST BARU */}
      {showCreateModal && currentUser.isAdmin && (
        <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-neutral-100 overflow-hidden animate-scale-up">
            <div className="p-5 bg-gradient-to-r from-neutral-950 to-neutral-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black">
                  <i className="fas fa-plus"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">Terbitkan Quest / Event Resmi</h3>
                  <p className="text-[10px] text-neutral-400">Pilih jenis aksi target agar progres pengguna otomatis terhitung</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <i className="fas fa-xmark text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleCreateQuestSubmit} className="p-5 overflow-y-auto space-y-4">
              {/* MANDATORY ACTION TYPE SELECTOR */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-900">
                  1. Pilih Jenis Aksi Misi (Tipe Quest) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={newActionType}
                  onChange={(e) => handleActionTypeChange(e.target.value as QuestItem['actionType'])}
                  className="w-full p-3 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-black/10 cursor-pointer shadow-xs"
                >
                  <option value="post">📸 Upload / Buat Postingan Baru (post)</option>
                  <option value="like">❤️ Beri Like pada Postingan Teman (like)</option>
                  <option value="comment">💬 Tulis Komentar di Postingan (comment)</option>
                  <option value="reply">💬 Balas Pesan / Chat / Komentar (reply)</option>
                  <option value="follow">👤 Follow / Ikuti Akun Pengguna (follow)</option>
                  <option value="explore">🔍 Jelajah / Buka Profil Pengguna (explore)</option>
                  <option value="receive_like">👍 Terima Like di Postingan Sendiri (receive_like)</option>
                  <option value="receive_comment">🗨️ Terima Komentar di Postingan Sendiri (receive_comment)</option>
                  <option value="login">📅 Login Harian Vimos (login)</option>
                  <option value="custom">⚡ Aktivitas Bebas / Event Spesial (custom)</option>
                </select>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  Sistem akan otomatis menghitung progres quest ketika pengguna melakukan aksi yang dipilih di atas.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                  2. Judul Quest <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Upload 2 Postingan Hari Ini"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                  3. Deskripsi & Panduan Misi
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Buat postingan baru di feed Vimos untuk menyelesaikan misi ini."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                    Kategori Quest
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as QuestCategory)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
                  >
                    <option value="admin">👑 Event Khusus Admin</option>
                    <option value="daily">🟢 Daily Quest</option>
                    <option value="hard">🟡 Hard Quest</option>
                    <option value="elite">🔴 Quest Elite</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                    Ikon FontAwesome
                  </label>
                  <select
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
                  >
                    <option value="fa-pen-to-square">📸 Upload Post (fa-pen-to-square)</option>
                    <option value="fa-heart">❤️ Like (fa-heart)</option>
                    <option value="fa-comment-dots">💬 Komentar (fa-comment-dots)</option>
                    <option value="fa-reply">💬 Balas Pesan (fa-reply)</option>
                    <option value="fa-user-plus">👤 Follow (fa-user-plus)</option>
                    <option value="fa-compass">🔍 Jelajah (fa-compass)</option>
                    <option value="fa-fire">🔥 Api (fa-fire)</option>
                    <option value="fa-trophy">🏆 Piala (fa-trophy)</option>
                    <option value="fa-bolt">⚡ Kilat (fa-bolt)</option>
                    <option value="fa-star">⭐ Bintang (fa-star)</option>
                    <option value="fa-crown">👑 Mahkota (fa-crown)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                    Jumlah Target Aksi
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newTarget}
                    onChange={(e) => setNewTarget(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                    Hadiah Season XP
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    required
                    value={newXp}
                    onChange={(e) => setNewXp(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                  Hadiah Badge Spesial (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Vimos Night Star Badge"
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuest}
                  className="flex-1 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-amber-400 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center space-x-1.5"
                >
                  <i className={`fas ${isSubmittingQuest ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                  <span>{isSubmittingQuest ? 'Menerbitkan...' : 'Terbitkan Quest'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestHub;
