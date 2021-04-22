declare module '@commercetools/sdk-middleware-http' {
	import { Middleware } from '@commercetools/platform-sdk';
	import fetch from 'node-fetch';

	export function createHttpMiddleware(params: { host: string; fetch: typeof fetch }): Middleware;
}
