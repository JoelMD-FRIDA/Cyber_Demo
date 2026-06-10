export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  ANONYMOUS = 'anonymous',
}

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

const ROLE_ROUTE_ACCESS: Record<Role, string[]> = {
  [Role.ADMIN]: ['*'],
  [Role.USER]: ['/dashboard/domain-check', '/profile'],
  [Role.ANONYMOUS]: [],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasPermission(role: Role | null, _resource: string, _action: string): boolean {
  if (!role) return false;
  if (role === Role.ADMIN) return true;
  return true;
}

export function canAccessRoute(
  role: Role | null,
  route: string,
): boolean {
  if (!role) {
    return PUBLIC_ROUTES.some(
      (publicRoute) =>
        route === publicRoute || route.startsWith(publicRoute + '/'),
    );
  }

  if (role === Role.ADMIN) return true;

  const allowedRoutes = ROLE_ROUTE_ACCESS[role] || [];
  if (allowedRoutes.includes('*')) return true;

  return allowedRoutes.some(
    (allowedRoute) =>
      route === allowedRoute || route.startsWith(allowedRoute + '/'),
  );
}
