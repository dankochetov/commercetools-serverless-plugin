declare module '@commercetools/sdk-client' {
	import { Middleware } from '@commercetools/platform-sdk';

	export interface Client {}

	export function createClient(params: { middlewares: Middleware[] }): Client;
}
