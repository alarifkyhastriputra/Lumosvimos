import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { 
  QuestItem, 
  DEFAULT_DAILY_QUESTS, 
  DEFAULT_HARD_QUESTS, 
  DEFAULT_ELITE_QUESTS,
  DEFAULT_ADMIN_QUESTS_TEMPLATES 
} from '../services/questService.ts';
import { SPECIAL_RANKS, calculateUserRank } from '../services/rankService.ts';
import { ref, onValue, set, get, update, remove, push } from 'firebase/database';
import { db } from '../firebase.ts';

interface AdminQuestManagerProps {
  users: User[];
  onShowToast: (text: string, type?: 'success' | 'error') => void;
}

export const AdminQuestManager: React.FC<AdminQuestManagerProps> = ({ users, onShowToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'season' | 'quests' | 'create_quest' | 'grant_rank'>('season');
  const [adminQuests, setAdminQuests] = useState<QuestItem[]>([]);
  const [seasonInfo, setSeasonInfo] = useState<{
    seasonNumber: number;
    seasonName: string;
    startedAt: number;
  }>({
    seasonNumber: 1,
    seasonName: 'Season 1: Genesis Era',
    startedAt: Date.now() - (7 * 24 * 60 * 60 * 1000)
  });

  // Season Reset Modal
  const [isResettingSeason, setIsResettingSeason] = useState<boolean>(false);
  const [newSeasonNameInput, setNewSeasonNameInput] = useState<string>('Season 2: Cyber Awakening');
  const [isProcessingReset, setIsProcessingReset] = useState<boolean>(false);

  // New Custom Admin Quest Form
  const [questTitle, setQuestTitle] = useState<string>('🔥 VIMOS NIGHT');
  const [questDesc, setQuestDesc] = useState<string>('Buat 2 postingan, raih 50 like, 20 komentar & berinteraksi dengan 30 pengguna');
  const [questTarget, setQuestTarget] = useState<number>(30);
  const [questXp, setQuestXp] = useState<number>(3000);
  const [questBadge, setQuestBadge] = useState<string>('Night Raider 🌙');
  const [questHours, setQuestHours] = useState<number>(6);
  const [questIcon, setQuestIcon] = useState<string>('fa-moon');

  // Special Rank Grant Form
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedSpecialRank, setSelectedSpecialRank] = useState<string>('creator');
  const [bonusXpInput, setBonusXpInput] = useState<number>(500);

  // 1. Subscribe to admin quests and season info in Firebase
  useEffect(() => {
    const adminQuestsRef = ref(db, 'adminQuests');
    const unsubQuests = onValue(adminQuestsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setAdminQuests(Object.values(val));
      } else {
        // Seed default template if empty
        const initialMap: Record<string, QuestItem> = {};
        DEFAULT_ADMIN_QUESTS_TEMPLATES.forEach(q => {
          initialMap[q.id] = q;
        });
        set(adminQuestsRef, initialMap);
        setAdminQuests(DEFAULT_ADMIN_QUESTS_TEMPLATES);
      }
    });

    const seasonRef = ref(db, 'seasonInfo');
    const unsubSeason = onValue(seasonRef, (snap) => {
      if (snap.exists()) {
        setSeasonInfo(snap.val());
      } else {
        const defaultSeason = {
          seasonNumber: 1,
          seasonName: 'Season 1: Genesis Era',
          startedAt: Date.now() - (7 * 24 * 60 * 60 * 1000)
        };
        set(seasonRef, defaultSeason);
        setSeasonInfo(defaultSeason);
      }
    });

    return () => {
      unsubQuests();
      unsubSeason();
    };
  }, []);

  // Handle creating new custom quest
  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questTitle.trim()) {
      onShowToast('Judul quest wajib diisi.', 'error');
      return;
    }

    try {
      const questId = `admin_quest_${Date.now()}`;
      const expiresAt = Date.now() + (questHours * 60 * 60 * 1000);

      const newQuest: QuestItem = {
        id: questId,
        category: 'admin',
        title: questTitle.trim(),
        description: questDesc.trim() || 'Tantangan khusus event komunitas Vimos',
        targetCount: Number(questTarget) || 10,
        xpReward: Number(questXp) || 1000,
        icon: questIcon || 'fa-trophy',
        badgeReward: questBadge.trim() || undefined,
        timeLimitHours: Number(questHours) || 24,
        expiresAt,
        actionType: 'custom',
        createdAt: Date.now(),
        createdByAdmin: true
      };

      await set(ref(db, `adminQuests/${questId}`), newQuest);
      onShowToast(`Quest Khusus "${newQuest.title}" berhasil diterbitkan! 🚀`, 'success');
      setActiveSubTab('quests');
    } catch (err) {
      console.error('Failed to create admin quest:', err);
      onShowToast('Gagal membuat quest.', 'error');
    }
  };

  // Handle deleting custom quest
  const handleDeleteQuest = async (questId: string) => {
    if (!window.confirm('Hapus quest khusus event ini?')) return;
    try {
      await remove(ref(db, `adminQuests/${questId}`));
      onShowToast('Quest berhasil dihapus.', 'success');
    } catch (err) {
      console.error('Failed to delete quest:', err);
      onShowToast('Gagal menghapus quest.', 'error');
    }
  };

  // Handle granting special non-XP rank or bonus XP
  const handleGrantRankOrXp = async (action: 'rank' | 'xp') => {
    if (!selectedUserId) {
      onShowToast('Pilih pengguna terlebih dahulu.', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === selectedUserId);
    if (!targetUser) return;

    try {
      if (action === 'rank') {
        await update(ref(db, `users/${selectedUserId}`), {
          specialRank: selectedSpecialRank
        });
        onShowToast(`Rank khusus "${selectedSpecialRank}" diberikan kepada ${targetUser.name}! 👑`, 'success');
      } else {
        const addedXp = Number(bonusXpInput) || 0;
        const newSeasonXp = (targetUser.seasonXp || 0) + addedXp;
        const newLifetimeXp = (targetUser.lifetimeXp || 0) + addedXp;
        const rankCalc = calculateUserRank(newSeasonXp);

        await update(ref(db, `users/${selectedUserId}`), {
          seasonXp: newSeasonXp,
          lifetimeXp: newLifetimeXp,
          seasonRank: rankCalc.divisionName
        });
        onShowToast(`+${addedXp} XP berhasil ditambahkan ke ${targetUser.name}! (Rank: ${rankCalc.divisionName})`, 'success');
      }
    } catch (err) {
      console.error('Failed to grant rank/XP:', err);
      onShowToast('Gagal memperbarui pengguna.', 'error');
    }
  };

  // Handle Season Reset Routine
  const handleExecuteSeasonReset = async () => {
    if (!newSeasonNameInput.trim()) {
      onShowToast('Nama season baru wajib diisi.', 'error');
      return;
    }

    setIsProcessingReset(true);
    try {
      // 1. Find Season Champion (Top 1 on leaderboard)
      const sortedUsers = [...users].sort((a, b) => (b.seasonXp || 0) - (a.seasonXp || 0));
      const champion = sortedUsers[0];

      // 2. Archive season for all users and reset season XP
      const updatesMap: Record<string, any> = {};
      const nextSeasonNum = (seasonInfo.seasonNumber || 1) + 1;

      for (const u of users) {
        const userSeasonXp = u.seasonXp || 0;
        const finalRankCalc = calculateUserRank(userSeasonXp);
        const isUserChampion = champion && champion.id === u.id && userSeasonXp > 0;

        const userBadges = u.seasonBadges || [];
        if (isUserChampion && !userBadges.includes('Season 1 Champion 🏆')) {
          userBadges.push(`Season ${seasonInfo.seasonNumber} Champion 🏆`);
        }

        // Save history record
        const historyRecord = {
          seasonNumber: seasonInfo.seasonNumber || 1,
          seasonName: seasonInfo.seasonName || 'Season 1',
          finalRank: finalRankCalc.divisionName,
          seasonXp: userSeasonXp,
          endedAt: Date.now(),
          trophyBadge: isUserChampion ? 'Season Champion 🏆' : finalRankCalc.tier.name
        };

        updatesMap[`users/${u.id}/seasonHistory/season_${seasonInfo.seasonNumber}`] = historyRecord;
        updatesMap[`users/${u.id}/seasonXp`] = 0;
        updatesMap[`users/${u.id}/seasonRank`] = 'Bronze I';
        updatesMap[`users/${u.id}/seasonBadges`] = userBadges;
        updatesMap[`users/${u.id}/questProgress`] = null; // Clear old quest progress
        if (isUserChampion) {
          updatesMap[`users/${u.id}/specialRank`] = 'champion';
        }
      }

      // Update Season Info Node
      const newSeasonData = {
        seasonNumber: nextSeasonNum,
        seasonName: newSeasonNameInput.trim(),
        startedAt: Date.now()
      };
      updatesMap['seasonInfo'] = newSeasonData;

      await update(ref(db), updatesMap);
      onShowToast(`Season berhasil di-reset! ${newSeasonNameInput} resmi dimulai! 🎉`, 'success');
      setIsResettingSeason(false);
    } catch (err) {
      console.error('Failed to reset season:', err);
      onShowToast('Gagal mereset season.', 'error');
    } finally {
      setIsProcessingReset(false);
    }
  };

  return (
    <div className="space-y-6 text-neutral-900 animate-fade-in">
      {/* SUB-TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 bg-neutral-100 p-2 rounded-2xl border border-neutral-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('season')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSubTab === 'season' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-200/70'
          }`}
        >
          <i className="fas fa-calendar-check text-amber-400"></i>
          <span>Kelola Season & Reset</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('quests')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSubTab === 'quests' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-200/70'
          }`}
        >
          <i className="fas fa-list-check text-emerald-400"></i>
          <span>Daftar Quest ({adminQuests.length + 27})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('create_quest')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSubTab === 'create_quest' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-200/70'
          }`}
        >
          <i className="fas fa-plus text-cyan-400"></i>
          <span>+ Buat Quest Khusus Admin</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('grant_rank')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSubTab === 'grant_rank' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-200/70'
          }`}
        >
          <i className="fas fa-award text-purple-400"></i>
          <span>Beri Rank Khusus / XP</span>
        </button>
      </div>

      {/* SUB-TAB 1: SEASON MANAGEMENT */}
      {activeSubTab === 'season' && (
        <div className="space-y-5">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-neutral-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                  Season Aktif
                </span>
                <h3 className="text-xl font-black text-neutral-900 uppercase mt-1">{seasonInfo.seasonName}</h3>
                <p className="text-xs text-neutral-500">
                  Dimulai pada: {new Date(seasonInfo.startedAt).toLocaleDateString()} • Partisipan: {users.length} Akun
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsResettingSeason(true)}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-2 cursor-pointer shrink-0"
              >
                <i className="fas fa-arrow-rotate-left"></i>
                <span>Reset Season & Nobatkan Juara</span>
              </button>
            </div>

            {/* Current Top 3 Leaders in Season */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-neutral-600">Calon Juara Season Saat Ini:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[...users].sort((a, b) => (b.seasonXp || 0) - (a.seasonXp || 0)).slice(0, 3).map((u, i) => (
                  <div key={u.id} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center space-x-3">
                    <span className="text-lg font-black text-amber-500">{i === 0 ? '👑 #1' : i === 1 ? '🥈 #2' : '🥉 #3'}</span>
                    <img src={u.photoURL || 'https://via.placeholder.com/40'} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-neutral-200" />
                    <div className="truncate flex-1">
                      <p className="font-bold text-xs truncate">{u.name}</p>
                      <p className="text-[10px] text-amber-700 font-extrabold">{(u.seasonXp || 0).toLocaleString()} Season XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: QUEST POOL OVERVIEW */}
      {activeSubTab === 'quests' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900 text-white flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm uppercase">Total Pool Quest Vimos Aktif</h4>
              <p className="text-xs text-neutral-400">10 Daily • 10 Hard • 7 Elite • {adminQuests.length} Quest Khusus Admin</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('create_quest')}
              className="px-4 py-2 bg-amber-400 text-black text-xs font-black rounded-xl cursor-pointer"
            >
              + Tambah Quest
            </button>
          </div>

          {/* Custom Admin Quests */}
          {adminQuests.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-black text-xs uppercase text-purple-700">👑 Quest Khusus Event Admin:</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {adminQuests.map((q) => (
                  <div key={q.id} className="p-4 rounded-2xl bg-white border border-purple-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center font-black">
                        <i className={`fas ${q.icon}`}></i>
                      </div>
                      <div>
                        <h5 className="font-black text-xs">{q.title}</h5>
                        <p className="text-[10px] text-neutral-500 line-clamp-1">{q.description}</p>
                        <span className="text-[9px] font-black text-purple-700">+{q.xpReward} XP {q.badgeReward ? `• Badge: ${q.badgeReward}` : ''}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuest(q.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"
                      title="Hapus Quest"
                    >
                      <i className="fas fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Quests Sample List */}
          <div className="space-y-2">
            <h5 className="font-black text-xs uppercase text-emerald-700">🟢 10 Daily Quests Bawaan:</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {DEFAULT_DAILY_QUESTS.map((q) => (
                <div key={q.id} className="p-2.5 rounded-xl bg-white border border-neutral-200 flex items-center justify-between">
                  <span className="font-bold">{q.title} (Target: {q.targetCount})</span>
                  <span className="font-black text-emerald-600">+{q.xpReward} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CREATE CUSTOM ADMIN QUEST */}
      {activeSubTab === 'create_quest' && (
        <form onSubmit={handleCreateQuest} className="p-5 sm:p-6 bg-white rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h3 className="font-black text-base uppercase">Buat Quest Khusus Admin / Event Spesial</h3>
            <p className="text-xs text-neutral-500">Tentukan target interaksi, reward XP besar, dan limited badge untuk event komunitas.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Judul Quest *</label>
              <input
                type="text"
                required
                value={questTitle}
                onChange={(e) => setQuestTitle(e.target.value)}
                placeholder="Contoh: 🔥 VIMOS NIGHT"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              />
            </div>

            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Hadiah Limited Badge (Opsional)</label>
              <input
                type="text"
                value={questBadge}
                onChange={(e) => setQuestBadge(e.target.value)}
                placeholder="Contoh: Night Raider 🌙"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-black uppercase text-neutral-700 mb-1">Deskripsi Quest *</label>
              <textarea
                rows={2}
                required
                value={questDesc}
                onChange={(e) => setQuestDesc(e.target.value)}
                placeholder="Jelaskan instruksi tantangan untuk pengguna..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-medium"
              ></textarea>
            </div>

            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Target Jumlah Interaksi</label>
              <input
                type="number"
                min={1}
                value={questTarget}
                onChange={(e) => setQuestTarget(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              />
            </div>

            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Hadiah Season XP</label>
              <input
                type="number"
                min={100}
                step={50}
                value={questXp}
                onChange={(e) => setQuestXp(parseInt(e.target.value) || 100)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              />
            </div>

            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Batas Waktu (Jam)</label>
              <input
                type="number"
                min={1}
                value={questHours}
                onChange={(e) => setQuestHours(parseInt(e.target.value) || 24)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              />
            </div>

            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Ikon FontAwesome</label>
              <select
                value={questIcon}
                onChange={(e) => setQuestIcon(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              >
                <option value="fa-moon">🌙 Bulan (fa-moon)</option>
                <option value="fa-fire">🔥 Api (fa-fire)</option>
                <option value="fa-khanda">⚔️ Pedang (fa-khanda)</option>
                <option value="fa-skull-crossbones">💀 Tengkorak (fa-skull)</option>
                <option value="fa-trophy">🏆 Trofi (fa-trophy)</option>
                <option value="fa-bolt">⚡ Petir (fa-bolt)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-3 bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase rounded-2xl shadow-md cursor-pointer"
            >
              Terbitkan Quest Event
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 4: GRANT SPECIAL RANK OR BONUS XP */}
      {activeSubTab === 'grant_rank' && (
        <div className="p-5 sm:p-6 bg-white rounded-3xl border border-neutral-200 shadow-sm space-y-5 text-xs">
          <div className="border-b border-neutral-100 pb-3">
            <h3 className="font-black text-base uppercase">Penganugerahan Rank Khusus & Bonus XP</h3>
            <p className="text-xs text-neutral-500">Berikan gelar non-XP atau suntikkan poin XP untuk reward event.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Pilih Pengguna Sasaran *</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              >
                <option value="">-- Pilih Akun Pengguna --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.seasonXp || 0} XP) {u.specialRank ? `[${u.specialRank}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Box 1: Grant Special Rank */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                <h4 className="font-black text-xs uppercase text-neutral-900">👑 Berikan Gelar Rank Khusus:</h4>
                <select
                  value={selectedSpecialRank}
                  onChange={(e) => setSelectedSpecialRank(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-300 font-bold"
                >
                  {SPECIAL_RANKS.map(sr => (
                    <option key={sr.id} value={sr.id}>
                      {sr.name} - {sr.description}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleGrantRankOrXp('rank')}
                  className="w-full py-2.5 bg-neutral-900 text-white font-black rounded-xl hover:bg-black transition-all cursor-pointer"
                >
                  Sematkan Gelar Rank Khusus
                </button>
              </div>

              {/* Box 2: Grant Bonus XP */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                <h4 className="font-black text-xs uppercase text-neutral-900">⚡ Tambahkan Bonus Season XP:</h4>
                <input
                  type="number"
                  step={100}
                  value={bonusXpInput}
                  onChange={(e) => setBonusXpInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-300 font-bold"
                  placeholder="Jumlah XP..."
                />
                <button
                  type="button"
                  onClick={() => handleGrantRankOrXp('xp')}
                  className="w-full py-2.5 bg-amber-400 text-black font-black rounded-xl hover:bg-amber-300 transition-all cursor-pointer"
                >
                  Suntikkan +{bonusXpInput} XP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET SEASON CONFIRMATION MODAL */}
      {isResettingSeason && (
        <div className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 space-y-4 animate-scale-up text-xs">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-black">
              <i className="fas fa-triangle-exclamation"></i>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-neutral-900 uppercase">Konfirmasi Reset Season</h3>
              <p className="text-neutral-500">
                Peringkat akan diarsipkan ke riwayat profil, Juara 1 akan dinobatkan sebagai <strong>Season Champion</strong>, dan Season XP semua akun akan di-reset ke 0 untuk memulai musim baru.
              </p>
            </div>

            <div>
              <label className="block font-black uppercase text-neutral-700 mb-1">Nama Season Baru</label>
              <input
                type="text"
                required
                value={newSeasonNameInput}
                onChange={(e) => setNewSeasonNameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 font-bold"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResettingSeason(false)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteSeasonReset}
                disabled={isProcessingReset}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl flex items-center justify-center space-x-1"
              >
                {isProcessingReset ? <i className="fas fa-spinner fa-spin"></i> : <span>Reset Season Sekarang</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestManager;
