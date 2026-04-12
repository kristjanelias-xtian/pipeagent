export const AVATAR_PALETTE = [
  { start: '#26b67c', end: '#017737' },
  { start: '#f9a825', end: '#ef6c00' },
  { start: '#6366f1', end: '#4338ca' },
  { start: '#ec4899', end: '#be185d' },
  { start: '#06b6d4', end: '#0e7490' },
  { start: '#8b5cf6', end: '#6d28d9' },
] as const;

export type AvatarPaletteIndex = 0 | 1 | 2 | 3 | 4 | 5;

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export function AgentAvatar({
  name,
  paletteIndex = 0,
  size = 48,
  onClick,
  className,
}: {
  name: string;
  paletteIndex?: number;
  size?: number;
  onClick?: () => void;
  className?: string;
}) {
  const palette = AVATAR_PALETTE[paletteIndex] ?? AVATAR_PALETTE[0];
  const style = {
    width: size,
    height: size,
    background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
    boxShadow: '0 0 0 2px #e4e9ef, 0 0 0 4px #ffffff',
    fontSize: size * 0.36,
    cursor: onClick ? 'pointer' : 'default',
  };
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ${className ?? ''}`}
      style={style}
      onClick={onClick}
    >
      {getInitial(name)}
    </div>
  );
}
