type FlagCode = "US" | "DE" | "MX" | "BR";

type Props = {
  code: FlagCode;
  className?: string;
};

const FlagIcon = ({ code, className }: Props) => {
  if (code === "DE") {
    return (
      <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
        <rect width="24" height="16" fill="#000" />
        <rect y="5.333" width="24" height="5.333" fill="#DD0000" />
        <rect y="10.666" width="24" height="5.334" fill="#FFCE00" />
      </svg>
    );
  }

  if (code === "MX") {
    return (
      <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
        <rect width="8" height="16" x="0" y="0" fill="#006847" />
        <rect width="8" height="16" x="8" y="0" fill="#FFFFFF" />
        <rect width="8" height="16" x="16" y="0" fill="#CE1126" />
        {/* simplified crest */}
        <circle cx="12" cy="8" r="2" fill="#B38B00" opacity="0.7" />
      </svg>
    );
  }

  if (code === "BR") {
    return (
      <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
        <rect width="24" height="16" fill="#009B3A" />
        <polygon points="12,2 22,8 12,14 2,8" fill="#FFDF00" />
        <circle cx="12" cy="8" r="3.2" fill="#002776" />
      </svg>
    );
  }

  // US
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
      <rect width="24" height="16" fill="#FFFFFF" />
      {/* red stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} y={i * 2.2857} width="24" height="1.1429" fill="#B22234" />
      ))}
      {/* blue canton */}
      <rect width="10" height="8" fill="#3C3B6E" />
      {/* simplified stars */}
      {Array.from({ length: 9 }).map((_, i) => (
        <circle
          key={i}
          cx={1.3 + (i % 3) * 3.1}
          cy={1.2 + Math.floor(i / 3) * 2.2}
          r="0.35"
          fill="#FFFFFF"
        />
      ))}
    </svg>
  );
};

export default FlagIcon;
