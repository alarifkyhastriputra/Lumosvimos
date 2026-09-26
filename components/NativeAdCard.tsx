import React, { useEffect, useRef, useState } from 'react';

interface NativeAdCardProps {
  slotId?: string | number;
}

export const NativeAdCard: React.FC<NativeAdCardProps> = ({ slotId = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef<boolean>(false);
  const [adError, setAdError] = useState<boolean>(false);

  useEffect(() => {
    // Prevent duplicate script injection on re-renders
    if (scriptLoadedRef.current || !containerRef.current) return;
    scriptLoadedRef.current = true;

    try {
      const script = document.createElement('script');
      script.src = 'https://pl31515732.profitableratecpmnetwork.com/f2023cc3c42361e2d4fcb5a4601d7c18/invoke.js';
      script.async = true;
      script.setAttribute('data-cfasync', 'false');

      script.onerror = (e) => {
        if (typeof e === 'object' && e && 'stopPropagation' in e && typeof (e as Event).stopPropagation === 'function') {
          (e as Event).stopPropagation();
        }
        console.warn(`Ad script failed to load for slot ${slotId}`);
        setAdError(true);
      };

      containerRef.current.appendChild(script);
    } catch (err) {
      console.error('Error initializing Native Ad:', err);
      setAdError(true);
    }
  }, [slotId]);

  // Unique container ID for each slot as requested, maintaining network target compatibility
  const uniqueContainerId = `container-f2023cc3c42361e2d4fcb5a4601d7c18-${slotId}`;

  return (
    <article className="border border-black/10 hover:border-black/30 rounded-2xl overflow-hidden transition-all shadow-sm bg-white p-4 sm:p-5 space-y-3 relative">
      {/* Header matching PostCard style */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-yellow-500 border border-black/10 flex items-center justify-center text-neutral-900 shadow-xs shrink-0 font-black text-xs">
            <i className="fas fa-rectangle-ad text-neutral-900 text-sm"></i>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-tight">
                Partner Rekomendasi
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shrink-0 shadow-2xs">
                <i className="fas fa-rectangle-ad text-[8px] text-amber-700"></i>
                <span>Iklan</span>
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mt-0.5">
              Sponsor Resmi Vimos
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 uppercase tracking-wider">
          Sponsored
        </span>
      </div>

      {/* Ad Network Container */}
      <div 
        ref={containerRef} 
        className="w-full overflow-hidden min-h-[60px] flex flex-col items-center justify-center rounded-xl bg-neutral-50/50 border border-neutral-100/80 p-2"
      >
        {/* Slot specific container div */}
        <div 
          id={uniqueContainerId} 
          className="container-f2023cc3c42361e2d4fcb5a4601d7c18 w-full flex justify-center items-center"
        >
          {/* Primary target ID expected by invoke.js */}
          <div id="container-f2023cc3c42361e2d4fcb5a4601d7c18" className="w-full flex justify-center items-center"></div>
        </div>

        {adError && (
          <p className="text-[10px] text-neutral-400 font-medium italic my-1">
            Konten sponsor tidak tersedia saat ini.
          </p>
        )}
      </div>
    </article>
  );
};

export default React.memo(NativeAdCard);
