export function BrandLogo({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="#991B1B" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
      {/* Sacred Annapurna Bowl & Flame */}
      <path
        d="M17 34C17 42.2843 23.7157 49 32 49C40.2843 49 47 42.2843 47 34H17Z"
        fill="#D4AF37"
      />
      <path
        d="M21 34C21 40.0751 25.9249 45 32 45C38.0751 45 43 40.0751 43 34H21Z"
        fill="#F59E0B"
      />
      <rect x="24" y="49" width="16" height="3.5" rx="1.75" fill="#FDE68A" />
      {/* Steam / Sacred Saffron Diya Flame */}
      <path
        d="M32 13C32 13 38.5 20.5 38.5 25.5C38.5 29.0899 35.5899 32 32 32C28.4101 32 25.5 29.0899 25.5 25.5C25.5 20.5 32 13 32 13Z"
        fill="#FDE68A"
      />
      <path
        d="M32 19C32 19 35.5 23.2 35.5 26C35.5 27.933 33.933 29.5 32 29.5C30.067 29.5 28.5 27.933 28.5 26C28.5 23.2 32 19 32 19Z"
        fill="#EA580C"
      />
    </svg>
  );
}
