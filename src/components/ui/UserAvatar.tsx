import { Avatar } from '../catalyst/avatar';
import type { User } from '../../types';

interface Props {
  user: User;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  anonymous?: boolean;
  /** 사이즈 클래스 override — Figma list row (size-10) 같은 비표준 크기에 사용 */
  className?: string;
}

const SIZES = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-11',
  xl: 'size-14',
};

export function UserAvatar({ user, size = 'md', showName, anonymous, className }: Props) {
  const name = anonymous ? '익명' : user.name;
  const initials = anonymous ? '?' : user.name.slice(0, 2);
  return (
    <div className="flex items-center gap-2.5">
      <Avatar
        initials={initials}
        color={anonymous ? '#8a99a8' : user.avatarColor}
        alt={`${name} 아바타`}
        className={className ?? SIZES[size]}
      />
      {showName && (
        <div>
          <p className="text-sm/6 font-medium text-gray-099">{name}</p>
          {!anonymous && <p className="text-xs/5 text-gray-050">{user.position}</p>}
        </div>
      )}
    </div>
  );
}
