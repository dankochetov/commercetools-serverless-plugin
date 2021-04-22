declare module '@commercetools/sdk-middleware-auth' {
	import { Middleware } from '@commercetools/platform-sdk';
	import fetch from 'node-fetch';

	export function createAuthMiddlewareForClientCredentialsFlow(params: {
		host: string;
		projectKey: string;
		credentials: {
			clientId: string;
			clientSecret: string;
		};
		fetch: typeof fetch;
	}): Middleware;
}
