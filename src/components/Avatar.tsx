import type { Profile } from '@/types';
import { colorFromString, getInitials, displayName } from '@/lib/utils';

interface AvatarProps {
  profile?: Profile | null;
  name?: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  isOnline?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-3xl',
};

const statusSizes = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-5 h-5',
};

export default function Avatar({
  profile,
  name,
  src,
  size = 'md',
  showStatus = false,
  isOnline = false,
  className = '',
}: AvatarProps) {
  const displayNameValue = name || displayName(profile);
  const colorClass = colorFromString(profile?.id || displayNameValue);
  const avatarSrc = src || profile?.avatar_url || null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-semibold text-white ${colorClass} ring-2 ring-white dark:ring-gray-800`}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayNameValue}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span>{getInitials(displayNameValue)}</span>
        )}
      </div>
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${statusSizes[size]} rounded-full ring-2 ring-white dark:ring-gray-800 ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
}
