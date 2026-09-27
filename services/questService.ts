export type QuestCategory = 'daily' | 'hard' | 'elite' | 'admin';

export interface QuestItem {
  id: string;
  category: QuestCategory;
  title: string;
  description: string;
  targetCount: number;
  xpReward: number;
  icon: string;
  badgeReward?: string;
  timeLimitHours?: number;
  expiresAt?: number;
  actionType: 'login' | 'post' | 'like' | 'comment' | 'explore' | 'follow' | 'reply' | 'receive_like' | 'receive_comment' | 'complete_quests' | 'custom';
  createdAt?: number;
  createdByAdmin?: boolean;
}

export interface UserQuestProgress {
  questId: string;
  currentCount: number;
  isCompleted: boolean;
  isClaimed: boolean;
  claimedAt?: number;
  lastUpdated?: number;
}

export const DEFAULT_DAILY_QUESTS: QuestItem[] = [
  {
    id: 'daily_login',
    category: 'daily',
    title: 'Login Harian',
    description: 'Buka dan login ke aplikasi Vimos hari ini',
    targetCount: 1,
    xpReward: 50,
    icon: 'fa-calendar-check',
    actionType: 'login'
  },
  {
    id: 'daily_first_post',
    category: 'daily',
    title: 'First Post',
    description: 'Bagikan pemikiran atau momen baru dengan membuat 1 postingan',
    targetCount: 1,
    xpReward: 75,
    icon: 'fa-pen-to-square',
    actionType: 'post'
  },
  {
    id: 'daily_like_10',
    category: 'daily',
    title: 'Apresiasi',
    description: 'Berikan apresiasi dengan menyukai (like) 10 postingan teman',
    targetCount: 10,
    xpReward: 75,
    icon: 'fa-heart',
    actionType: 'like'
  },
  {
    id: 'daily_comment_5',
    category: 'daily',
    title: 'Komentator',
    description: 'Tuliskan tanggapan di 5 postingan berbeda',
    targetCount: 5,
    xpReward: 100,
    icon: 'fa-comment-dots',
    actionType: 'comment'
  },
  {
    id: 'daily_explore_15',
    category: 'daily',
    title: 'Explorer',
    description: 'Jelajahi dan buka 15 profil pengguna di Vimos',
    targetCount: 15,
    xpReward: 75,
    icon: 'fa-compass',
    actionType: 'explore'
  },
  {
    id: 'daily_follow_5',
    category: 'daily',
    title: 'Networker',
    description: 'Perluas lingkar pertemanan dengan mem-follow 5 akun',
    targetCount: 5,
    xpReward: 100,
    icon: 'fa-user-plus',
    actionType: 'follow'
  },
  {
    id: 'daily_social_15',
    category: 'daily',
    title: 'Social Active',
    description: 'Lakukan 15 interaksi sosial aktif (like, komentar, atau follow)',
    targetCount: 15,
    xpReward: 150,
    icon: 'fa-users',
    actionType: 'custom'
  },
  {
    id: 'daily_reply_10',
    category: 'daily',
    title: 'Reply Master',
    description: 'Balas dan diskusikan 10 komentar pengguna',
    targetCount: 10,
    xpReward: 150,
    icon: 'fa-reply',
    actionType: 'reply'
  },
  {
    id: 'daily_create_2_posts',
    category: 'daily',
    title: 'Content Creator',
    description: 'Buat 2 postingan teks, foto, atau video menarik',
    targetCount: 2,
    xpReward: 150,
    icon: 'fa-photo-film',
    actionType: 'post'
  },
  {
    id: 'daily_grinder',
    category: 'daily',
    title: 'Daily Grinder',
    description: 'Selesaikan dan klaim minimal 5 quest harian lainnya hari ini',
    targetCount: 5,
    xpReward: 300,
    icon: 'fa-trophy',
    actionType: 'complete_quests'
  }
];

export const DEFAULT_HARD_QUESTS: QuestItem[] = [
  {
    id: 'hard_social_50',
    category: 'hard',
    title: 'Social Marathon',
    description: 'Lakukan total 50 interaksi sosial aktif di linimasa',
    targetCount: 50,
    xpReward: 300,
    icon: 'fa-fire-flame-curved',
    actionType: 'custom'
  },
  {
    id: 'hard_comment_30',
    category: 'hard',
    title: 'Comment Master',
    description: 'Kirimkan total 30 komentar positif di komunitas',
    targetCount: 30,
    xpReward: 350,
    icon: 'fa-comments',
    actionType: 'comment'
  },
  {
    id: 'hard_creator_5',
    category: 'hard',
    title: 'Creator Pro',
    description: 'Publikasikan 5 konten postingan berkualitas tinggi',
    targetCount: 5,
    xpReward: 400,
    icon: 'fa-palette',
    actionType: 'post'
  },
  {
    id: 'hard_popular_creator',
    category: 'hard',
    title: 'Popular Creator',
    description: 'Kumpulkan 50 suka (likes) dari pengguna pada postingan Anda',
    targetCount: 50,
    xpReward: 500,
    icon: 'fa-star',
    actionType: 'receive_like'
  },
  {
    id: 'hard_social_network_50',
    category: 'hard',
    title: 'Social Network',
    description: 'Berinteraksi dengan 50 pengguna berbeda di Vimos',
    targetCount: 50,
    xpReward: 500,
    icon: 'fa-network-wired',
    actionType: 'custom'
  },
  {
    id: 'hard_engagement_150',
    category: 'hard',
    title: 'Engagement Hunter',
    description: 'Capai total 150 engagement gabungan (like, komentar, share)',
    targetCount: 150,
    xpReward: 600,
    icon: 'fa-crosshairs',
    actionType: 'custom'
  },
  {
    id: 'hard_trending_hunter',
    category: 'hard',
    title: 'Trending Hunter',
    description: 'Raih minimal 1 postingan di papan leaderboard Vimos',
    targetCount: 1,
    xpReward: 750,
    icon: 'fa-arrow-trend-up',
    actionType: 'custom'
  },
  {
    id: 'hard_community_builder',
    category: 'hard',
    title: 'Community Builder',
    description: 'Dapatkan 25 komentar dari audiens pada postingan Anda',
    targetCount: 25,
    xpReward: 750,
    icon: 'fa-people-roof',
    actionType: 'receive_comment'
  },
  {
    id: 'hard_viral_100',
    category: 'hard',
    title: 'Viral Attempt',
    description: 'Satu postingan Anda berhasil meraih 100 suka (likes)',
    targetCount: 100,
    xpReward: 1000,
    icon: 'fa-bolt',
    actionType: 'receive_like'
  },
  {
    id: 'hard_daily_legend',
    category: 'hard',
    title: 'Daily Legend',
    description: 'Selesaikan semua tantangan kategori Hard Quest hari ini',
    targetCount: 8,
    xpReward: 1500,
    icon: 'fa-crown',
    actionType: 'complete_quests'
  }
];

export const DEFAULT_ELITE_QUESTS: QuestItem[] = [
  {
    id: 'elite_viral_star',
    category: 'elite',
    title: 'Viral Star',
    description: 'Satu postingan Anda mencapai 250 likes dari komunitas Vimos',
    targetCount: 250,
    xpReward: 2000,
    icon: 'fa-award',
    actionType: 'receive_like'
  },
  {
    id: 'elite_social_beast',
    category: 'elite',
    title: 'Social Beast',
    description: 'Lakukan total 500 interaksi sosial dalam season ini',
    targetCount: 500,
    xpReward: 2000,
    icon: 'fa-meteor',
    actionType: 'custom'
  },
  {
    id: 'elite_creator_machine',
    category: 'elite',
    title: 'Creator Machine',
    description: 'Buat 20 postingan konsisten dalam 7 hari',
    targetCount: 20,
    xpReward: 1500,
    icon: 'fa-gears',
    actionType: 'post'
  },
  {
    id: 'elite_community_legend',
    category: 'elite',
    title: 'Community Legend',
    description: 'Jalin interaksi aktif dengan 200 pengguna unik berbeda',
    targetCount: 200,
    xpReward: 2500,
    icon: 'fa-shield-heart',
    actionType: 'custom'
  },
  {
    id: 'elite_engagement_king',
    category: 'elite',
    title: 'Engagement King',
    description: 'Hasilkan total 1.000 poin engagement di Vimos',
    targetCount: 1000,
    xpReward: 3000,
    icon: 'fa-chess-king',
    actionType: 'custom'
  },
  {
    id: 'elite_quest_master',
    category: 'elite',
    title: 'Quest Master',
    description: 'Tuntaskan total 50 quest tantangan di Vimos',
    targetCount: 50,
    xpReward: 3000,
    icon: 'fa-scroll',
    actionType: 'complete_quests'
  },
  {
    id: 'elite_season_grinder',
    category: 'elite',
    title: 'Season Grinder',
    description: 'Tuntaskan 100 quest dalam satu season kompetisi',
    targetCount: 100,
    xpReward: 5000,
    icon: 'fa-infinity',
    actionType: 'complete_quests'
  }
];

export const DEFAULT_ADMIN_QUESTS_TEMPLATES: QuestItem[] = [
  {
    id: 'admin_vimos_night',
    category: 'admin',
    title: '🔥 VIMOS NIGHT',
    description: 'Buat 2 postingan, raih 50 like, 20 komentar & berinteraksi dengan 30 pengguna',
    targetCount: 30,
    xpReward: 3000,
    badgeReward: 'Night Raider 🌙',
    timeLimitHours: 6,
    icon: 'fa-moon',
    actionType: 'custom',
    createdByAdmin: true
  },
  {
    id: 'admin_rank_climb',
    category: 'admin',
    title: '⚔️ RANK CLIMB',
    description: 'Naik 2 divisi rank kompetisi dalam kurun waktu 24 jam',
    targetCount: 2,
    xpReward: 2500,
    badgeReward: 'Climber Pro ⚔️',
    timeLimitHours: 24,
    icon: 'fa-khanda',
    actionType: 'custom',
    createdByAdmin: true
  },
  {
    id: 'admin_impossible',
    category: 'admin',
    title: '💀 IMPOSSIBLE CHALLENGE',
    description: 'Selesaikan 10 tantangan Hard Quest dalam satu hari penuh',
    targetCount: 10,
    xpReward: 5000,
    badgeReward: 'The Impossible 💀',
    timeLimitHours: 24,
    icon: 'fa-skull-crossbones',
    actionType: 'complete_quests',
    createdByAdmin: true
  }
];

export const ALL_DEFAULT_QUESTS: QuestItem[] = [
  ...DEFAULT_DAILY_QUESTS,
  ...DEFAULT_HARD_QUESTS,
  ...DEFAULT_ELITE_QUESTS,
  ...DEFAULT_ADMIN_QUESTS_TEMPLATES
];
