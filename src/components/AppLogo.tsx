export default function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Blue rounded background */}
      <rect width="32" height="32" rx="7" fill="#2563eb"/>

      {/* Clapper stick — angled open */}
      <g transform="rotate(-16 5 15)">
        <rect x="5" y="9" width="22" height="6" rx="1.5" fill="white"/>
        {/* Stripes on stick */}
        <rect x="8"  y="9" width="3" height="6" fill="#2563eb"/>
        <rect x="14" y="9" width="3" height="6" fill="#2563eb"/>
        <rect x="20" y="9" width="3" height="6" fill="#2563eb"/>
      </g>

      {/* Board body */}
      <rect x="5" y="16" width="22" height="13" rx="2" fill="white"/>
      {/* Stripe strip on top of body */}
      <rect x="5"  y="16" width="22" height="4" rx="0" fill="white"/>
      <rect x="8"  y="16" width="3"  height="4" fill="#2563eb"/>
      <rect x="14" y="16" width="3"  height="4" fill="#2563eb"/>
      <rect x="20" y="16" width="3"  height="4" fill="#2563eb"/>
      {/* Round off top corners of stripe strip */}
      <rect x="5" y="16" width="22" height="4" rx="2" fill="none"/>

      {/* Text lines on board */}
      <rect x="8" y="23" width="10" height="2" rx="1" fill="#bfdbfe"/>
      <rect x="8" y="26" width="7"  height="2" rx="1" fill="#bfdbfe"/>
    </svg>
  );
}
