import { User } from '../types.ts';

export interface RankTier {
  id: string;
  name: string;
  minXp: number;
  maxXp: number;
  badgeUrl: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
  divisions: {
    name: string;
    minXp: number;
    maxXp: number;
  }[];
}

export const RANK_TIERS: RankTier[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    minXp: 0,
    maxXp: 499,
    badgeUrl: 'https://images.openai.com/static-rsc-4/5ZDN6ngoTfiCJ1BwMqTEH7SFZ_sbClaP7HVjIl1bIs_0HffdiCK0P0XGbO3nbzClGXewHM6Ty_q613MYPqNn-REw1Prm07heziaCRJzjnL56ciP3JI5lnpnx3USMUdAd0GBpT5aVnumqsihB-P7XfRgSZIYzhxX79FE85LS15f5shXU8dpBDDx29qqP_GMJ4?purpose=fullsize',
    color: '#cd7f32',
    bgGradient: 'from-amber-800/20 via-yellow-900/10 to-amber-950/30',
    borderColor: 'border-amber-700/50',
    description: 'Rank awal untuk pengguna baru.',
    divisions: [
      { name: 'Bronze I', minXp: 0, maxXp: 149 },
      { name: 'Bronze II', minXp: 150, maxXp: 299 },
      { name: 'Bronze III', minXp: 300, maxXp: 499 }
    ]
  },
  {
    id: 'silver',
    name: 'Silver',
    minXp: 500,
    maxXp: 1499,
    badgeUrl: 'https://images.openai.com/static-rsc-4/VyxndReeYuz7YIitiEAjFtSts_dm-XE1AoTzAOoQhqsevvw-liIKVbaUWPKt9tyPsS7q6TPTr6yNUK5PhQ7HWGamCGOBQu63INoYgTYeehtaGqDe7dmexlCVzD0InYu-dbBmWkSnzc61pgGLFUEMoR4hqkyx0UK9iTmHGZkzYV2ovC5eolUn2hmKOJETKwhU?purpose=fullsize',
    color: '#94a3b8',
    bgGradient: 'from-slate-400/20 via-zinc-400/10 to-slate-700/30',
    borderColor: 'border-slate-400/50',
    description: 'Pengguna mulai aktif berinteraksi.',
    divisions: [
      { name: 'Silver I', minXp: 500, maxXp: 799 },
      { name: 'Silver II', minXp: 800, maxXp: 1199 },
      { name: 'Silver III', minXp: 1200, maxXp: 1499 }
    ]
  },
  {
    id: 'gold',
    name: 'Gold',
    minXp: 1500,
    maxXp: 2999,
    badgeUrl: 'https://images.openai.com/static-rsc-4/AGjFJhy1hNgjw9ggQKaTzrlRcfBragozIatmG9BMd2PRysoZkYnc7rP_MZXkWUKW3Ui1qcV_SIiwhGhgWtDuFfjaxFwjvamZlUPaWl-h2BEY8kGNtdjdmFiddroK-pBMNkF3ENR_yWIHroTYXF1GFRwG4dqp6MGgyOkGO00AK9r1JNunVNbHzVd-sEpjflpH?purpose=fullsize',
    color: '#eab308',
    bgGradient: 'from-yellow-500/20 via-amber-400/10 to-yellow-700/30',
    borderColor: 'border-yellow-500/50',
    description: 'Pengguna yang konsisten menyelesaikan quest.',
    divisions: [
      { name: 'Gold I', minXp: 1500, maxXp: 1999 },
      { name: 'Gold II', minXp: 2000, maxXp: 2499 },
      { name: 'Gold III', minXp: 2500, maxXp: 2999 }
    ]
  },
  {
    id: 'platinum',
    name: 'Platinum',
    minXp: 3000,
    maxXp: 4999,
    badgeUrl: 'https://images.openai.com/static-rsc-4/Ph-TviShgktAwnCRlhR260rGGz1awerulpnpGBkUiAcdgGQwLpczEffmi0WG5a9x1Bw4-Ug08lOpbuWvEd0VdNZaJ055qxuVut7CwYT9GDxyLfE-9-fi_CZe6kwwozqwI2IZHS-P49qV65fuvWZigcvhbq5_y29BY3XumuZzP7HgkedehFWA9QRa_oQwb8WK?purpose=fullsize',
    color: '#06b6d4',
    bgGradient: 'from-cyan-500/20 via-teal-400/10 to-cyan-700/30',
    borderColor: 'border-cyan-500/50',
    description: 'Pengguna aktif dengan progres tinggi.',
    divisions: [
      { name: 'Platinum I', minXp: 3000, maxXp: 3699 },
      { name: 'Platinum II', minXp: 3700, maxXp: 4399 },
      { name: 'Platinum III', minXp: 4400, maxXp: 4999 }
    ]
  },
  {
    id: 'diamond',
    name: 'Diamond',
    minXp: 5000,
    maxXp: 7499,
    badgeUrl: 'https://images.openai.com/static-rsc-4/lNnkGEMP1Ede-l09vSy5Uf7P_Xb21YzuSEZuqnfQ0b1_0OvWiboHvpfl5us3pFsXnxXSUiEjR9XbwMYN1CTVSitLLZ08ip3l0ZOIUi4KE9hjXjOqgDDuyjXeWExEnRU6z1dloy07dguGUgq9uqEsVtTpKtEMTVJ-QjgjBObo-ZWbshsVCrjKCVxqp1uYP5LH?purpose=fullsize',
    color: '#3b82f6',
    bgGradient: 'from-blue-500/20 via-indigo-400/10 to-blue-700/30',
    borderColor: 'border-blue-500/50',
    description: 'Pengguna dengan pencapaian season tinggi.',
    divisions: [
      { name: 'Diamond I', minXp: 5000, maxXp: 5799 },
      { name: 'Diamond II', minXp: 5800, maxXp: 6599 },
      { name: 'Diamond III', minXp: 6600, maxXp: 7499 }
    ]
  },
  {
    id: 'master',
    name: 'Master',
    minXp: 7500,
    maxXp: 9999,
    badgeUrl: 'https://images.openai.com/static-rsc-4/Ib2QUJa00cOKvaW0qJpSMT4iCMv-U3Z5kATW9uCsywgJRKUWAr27hnF79_vEDht1b1egFfMEGuh2PTDHUkIv01ALx7w2NYxLBWZw3pf0z9BbjKgjRnlRdo9qIj3NW_dM89pneBu2hSmXAjUi9cyjMBj6PAC2jKtdgBAcaRaYEHg65eOGBus73OMfayY2gbZU?purpose=fullsize',
    color: '#a855f7',
    bgGradient: 'from-purple-500/20 via-fuchsia-400/10 to-purple-700/30',
    borderColor: 'border-purple-500/50',
    description: 'Kelompok pengguna dengan progres sangat tinggi.',
    divisions: [
      { name: 'Master I', minXp: 7500, maxXp: 8299 },
      { name: 'Master II', minXp: 8300, maxXp: 9199 },
      { name: 'Master III', minXp: 9200, maxXp: 9999 }
    ]
  },
  {
    id: 'grandmaster',
    name: 'Grandmaster',
    minXp: 10000,
    maxXp: 14999,
    badgeUrl: 'https://images.openai.com/static-rsc-4/wtD7y60WUivgJuMeIi5Tz_ZuLRCwbgLYAUq5lcQUTLpR0_R6fVSY8mpLTKCEt9E8AJpIvmzkSb_9u9dXfbPQ3OkzVCHx-zfdkKzkCSaeqeza_Upfggf-Mjfp-R_lkvP0vgj3HAUZPkcRamfJp-l4w5ir59msFhVYIABORYvuNAw6KZkI_E2m6lURW7lz_nKH?purpose=fullsize',
    color: '#ef4444',
    bgGradient: 'from-red-500/20 via-rose-400/10 to-red-800/30',
    borderColor: 'border-red-500/50',
    description: 'Pengguna yang telah mencapai level tinggi.',
    divisions: [
      { name: 'Grandmaster I', minXp: 10000, maxXp: 11499 },
      { name: 'Grandmaster II', minXp: 11500, maxXp: 13199 },
      { name: 'Grandmaster III', minXp: 13200, maxXp: 14999 }
    ]
  },
  {
    id: 'mythic',
    name: 'Mythic',
    minXp: 15000,
    maxXp: 9999999,
    badgeUrl: 'https://images.openai.com/static-rsc-4/Qib81HcX41zNMwwe8d6HaxGxkzIO1gwtpV_R0k2bIDCy6BsE3DpqWJlPAaB205Bg6zs2HoE2d6Tc_mwNUj5S5tKZNi1PLtSTcppY7N35OeTGLxOQ_w2i1qs_H48prO1OgRjcHVFaBzRDXHE8O8CVJoUDJ3kc-9gYEelF_fsDoL0d4SMJAk_4fsGFx0MeYrKu?purpose=fullsize',
    color: '#f59e0b',
    bgGradient: 'from-amber-400/30 via-yellow-300/20 to-orange-600/40',
    borderColor: 'border-yellow-400',
    description: 'Tingkat tertinggi untuk pencapaian season.',
    divisions: [
      { name: 'Mythic', minXp: 15000, maxXp: 24999 },
      { name: 'Mythic Elite', minXp: 25000, maxXp: 49999 },
      { name: 'Mythic Legend', minXp: 50000, maxXp: 9999999 }
    ]
  }
];

export interface SpecialRankInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
}

export const SPECIAL_RANKS: SpecialRankInfo[] = [
  {
    id: 'verified',
    name: 'Verified',
    description: 'Verifikasi akun oleh sistem / admin resmi.',
    icon: 'fa-circle-check',
    badgeBg: 'bg-blue-500',
    textColor: 'text-white',
    borderColor: 'border-blue-400'
  },
  {
    id: 'creator',
    name: 'Vimos Creator',
    description: 'Memenuhi syarat program kreator konten aktif.',
    icon: 'fa-wand-magic-sparkles',
    badgeBg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
    textColor: 'text-white',
    borderColor: 'border-purple-400'
  },
  {
    id: 'champion',
    name: 'Season Champion',
    description: 'Juara leaderboard season resmi Vimos.',
    icon: 'fa-trophy',
    badgeBg: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    textColor: 'text-neutral-950 font-black',
    borderColor: 'border-amber-300'
  },
  {
    id: 'og_member',
    name: 'OG Member',
    description: 'Penghargaan khusus untuk anggota perintis awal.',
    icon: 'fa-gem',
    badgeBg: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    textColor: 'text-white',
    borderColor: 'border-emerald-400'
  },
  {
    id: 'staff',
    name: 'Vimos Staff',
    description: 'Diberikan kepada staf operasional resmi Vimos.',
    icon: 'fa-shield-halved',
    badgeBg: 'bg-gradient-to-r from-neutral-800 to-neutral-950',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/50'
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Khusus pengelola sistem tertinggi Vimos.',
    icon: 'fa-crown',
    badgeBg: 'bg-black',
    textColor: 'text-yellow-400 font-black',
    borderColor: 'border-yellow-400'
  }
];

export interface UserRankCalculated {
  tier: RankTier;
  divisionName: string;
  currentXp: number;
  minXp: number;
  maxXp: number;
  nextRankXp: number;
  progressPercent: number;
  isMaxRank: boolean;
}

export function calculateUserRank(xp: number = 0): UserRankCalculated {
  const safeXp = Math.max(0, Math.floor(xp || 0));

  let foundTier = RANK_TIERS[0];
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (safeXp >= RANK_TIERS[i].minXp) {
      foundTier = RANK_TIERS[i];
      break;
    }
  }

  let divisionName = foundTier.name + ' I';
  let divMinXp = foundTier.minXp;
  let divMaxXp = foundTier.maxXp;

  for (const div of foundTier.divisions) {
    if (safeXp >= div.minXp) {
      divisionName = div.name;
      divMinXp = div.minXp;
      divMaxXp = div.maxXp;
    }
  }

  const isMaxRank = foundTier.id === 'mythic' && divisionName === 'Mythic Legend';
  const span = Math.max(1, divMaxXp - divMinXp + 1);
  const earnedInDiv = Math.max(0, safeXp - divMinXp);
  const progressPercent = isMaxRank ? 100 : Math.min(100, Math.floor((earnedInDiv / span) * 100));

  return {
    tier: foundTier,
    divisionName,
    currentXp: safeXp,
    minXp: divMinXp,
    maxXp: divMaxXp,
    nextRankXp: divMaxXp + 1,
    progressPercent,
    isMaxRank
  };
}
