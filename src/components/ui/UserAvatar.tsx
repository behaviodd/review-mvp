import { Avatar } from '../catalyst/avatar';
import type { User } from '../../types';

interface Props {
  user: User;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
}

const SIZES = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-11',
  xl: 'size-14',
};

export function UserAvatar({ user, size = 'md', showName }: Props) {
  const initials = user.name.slice(0, 2);
  return (
    <div className="flex items-center gap-2.5">
      <Avatar
        initials={initials}
        color={user.avatarColor}
        alt={`${user.name} 아바타`}
        className={SIZES[size]}
      />
      {showName && (
        <div>
          <p className="text-sm/6 font-medium text-zinc-950">{user.name}</p>
          <p className="text-xs/5 text-zinc-500">{user.position}</p>
        </div>
      )}
    </div>
  );
}
