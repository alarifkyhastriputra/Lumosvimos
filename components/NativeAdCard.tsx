import React, { useState, useEffect, useRef } from 'react';
import { AdConfig, CustomAdCampaign } from '../types.ts';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../firebase.ts';

interface NativeAdCardProps {
  slotId?: string | number;
  className?: string;
}

const DEFAULT_SCRIPT_URL = 'https://pl31515732.profitableratecpmnetwork.com/f2023cc3c42361e2d4fcb5a4601d7c18/invoke.js';
const DEFAULT_CONTAINER_ID = 'container-f2023cc3c42361e2d4fcb5a4601d7c18';

export const NativeAdCard: React.FC<NativeAdCardProps> = ({ slotId = 0, className = '' }) => {
  const adWrapperRef = useRef<HTMLDivElement>(null);
  const scriptInjectedRef = useRef<boolean>(false);
  const [adConfig, setAdConfig] = useState<Partial<AdConfig>>({
    isEnabled: true,
    sponsorBadgeText: 'Sponsor Rekomendasi',
    scriptUrl: DEFAULT_SCRIPT_URL,
    containerId: DEFAULT_CONTAINER_ID
  });
  const [activeCustomCampaign, setActiveCustomCampaign] = useState<CustomAdCampaign | null>(null);
  const [isAdBlockBlocked, setIsAdBlockBlocked] = useState<boolean>(false);

  useEffect(() => {
    const configRef = ref(db, 'adConfig');
    
    // Fast initial fetch
    get(configRef).then((snap) => {
      if (snap.exists()) {
        const val = snap.val() as AdConfig;
        setAdConfig(val);
        if (val.customAds) {
          const activeList = Object.values(val.customAds).filter(c => c.isActive);
          if (activeList.length > 0) {
            const chosen = activeList[Math.floor(Math.random() * activeList.length)];
            setActiveCustomCampaign(chosen);
          }
        }
      }
    }).catch(() => {});

    const unsub = onValue(configRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as AdConfig;
        setAdConfig(val);
        if (val.customAds) {
          const activeList = Object.values(val.customAds).filter(c => c.isActive);
          if (activeList.length > 0) {
            const chosen = activeList[Math.floor(Math.random() * activeList.length)];
            setActiveCustomCampaign(chosen);
          } else {
            setActiveCustomCampaign(null);
          }
        } else {
          setActiveCustomCampaign(null);
        }
      }
    });

    return () => unsub();
  }, []);

  // Direct DOM script injection for CPM network
  useEffect(() => {
    if (activeCustomCampaign || !adConfig.isEnabled || !adWrapperRef.current) return;
    if (scriptInjectedRef.current) return;
    scriptInjectedRef.current = true;

    try {
      const containerEl = document.createElement('div');
      containerEl.id = adConfig.containerId || DEFAULT_CONTAINER_ID;
      containerEl.className = 'w-full flex justify-center items-center overflow-hidden';
      adWrapperRef.current.appendChild(containerEl);

      const scriptEl = document.createElement('script');
      scriptEl.src = adConfig.scriptUrl || DEFAULT_SCRIPT_URL;
      scriptEl.async = true;
      scriptEl.setAttribute('data-cfasync', 'false');

      scriptEl.onerror = () => {
        setIsAdBlockBlocked(true);
      };

      adWrapperRef.current.appendChild(scriptEl);
    } catch {
      setIsAdBlockBlocked(true);
    }
  }, [adConfig, activeCustomCampaign]);

  // If globally disabled in Ads GUI, don't render
  if (adConfig.isEnabled === false) {
    return null;
  }

  // If a custom banner campaign is active
  if (activeCustomCampaign) {
    return (
      <article className={`border border-black/10 hover:border-black/20 rounded-2xl overflow-hidden transition-all shadow-xs bg-white p-3.5 sm:p-4 space-y-2.5 relative animate-fade-in ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-yellow-500 border border-black/10 flex items-center justify-center text-neutral-900 shadow-xs shrink-0 font-black text-xs">
              <i className="fas fa-rectangle-ad text-neutral-900 text-xs"></i>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-tight">
                  {activeCustomCampaign.sponsorName || adConfig.sponsorBadgeText || 'Sponsor Rekomendasi'}
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

        {/* Custom Banner Image & Action */}
        <div className="rounded-xl overflow-hidden bg-neutral-950 relative group">
          <img 
            src={activeCustomCampaign.bannerImage} 
            alt={activeCustomCampaign.title}
            className="w-full h-auto max-h-64 object-cover group-hover:scale-101 transition-transform" 
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <div>
            <h4 className="font-black text-xs text-neutral-900">{activeCustomCampaign.title}</h4>
            {activeCustomCampaign.description && (
              <p className="text-[11px] text-neutral-500 line-clamp-1">{activeCustomCampaign.description}</p>
            )}
          </div>

          {activeCustomCampaign.targetUrl && (
            <a
              href={activeCustomCampaign.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-black rounded-xl text-center shadow-xs transition-all active:scale-95 shrink-0 flex items-center justify-center space-x-1"
            >
              <span>{activeCustomCampaign.ctaText || 'Kunjungi Web'}</span>
              <i className="fas fa-arrow-up-right-from-square text-[10px]"></i>
            </a>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={`border border-black/10 hover:border-black/20 rounded-2xl overflow-hidden transition-all shadow-xs bg-white p-3 sm:p-4 space-y-2 relative animate-fade-in ${className}`}>
      {/* Ad Header */}
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

      {/* Direct DOM Ad Container */}
      <div className="w-full overflow-hidden min-h-[60px] flex flex-col items-center justify-center rounded-xl bg-neutral-50/70 border border-neutral-100 p-2">
        <div 
          ref={adWrapperRef}
          className="w-full flex flex-col justify-center items-center overflow-hidden min-h-[50px]"
        />

        {isAdBlockBlocked && (
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-center space-y-1 my-1 w-full">
            <p className="text-[11px] font-bold text-amber-900">
              <i className="fas fa-shield-halved mr-1 text-amber-600"></i>
              Script Iklan Diblokir oleh Browser (AdBlock Active)
            </p>
            <p className="text-[10px] text-amber-800/80">
              Matikan AdBlock / Brave Shields / Private DNS jika ingin menampilkan iklan CPM pihak ketiga.
            </p>
          </div>
        )}
      </div>
    </article>
  );
};

export default React.memo(NativeAdCard);
