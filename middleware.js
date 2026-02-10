/**
 * Next.js Middleware
 *
 * This file wires the centralized `proxy` auth/route-protection logic
 * (`src/proxy.js`) into Next.js' middleware system.
 *
 * Without this file, `src/proxy.js` will NOT run as middleware in Next.js,
 * which can lead to inconsistent auth behavior and redirect loops.
 */
import { proxy } from './src/proxy';

export async function middleware(request) {
  return proxy(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     * - API routes that don't need auth (handled in proxy function)
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$).*)',
  ],
};

