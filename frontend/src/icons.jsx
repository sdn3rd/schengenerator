export function SunIcon({ size = 20, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="12" r="4.5" />
      <rect x="10.75" y="1" width="2.5" height="3.5" rx="1.25" />
      <rect x="10.75" y="19.5" width="2.5" height="3.5" rx="1.25" />
      <rect x="1" y="10.75" width="3.5" height="2.5" rx="1.25" />
      <rect x="19.5" y="10.75" width="3.5" height="2.5" rx="1.25" />
      <rect x="18.36" y="3.86" width="2.5" height="3" rx="1.25" transform="rotate(45 18.36 3.86)" />
      <rect x="3.14" y="17.14" width="2.5" height="3" rx="1.25" transform="rotate(45 3.14 17.14)" />
      <rect x="3.14" y="3.86" width="2.5" height="3" rx="1.25" transform="rotate(-45 3.14 3.86)" />
      <rect x="18.36" y="17.14" width="2.5" height="3" rx="1.25" transform="rotate(-45 18.36 17.14)" />
    </svg>
  );
}

export function MoonIcon({ size = 20, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
    </svg>
  );
}

export function UploadIcon({ size = 22, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M11 14.586V17a1 1 0 1 0 2 0v-2.414l.293.293a1 1 0 0 0 1.414-1.414l-2-2a1 1 0 0 0-1.414 0l-2 2a1 1 0 0 0 1.414 1.414L11 14.586z" />
      <path d="M4 14a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-2a1 1 0 1 0-2 0v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2a1 1 0 0 0-1-1z" />
      <path d="M12 3a5 5 0 1 0 0 10A5 5 0 0 0 12 3zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
      {/* simpler cloud-upload path */}
    </svg>
  );
}

export function FileJsonIcon({ size = 22, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  );
}

export function GoogleIcon({ size = 20, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 16, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function AlertIcon({ size = 16, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

export function CheckIcon({ size = 16, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function KeyIcon({ size = 16, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="8" cy="15" r="4" />
      <line x1="11.5" y1="11.5" x2="22" y2="1" />
      <line x1="19" y1="4" x2="21" y2="6" />
      <line x1="16" y1="7" x2="18" y2="9" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function RefreshIcon({ size = 16, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}
