import React, { useState, useEffect, useRef } from 'react';
import { User, AdConfig, CustomAdCampaign } from '../types.ts';
import { ref, onValue, set, get, update, remove, push } from 'firebase/database';
import { db } from '../firebase.ts';
import { compressImage } from '../services/imageCompressor.ts';

interface AdsManagerProps {
  currentUser: User;
  onClose?: () => void;
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  isEnabled: true,
  scriptUrl: 'https://pl31515732.profitableratecpmnetwork.com/f2023cc3c42361e2d4fcb5a4601d7c18/invoke.js',
  containerId: 'container-f2023cc3c42361e2d4fcb5a4601d7c18',
  customSnippet: `<script async="async" data-cfasync="false" src="https://pl31515732.profitableratecpmnetwork.com/f2023cc3c42361e2d4fcb5a4601d7c18/invoke.js"></script>\n<div id="container-f2023cc3c42361e2d4fcb5a4601d7c18"></div>`,
  feedFrequency: 5,
  showInSinglePost: true,
  showInShop: true,
  showInLeaderboard: true,
  showStickyBanner: false,
  sponsorBadgeText: 'Sponsor Rekomendasi',
  executionMode: 'iframe',
  customAds: {}
};

export const AdsManager: React.FC<AdsManagerProps> = ({ currentUser, onClose }) => {
  const [adConfig, setAdConfig] = useState<AdConfig>(DEFAULT_AD_CONFIG);
  const [activeTab, setActiveTab] = useState<'network' | 'sandbox' | 'placements' | 'campaigns' | 'analytics'>('network');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [sandboxRefreshKey, setSandboxRefreshKey] = useState<number>(0);
  const [adBlockStatus, setAdBlockStatus] = useState<'checking' | 'detected' | 'clear'>('checking');
  
  // Custom Campaign Modal / Form State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState<boolean>(false);
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [campaignSponsor, setCampaignSponsor] = useState<string>('');
  const [campaignDesc, setCampaignDesc] = useState<string>('');
  const [campaignBanner, setCampaignBanner] = useState<string>('');
  const [campaignTargetUrl, setCampaignTargetUrl] = useState<string>('');
  const [campaignCtaText, setCampaignCtaText] = useState<string>('Kunjungi Website');
  const [isUploadingBanner, setIsUploadingBanner] = useState<boolean>(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Fetch & Subscribe to Ad Configuration from Firebase RTDB
  useEffect(() => {
    const adConfigRef = ref(db, 'adConfig');
    
    // Fast initial fetch
    get(adConfigRef).then((snap) => {
      if (snap.exists()) {
        setAdConfig(prev => ({ ...prev, ...snap.val() }));
      }
    }).catch(() => {});

    // Real-time listener
    const unsub = onValue(adConfigRef, (snap) => {
      if (snap.exists()) {
        setAdConfig(prev => ({ ...prev, ...snap.val() }));
      }
    });

    return () => unsub();
  }, []);

  // 2. AdBlock Detection Routine
  const runAdBlockCheck = () => {
    setAdBlockStatus('checking');
    try {
      const testAd = document.createElement('div');
      testAd.innerHTML = '&nbsp;';
      testAd.className = 'adsbox pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads';
      testAd.style.position = 'absolute';
      testAd.style.top = '-9999px';
      testAd.style.left = '-9999px';
      testAd.style.width = '1px';
      testAd.style.height = '1px';
      document.body.appendChild(testAd);

      setTimeout(() => {
        let isBlocked = false;
        if (testAd.offsetHeight === 0 || testAd.offsetWidth === 0 || window.getComputedStyle(testAd).display === 'none') {
          isBlocked = true;
        }
        
        // Also test network fetch ping if blocked
        fetch('https://pl31515732.profitableratecpmnetwork.com/f2023cc3c42361e2d4fcb5a4601d7c18/invoke.js', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store'
        }).then(() => {
          setAdBlockStatus(isBlocked ? 'detected' : 'clear');
        }).catch(() => {
          setAdBlockStatus('detected');
        }).finally(() => {
          if (testAd.parentNode) {
            testAd.parentNode.removeChild(testAd);
          }
        });
      }, 350);
    } catch {
      setAdBlockStatus('detected');
    }
  };

  useEffect(() => {
    runAdBlockCheck();
  }, []);

  // Save changes to Firebase RTDB
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const payload: AdConfig = {
        ...adConfig,
        lastUpdated: Date.now()
      };
      await set(ref(db, 'adConfig'), payload);
      showToast('Konfigurasi Iklan berhasil disimpan & disinkronkan! ✅', 'success');
      setSandboxRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Failed to save ad config:', err);
      showToast('Gagal menyimpan konfigurasi iklan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default configuration
  const handleResetDefaults = async () => {
    if (!window.confirm('Kembalikan konfigurasi iklan ke pengaturan standar bawaan?')) return;
    setIsSaving(true);
    try {
      await set(ref(db, 'adConfig'), DEFAULT_AD_CONFIG);
      setAdConfig(DEFAULT_AD_CONFIG);
      showToast('Pengaturan iklan dikembalikan ke default.', 'info');
      setSandboxRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Failed to reset ad config:', err);
      showToast('Gagal mereset pengaturan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload Custom Ad Banner
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const compressed = await compressImage(file, 900, 500, 0.8);
      setCampaignBanner(compressed);
      showToast('Banner iklan berhasil diunggah & dikompres!', 'success');
    } catch (err) {
      console.error('Failed to compress banner:', err);
      showToast('Gagal memproses gambar banner.', 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // Create or Update Custom Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim() || !campaignBanner) {
      showToast('Harap isi judul dan upload gambar banner iklan.', 'error');
      return;
    }

    try {
      const campaignId = `ad_${Date.now()}`;
      const newCampaign: CustomAdCampaign = {
        id: campaignId,
        title: campaignTitle.trim(),
        sponsorName: campaignSponsor.trim() || 'Sponsor Partner',
        description: campaignDesc.trim(),
        bannerImage: campaignBanner,
        targetUrl: campaignTargetUrl.trim() || '#',
        ctaText: campaignCtaText.trim() || 'Kunjungi Sekarang',
        isActive: true,
        impressions: 0,
        clicks: 0,
        createdAt: Date.now()
      };

      await set(ref(db, `adConfig/customAds/${campaignId}`), newCampaign);
      showToast(`Kampanye iklan "${campaignTitle}" berhasil diterbitkan! 🎉`, 'success');
      
      // Reset form
      setCampaignTitle('');
      setCampaignSponsor('');
      setCampaignDesc('');
      setCampaignBanner('');
      setCampaignTargetUrl('');
      setCampaignCtaText('Kunjungi Website');
      setIsCreatingCampaign(false);
    } catch (err) {
      console.error('Failed to create custom campaign:', err);
      showToast('Gagal membuat kampanye iklan.', 'error');
    }
  };

  // Toggle Custom Campaign status
  const handleToggleCampaign = async (campaign: CustomAdCampaign) => {
    try {
      await update(ref(db, `adConfig/customAds/${campaign.id}`), {
        isActive: !campaign.isActive
      });
      showToast(`Status iklan "${campaign.title}" diperbarui.`, 'success');
    } catch (err) {
      console.error('Failed to toggle campaign:', err);
      showToast('Gagal memperbarui status kampanye.', 'error');
    }
  };

  // Delete Custom Campaign
  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Hapus materi kampanye iklan ini secara permanen?')) return;
    try {
      await remove(ref(db, `adConfig/customAds/${campaignId}`));
      showToast('Kampanye iklan berhasil dihapus.', 'info');
    } catch (err) {
      console.error('Failed to delete campaign:', err);
      showToast('Gagal menghapus kampanye.', 'error');
    }
  };

  // Prepare sandbox iframe doc
  const sandboxHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    html, body {
      width: 100%;
      min-height: 80px;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      padding: 8px;
    }
    #${adConfig.containerId || 'container-f2023cc3c42361e2d4fcb5a4601d7c18'} {
      width: 100%;
      min-height: 60px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  </style>
</head>
<body>
  ${adConfig.customSnippet || `<script async="async" data-cfasync="false" src="${adConfig.scriptUrl}"></script><div id="${adConfig.containerId}"></div>`}
</body>
</html>`;

  const customAdsList: CustomAdCampaign[] = Object.values(adConfig.customAds || {});

  return (
    <div className="p-4 sm:p-6 pb-28 animate-fade-in relative max-w-5xl mx-auto text-neutral-900">
      {/* Toast Alert */}
      {toastMsg && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[160] px-5 py-3 rounded-2xl shadow-2xl border flex items-center space-x-2.5 text-xs font-black transition-all animate-scale-up backdrop-blur-md ${
          toastMsg.type === 'success' 
            ? 'bg-neutral-950 text-white border-amber-400' 
            : toastMsg.type === 'error' 
              ? 'bg-red-600 text-white border-red-700' 
              : 'bg-blue-600 text-white border-blue-400'
        }`}>
          <i className={`fas ${
            toastMsg.type === 'success' ? 'fa-circle-check text-amber-400' : toastMsg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'
          }`}></i>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* HEADER BANNER - ADS COMMAND CENTER */}
      <div className="mb-6 bg-gradient-to-br from-neutral-950 via-zinc-900 to-black text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="bg-amber-400 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center space-x-1">
                <i className="fas fa-rectangle-ad text-[9px]"></i>
                <span>Monetization & Ads GUI</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                adConfig.isEnabled 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' 
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {adConfig.isEnabled ? '● Iklan Aktif Global' : '○ Iklan Dimatikan'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Pusat Manajemen Iklan</h2>
            <p className="text-xs text-neutral-400 max-w-xl mt-1">
              Kelola script jaringan iklan CPM, atur frekuensi penempatan di Feed & Toko, buat banner sponsor lokal, dan uji render live di simulator.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <i className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}></i>
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl border border-white/15 transition-all active:scale-95 cursor-pointer"
              >
                <i className="fas fa-xmark mr-1.5"></i>
                <span>Tutup GUI</span>
              </button>
            )}
          </div>
        </div>

        {/* AdBlocker Live Status Notification Bar */}
        <div className="mt-5 p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className={`w-3 h-3 rounded-full shrink-0 ${
              adBlockStatus === 'clear' 
                ? 'bg-emerald-400 animate-pulse' 
                : adBlockStatus === 'detected' 
                  ? 'bg-red-400 animate-ping' 
                  : 'bg-yellow-400 animate-spin'
            }`}></div>
            <div>
              <p className="font-bold text-neutral-200">
                {adBlockStatus === 'clear' && 'Koneksi Iklan Lancar: Tidak ada AdBlocker terdeteksi di browser ini.'}
                {adBlockStatus === 'detected' && 'Perhatian: Browser Anda memblokir domain iklan (AdBlocker / Brave Shields aktif).'}
                {adBlockStatus === 'checking' && 'Memeriksa status AdBlocker & koneksi jaringan...'}
              </p>
              {adBlockStatus === 'detected' && (
                <p className="text-[11px] text-red-300 font-normal mt-0.5">
                  Iklan CPM eksternal tidak dapat muncul jika AdBlock / Brave Shields aktif. Matikan AdBlock untuk melihat iklan.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={runAdBlockCheck}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white font-bold text-[11px] border border-white/10 shrink-0 transition-all cursor-pointer"
          >
            <i className="fas fa-rotate-right mr-1"></i>
            <span>Cek Ulang AdBlock</span>
          </button>
        </div>

        {/* SUB-TABS NAVIGATION */}
        <div className="flex space-x-2 sm:space-x-3 mt-6 border-b border-white/15 overflow-x-auto scrollbar-none text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('network')}
            className={`pb-2.5 px-1 transition-all flex items-center space-x-2 relative cursor-pointer ${
              activeTab === 'network' ? 'text-amber-400 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <i className="fas fa-code"></i>
            <span>Script & Jaringan</span>
            {activeTab === 'network' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-md shadow-amber-400"></div>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`pb-2.5 px-1 transition-all flex items-center space-x-2 relative cursor-pointer ${
              activeTab === 'sandbox' ? 'text-amber-400 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <i className="fas fa-vial-circle-check"></i>
            <span>Simulator Live</span>
            {activeTab === 'sandbox' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-md shadow-amber-400"></div>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('placements')}
            className={`pb-2.5 px-1 transition-all flex items-center space-x-2 relative cursor-pointer ${
              activeTab === 'placements' ? 'text-amber-400 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <i className="fas fa-sliders"></i>
            <span>Lokasi & Frekuensi</span>
            {activeTab === 'placements' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-md shadow-amber-400"></div>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`pb-2.5 px-1 transition-all flex items-center space-x-2 relative cursor-pointer ${
              activeTab === 'campaigns' ? 'text-amber-400 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <i className="fas fa-bullhorn"></i>
            <span>Banner Kustom ({customAdsList.length})</span>
            {activeTab === 'campaigns' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-md shadow-amber-400"></div>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`pb-2.5 px-1 transition-all flex items-center space-x-2 relative cursor-pointer ${
              activeTab === 'analytics' ? 'text-amber-400 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <i className="fas fa-chart-line"></i>
            <span>Statistik & Tips</span>
            {activeTab === 'analytics' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-md shadow-amber-400"></div>}
          </button>
        </div>
      </div>

      {/* TAB 1: SCRIPT & JARINGAN IKLAN */}
      {activeTab === 'network' && (
        <div className="space-y-6 animate-fade-in">
          {/* Global Master Switch */}
          <div className="bg-white border border-black/10 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-neutral-900 tracking-tight">Status Penayangan Iklan Global</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Aktifkan atau matikan seluruh iklan di seluruh aplikasi dengan satu tombol.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={adConfig.isEnabled} 
                onChange={(e) => setAdConfig(prev => ({ ...prev, isEnabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-neutral-900"></div>
              <span className="ml-3 text-xs font-black text-neutral-800">
                {adConfig.isEnabled ? 'AKTIF' : 'NONAKTIF'}
              </span>
            </label>
          </div>

          {/* Script & Container Fields */}
          <div className="bg-white border border-black/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900 tracking-tight">Konfigurasi Script & Tag Iklan CPM</h3>
                <p className="text-xs text-neutral-500">Parameter invoke URL dan kontainer target jaringan periklanan.</p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] font-bold text-neutral-500 hover:text-black bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-xl border border-neutral-200 transition-all cursor-pointer"
              >
                <i className="fas fa-arrow-rotate-left mr-1"></i>
                Reset ke Bawaan
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1.5">
                  Ad Script Source URL (invoke.js)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adConfig.scriptUrl}
                    onChange={(e) => setAdConfig(prev => ({ ...prev, scriptUrl: e.target.value }))}
                    placeholder="https://.../invoke.js"
                    className="w-full px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs font-mono text-neutral-800 focus:bg-white focus:outline-none focus:border-black transition-all"
                  />
                  <div className="absolute right-3 top-3 text-neutral-400 text-xs">
                    <i className="fas fa-link"></i>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1.5">
                  Target Container DOM ID
                </label>
                <input
                  type="text"
                  value={adConfig.containerId}
                  onChange={(e) => setAdConfig(prev => ({ ...prev, containerId: e.target.value }))}
                  placeholder="container-f2023cc3c42361e2d4fcb5a4601d7c18"
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs font-mono text-neutral-800 focus:bg-white focus:outline-none focus:border-black transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1.5 flex items-center justify-between">
                  <span>Custom Ad Snippet (HTML / Script / Iframe)</span>
                  <span className="text-[10px] text-neutral-400 font-semibold normal-case">Dijalankan di sandbox isolasi</span>
                </label>
                <textarea
                  rows={4}
                  value={adConfig.customSnippet}
                  onChange={(e) => setAdConfig(prev => ({ ...prev, customSnippet: e.target.value }))}
                  placeholder="<script async src='...'></script><div id='...'></div>"
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs font-mono text-neutral-800 focus:bg-white focus:outline-none focus:border-black transition-all resize-y"
                ></textarea>
              </div>

              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs text-neutral-600 flex items-start space-x-2.5">
                <i className="fas fa-shield-halved text-amber-500 text-sm mt-0.5 shrink-0"></i>
                <div className="space-y-1">
                  <p className="font-bold text-neutral-800">Proteksi Sandbox Aktif</p>
                  <p className="text-[11px] leading-relaxed">
                    Script iklan dieksekusi dalam iframe mandiri sehingga tidak akan menyebabkan error crash pada aplikasi ataupun mengganggu state komponen lain.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-6 py-3 bg-black hover:bg-neutral-800 text-white text-xs font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <i className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-check'}`}></i>
                <span>{isSaving ? 'Menyimpan...' : 'Terapkan & Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SANDBOX & SIMULATOR LIVE */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-black/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900 tracking-tight">Interactive Live Ad Simulator</h3>
                <p className="text-xs text-neutral-500">Pratinjau langsung bagaimana iklan tampil pada antarmuka pengguna.</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSandboxRefreshKey(k => k + 1)}
                  className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-200 transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
                >
                  <i className="fas fa-rotate-right text-xs"></i>
                  <span>Reload Sandbox</span>
                </button>
              </div>
            </div>

            {/* Simulated Post Card with Ad */}
            <div className="max-w-md mx-auto space-y-4 p-4 bg-neutral-100/70 rounded-3xl border border-neutral-200">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400 text-center">
                Simulasi Tampilan di Feed Linimasa
              </div>

              {/* Mock Normal Post */}
              <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-xs space-y-2 opacity-60">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-neutral-200"></div>
                  <div className="space-y-1">
                    <div className="w-20 h-2.5 bg-neutral-200 rounded"></div>
                    <div className="w-12 h-2 bg-neutral-100 rounded"></div>
                  </div>
                </div>
                <div className="h-3 bg-neutral-100 rounded w-5/6"></div>
              </div>

              {/* LIVE AD CARD CONTAINER */}
              <article className="border border-black/15 rounded-2xl overflow-hidden shadow-sm bg-white p-3.5 sm:p-4 space-y-2.5 relative">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-yellow-500 border border-black/10 flex items-center justify-center text-neutral-900 shadow-xs shrink-0 font-black text-xs">
                      <i className="fas fa-rectangle-ad text-neutral-900 text-xs"></i>
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-tight">
                          {adConfig.sponsorBadgeText || 'Sponsor Rekomendasi'}
                        </span>
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shrink-0 shadow-2xs">
                          <span>Iklan</span>
                        </span>
                      </div>
                      <p className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider">
                        Partner Resmi Orbit
                      </p>
                    </div>
                  </div>

                  <span className="text-[9px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200 uppercase tracking-wider">
                    Sponsored
                  </span>
                </div>

                {/* Live Sandbox Render Area */}
                <div className="w-full overflow-hidden min-h-[60px] flex flex-col items-center justify-center rounded-xl bg-neutral-50 border border-neutral-100 p-1">
                  <iframe
                    key={`sandbox-preview-${sandboxRefreshKey}`}
                    title="Live Ad Preview"
                    srcDoc={sandboxHtml}
                    className="w-full min-h-[65px] border-0 overflow-hidden"
                    scrolling="no"
                  />
                </div>
              </article>

              {/* Mock Following Post */}
              <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-xs space-y-2 opacity-60">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-neutral-200"></div>
                  <div className="space-y-1">
                    <div className="w-24 h-2.5 bg-neutral-200 rounded"></div>
                    <div className="w-14 h-2 bg-neutral-100 rounded"></div>
                  </div>
                </div>
                <div className="h-3 bg-neutral-100 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOKASI & FREKUENSI PENEMPATAN */}
      {activeTab === 'placements' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-black/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="text-base font-black text-neutral-900 tracking-tight">Aturan Frekuensi & Penempatan Iklan</h3>
              <p className="text-xs text-neutral-500">Tentukan di mana dan seberapa sering iklan disematkan pada navigasi pengguna.</p>
            </div>

            <div className="space-y-4">
              {/* Feed Frequency */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <label className="text-xs font-black text-neutral-900 uppercase">
                    Frekuensi Iklan di Beranda Feed
                  </label>
                  <p className="text-[11px] text-neutral-500">
                    Munculkan kartu iklan setiap kelipatan jumlah postingan tertentu di linimasa.
                  </p>
                </div>
                <select
                  value={adConfig.feedFrequency}
                  onChange={(e) => setAdConfig(prev => ({ ...prev, feedFrequency: parseInt(e.target.value) || 0 }))}
                  className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-800 focus:outline-none focus:border-black cursor-pointer shadow-xs"
                >
                  <option value={3}>Setiap 3 Postingan (Sering)</option>
                  <option value={5}>Setiap 5 Postingan (Direkomendasikan)</option>
                  <option value={7}>Setiap 7 Postingan (Moderat)</option>
                  <option value={10}>Setiap 10 Postingan (Jarang)</option>
                  <option value={0}>Nonaktifkan di Beranda</option>
                </select>
              </div>

              {/* Single Post View Toggle */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase">Tampilkan di Detail Postingan</h4>
                  <p className="text-[11px] text-neutral-500">
                    Sematkan kartu sponsor di bawah komentar postingan tunggal.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={adConfig.showInSinglePost} 
                    onChange={(e) => setAdConfig(prev => ({ ...prev, showInSinglePost: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900"></div>
                </label>
              </div>

              {/* Shop Page Toggle */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase">Tampilkan di Halaman Toko (Shop)</h4>
                  <p className="text-[11px] text-neutral-500">
                    Sematkan banner sponsor di bagian bawah etalase produk dan toko.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={adConfig.showInShop} 
                    onChange={(e) => setAdConfig(prev => ({ ...prev, showInShop: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900"></div>
                </label>
              </div>

              {/* Sponsor Badge Label Customizer */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <label className="text-xs font-black text-neutral-900 uppercase block">
                  Kustomisasi Label Header Sponsor
                </label>
                <input
                  type="text"
                  value={adConfig.sponsorBadgeText || ''}
                  onChange={(e) => setAdConfig(prev => ({ ...prev, sponsorBadgeText: e.target.value }))}
                  placeholder="Contoh: Sponsor Rekomendasi, Partner Pilihan, dsb."
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-800 focus:outline-none focus:border-black transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-6 py-3 bg-black hover:bg-neutral-800 text-white text-xs font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-2 cursor-pointer"
              >
                <i className="fas fa-check"></i>
                <span>Simpan Aturan Penempatan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BANNER IKLAN KUSTOM (LOCAL DIRECT CAMPAIGNS) */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-black/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900 tracking-tight">Kampanye Banner Sponsor Kustom</h3>
                <p className="text-xs text-neutral-500">
                  Buat banner promosi langsung (Direct Sponsor / Affiliate) tanpa bergantung pada jaringan CPM pihak ketiga.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingCampaign(true)}
                className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer shrink-0"
              >
                <i className="fas fa-plus text-xs"></i>
                <span>Buat Iklan Kustom</span>
              </button>
            </div>

            {/* Campaign List */}
            {customAdsList.length === 0 ? (
              <div className="text-center py-12 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <div className="w-12 h-12 rounded-full bg-neutral-200/70 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <i className="fas fa-bullhorn text-xl"></i>
                </div>
                <h4 className="text-xs font-black text-neutral-800 uppercase">Belum Ada Banner Kustom</h4>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto mt-1 mb-4">
                  Anda dapat membuat iklan partner lokal dengan gambar banner dan tautan WhatsApp / website langsung.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(true)}
                  className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-full hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
                >
                  + Tambah Banner Pertama
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customAdsList.map((ad) => (
                  <div 
                    key={ad.id} 
                    className={`rounded-2xl border p-4 space-y-3 transition-all ${
                      ad.isActive ? 'bg-white border-neutral-200 shadow-sm' : 'bg-neutral-50 border-neutral-200/60 opacity-60'
                    }`}
                  >
                    <div className="relative rounded-xl overflow-hidden aspect-video bg-neutral-900 border border-neutral-200/80">
                      <img 
                        src={ad.bannerImage} 
                        alt={ad.title} 
                        className="w-full h-full object-cover"
                      />
                      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        ad.isActive ? 'bg-emerald-500 text-white shadow-xs' : 'bg-neutral-700 text-neutral-300'
                      }`}>
                        {ad.isActive ? 'Aktif' : 'Dijeda'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                          {ad.sponsorName}
                        </span>
                        <span className="text-[9px] text-neutral-400">
                          {new Date(ad.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-neutral-900 line-clamp-1">{ad.title}</h4>
                      {ad.description && (
                        <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{ad.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleCampaign(ad)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] border transition-all cursor-pointer ${
                          ad.isActive 
                            ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200' 
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                        }`}
                      >
                        <i className={`fas mr-1 ${ad.isActive ? 'fa-pause' : 'fa-play'}`}></i>
                        <span>{ad.isActive ? 'Jeda Iklan' : 'Aktifkan'}</span>
                      </button>

                      <div className="flex items-center space-x-1.5">
                        {ad.targetUrl && (
                          <a
                            href={ad.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all"
                            title="Buka Link Tujuan"
                          >
                            <i className="fas fa-arrow-up-right-from-square text-xs"></i>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(ad.id)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-all cursor-pointer"
                          title="Hapus Iklan"
                        >
                          <i className="fas fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: STATISTIK & TIPS TROUBLESHOOTING */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-black/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="text-base font-black text-neutral-900 tracking-tight">Statistik & Panduan Monetisasi</h3>
              <p className="text-xs text-neutral-500">Informasi operasional, tips penayangan, dan pemecahan masalah iklan.</p>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Status Jaringan</span>
                <p className="text-base sm:text-lg font-black text-emerald-600 mt-1">Tersinkron</p>
                <span className="text-[10px] text-neutral-400">Firebase RTDB</span>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">AdBlocker Monitor</span>
                <p className={`text-base sm:text-lg font-black mt-1 ${adBlockStatus === 'clear' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {adBlockStatus === 'clear' ? 'Lancar (0 Block)' : 'Terdeteksi'}
                </p>
                <span className="text-[10px] text-neutral-400">Sisi Klien Browser</span>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Frekuensi Feed</span>
                <p className="text-base sm:text-lg font-black text-neutral-900 mt-1">1 : {adConfig.feedFrequency}</p>
                <span className="text-[10px] text-neutral-400">Setiap {adConfig.feedFrequency} Post</span>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Banner Kustom</span>
                <p className="text-base sm:text-lg font-black text-neutral-900 mt-1">{customAdsList.length} Unit</p>
                <span className="text-[10px] text-neutral-400">{customAdsList.filter(a => a.isActive).length} Aktif</span>
              </div>
            </div>

            {/* Troubleshooting Guide */}
            <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3 text-xs text-amber-950">
              <div className="flex items-center space-x-2 font-black text-amber-900">
                <i className="fas fa-lightbulb text-amber-600"></i>
                <span>Kenapa Iklan CPM Terkadang Tidak Muncul?</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] leading-relaxed text-amber-900/90 pl-1">
                <li><strong>AdBlocker / Brave Shields:</strong> Ekstensi seperti AdBlock, uBlock, atau browser Brave secara otomatis memblokir script domain periklanan. Matikan pelindung sementara untuk menguji iklan.</li>
                <li><strong>Private DNS (NextDNS / AdGuard):</strong> Pengguna Android/iOS dengan pengaturan Private DNS pemblokir iklan tidak dapat menerima feed dari server iklan.</li>
                <li><strong>Ketersediaan Inventori Iklan (Fill Rate):</strong> Jaringan CPM mengalokasikan iklan berdasarkan lokasi geografis (Geo-targeting) dan batas frekuensi per pengguna (*Frequency Capping*).</li>
                <li><strong>Solusi Banner Kustom:</strong> Gunakan menu <em>"Banner Kustom"</em> di tab atas untuk memasang iklan sponsor lokal yang dijamin 100% selalu muncul tanpa terhalang AdBlock!</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM CAMPAIGN MODAL */}
      {isCreatingCampaign && (
        <div className="fixed inset-0 z-[170] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-neutral-100 max-h-[90vh] overflow-y-auto animate-scale-up space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs">
                  <i className="fas fa-bullhorn"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 uppercase">Buat Banner Sponsor Kustom</h3>
                  <p className="text-[10px] text-neutral-400">Iklan langsung dengan tautan web/WA sponsor.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingCampaign(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <i className="fas fa-xmark text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black uppercase text-neutral-700 mb-1">
                  Nama Brand / Sponsor *
                </label>
                <input
                  type="text"
                  required
                  value={campaignSponsor}
                  onChange={(e) => setCampaignSponsor(e.target.value)}
                  placeholder="Contoh: Toko Kopi Nusantara / Kursus Online"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-medium focus:bg-white focus:outline-none focus:border-black transition-all"
                />
              </div>

              <div>
                <label className="block font-black uppercase text-neutral-700 mb-1">
                  Judul Iklan Promo *
                </label>
                <input
                  type="text"
                  required
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="Contoh: Diskon 50% Semua Menu Spesial Akhir Pekan!"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-bold focus:bg-white focus:outline-none focus:border-black transition-all"
                />
              </div>

              <div>
                <label className="block font-black uppercase text-neutral-700 mb-1">
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={campaignDesc}
                  onChange={(e) => setCampaignDesc(e.target.value)}
                  placeholder="Penjelasan ringkas penawaran promosi..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:outline-none focus:border-black transition-all resize-none"
                ></textarea>
              </div>

              {/* Banner Image Upload */}
              <div>
                <label className="block font-black uppercase text-neutral-700 mb-1">
                  Foto / Gambar Banner Iklan *
                </label>
                {campaignBanner ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-video bg-neutral-900 border border-neutral-200">
                    <img src={campaignBanner} alt="Preview Banner" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCampaignBanner('')}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-2 rounded-full backdrop-blur-xs transition-all cursor-pointer"
                    >
                      <i className="fas fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-200 hover:border-black rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition-all cursor-pointer text-center">
                    <i className={`fas ${isUploadingBanner ? 'fa-circle-notch fa-spin text-amber-500' : 'fa-image text-neutral-400'} text-2xl mb-2`}></i>
                    <span className="font-bold text-neutral-800">
                      {isUploadingBanner ? 'Mengompres Gambar...' : 'Klik untuk Unggah Banner'}
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">Mendukung format JPG, PNG, WEBP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={isUploadingBanner}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-neutral-700 mb-1">
                    URL Link Tujuan (Web / WA)
                  </label>
                  <input
                    type="text"
                    value={campaignTargetUrl}
                    onChange={(e) => setCampaignTargetUrl(e.target.value)}
                    placeholder="https://wa.me/... atau https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-medium focus:bg-white focus:outline-none focus:border-black transition-all"
                  />
                </div>

                <div>
                  <label className="block font-black uppercase text-neutral-700 mb-1">
                    Teks Tombol CTA
                  </label>
                  <input
                    type="text"
                    value={campaignCtaText}
                    onChange={(e) => setCampaignCtaText(e.target.value)}
                    placeholder="Contoh: Kunjungi Web, Beli Sekarang"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-medium focus:bg-white focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(false)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!campaignBanner || isUploadingBanner}
                  className="flex-1 py-3 px-4 rounded-2xl bg-black hover:bg-neutral-800 text-white font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  Terbitkan Iklan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(AdsManager);
