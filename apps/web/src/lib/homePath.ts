/** Post-login / home landing path by role. */
export function homePathForRole(role?: string | null): string {
  switch (role) {
    case 'OWNER':
      return '/hq';
    case 'DRIVER':
      return '/store/delivery';
    case 'CASHIER':
      return '/store/pos';
    case 'MANAGER':
      return '/store';
    default:
      return '/store/pos';
  }
}
