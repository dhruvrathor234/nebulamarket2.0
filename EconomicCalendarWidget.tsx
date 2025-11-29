
import React, { useEffect, useRef, memo } from 'react';
import { CalendarClock } from 'lucide-react';

const EconomicCalendarWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const script = document.createElement('script');
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": false,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "importanceFilter": "0,1",
        "currencyFilter": "USD,EUR,GBP,JPY",
        "hide_top_toolbar": true
      });
      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 h-[300px] flex flex-col overflow-hidden">
       <div className="p-3 border-b border-slate-700/50 bg-slate-900/30 flex items-center gap-2">
          <CalendarClock size={16} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase">Economic Events</h3>
       </div>
       <div className="flex-1 w-full" ref={containerRef}></div>
    </div>
  );
};

export default memo(EconomicCalendarWidget);
