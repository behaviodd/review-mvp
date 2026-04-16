import { Loader2 } from 'lucide-react';
import { Button } from '../catalyst/button';
import type { ButtonColor } from '../catalyst/button';

interface LoadingButtonProps {
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  color?: ButtonColor;
  outline?: boolean;
  plain?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function LoadingButton({ loading, children, disabled, color, outline, plain, ...rest }: LoadingButtonProps) {
  return (
    <Button color={color} outline={outline} plain={plain} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
