import { LogOut } from 'lucide-react';

import { useAuth } from '@/auth-context';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={logout}
      className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-gray-50/90 transition-all duration-200 text-gray-700"
    >
      <LogOut className="h-4 w-4" />
      <span>Sign Out</span>
    </Button>
  );
}
