/**
 * Next.js Middleware
 * 
 * Wires the proxy function into Next.js middleware system
 */

import { proxy } from './proxy';

export { proxy as middleware };
export { config } from './proxy';
