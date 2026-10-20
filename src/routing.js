export function isLoginRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/login' || path === '/index.html' || path === '/privacy' || path === '/terms' || path === '/cookies';
}
export function portalDestination(entry) {
  if (entry === 'E-board') return '/app?section=E-board';
  if (entry === 'Admin') return '/app?section=Admin';
  return '/app';
}
