import React from 'react';
import type { DecorCategory } from '../types';

export function HouseBrandLogo({ className = 'w-20 h-14' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 82" fill="none" aria-hidden="true">
      <path
        d="M16 42L60 12L104 42"
        stroke="#3B1C5E"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="46" y="34" width="11" height="11" rx="2" fill="#E8B824" />
      <rect x="63" y="34" width="11" height="11" rx="2" fill="#E8B824" />
      <rect x="46" y="49" width="11" height="11" rx="2" fill="#E8B824" />
      <rect x="63" y="49" width="11" height="11" rx="2" fill="#E8B824" />
      <path d="M12 52C34 74 86 74 108 52C88 64 32 64 12 52Z" fill="#E8B824" />
    </svg>
  );
}

export function SparkleEmblem({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M18 3L21.2 13.8L32 17L21.2 20.2L18 31L14.8 20.2L4 17L14.8 13.8L18 3Z" fill="#E8B824" />
      <path d="M28 5L29.1 8.9L33 10L29.1 11.1L28 15L26.9 11.1L23 10L26.9 8.9L28 5Z" fill="#F7D86B" />
    </svg>
  );
}

export function CategoryIcon({ category }: { category: Exclude<DecorCategory, 'عام'> }) {
  switch (category) {
    case 'ألوان الطلاء':
      return (
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="8" y="6" width="20" height="10" rx="3" fill="#6C1BB0" />
          <path
            d="M28 11H32V20H20V24"
            stroke="#3B1C5E"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="17" y="24" width="6" height="12" rx="2" fill="#4A2B73" />
        </svg>
      );
    case 'الأثاث':
      return (
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M9 17C9 14.8 10.8 13 13 13H27C29.2 13 31 14.8 31 17V21H9V17Z" fill="#F4C430" />
          <path
            d="M5 20C5 18.3 6.3 17 8 17C9.7 17 11 18.3 11 20V26H29V20C29 18.3 30.3 17 32 17C33.7 17 35 18.3 35 20V29H31V27H9V29H5V20Z"
            fill="#E8B824"
          />
        </svg>
      );
    case 'الإضاءة':
      return (
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <line x1="20" y1="5" x2="20" y2="12" stroke="#3B1C5E" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M10 22C10 16.5 14.5 12 20 12C25.5 12 30 16.5 30 22H10Z" fill="#4A207A" />
          <path d="M16 22C16 24.5 17.8 26.5 20 26.5C22.2 26.5 24 24.5 24 22H16Z" fill="#F7D86B" />
          <line x1="20" y1="29" x2="20" y2="33" stroke="#E8B824" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="13" y1="28" x2="11" y2="31" stroke="#E8B824" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="27" y1="28" x2="29" y2="31" stroke="#E8B824" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'الأرضيات':
      return (
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <polygon points="12,11 33,11 28,29 7,29" fill="#B68456" />
          <line x1="19" y1="11" x2="14" y2="29" stroke="#F7F3EE" strokeWidth="2" />
          <line x1="26" y1="11" x2="21" y2="29" stroke="#F7F3EE" strokeWidth="2" />
          <line x1="10" y1="20" x2="30.5" y2="20" stroke="#F7F3EE" strokeWidth="2" />
        </svg>
      );
  }
}
