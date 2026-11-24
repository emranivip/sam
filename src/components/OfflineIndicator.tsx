import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#3b1c5e] px-3.5 py-2 text-xs font-bold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 text-[#e8b824]" />
      <span>وضع عدم الاتصال — يتم عرض التصاميم المحفوظة</span>
    </div>
  );
}
