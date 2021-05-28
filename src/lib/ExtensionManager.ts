import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/generated/client/by-project-key-request-builder';
import { ExtensionConfig, PhysicalResourceId } from './types';
import { ExtensionUpdate } from '@commercetools/platform-sdk';

export default class ExtensionManager {
	constructor(private apiRoot: ByProjectKeyRequestBuilder) {}

	createExtension = async (
		extConfig: ExtensionConfig,
		extKey: string,
	): Promise<PhysicalResourceId['extensions'][number]> => {
		const { apiRoot } = this;

		let lastErr: Error | undefined;

		console.log(`Creating extension ${extKey}`);

		for (let attempts = 4; attempts >= 0; --attempts) {
			try {
				const extensionResponse = await apiRoot
					.extensions()
					.post({
						body: {
							key: extKey,
							timeoutInMs: extConfig.timeoutInMs ? +extConfig.timeoutInMs : undefined,
							triggers: extConfig.triggers,
							destination: {
								type: 'AWSLambda',
								arn: extConfig.lambdaArn,
								accessKey: extConfig.accessKey,
								accessSecret: extConfig.secretKey,
							},
						},
					})
					.execute()
					.catch((e) => {
						console.error(JSON.stringify(e));
						throw e;
					});

				console.log(
					`Extension created with ID ${extensionResponse.body.id} and version ${extensionResponse.body.version}`,
				);

				return {
					id: extensionResponse.body.id,
					version: extensionResponse.body.version,
				};
			} catch (e) {
				lastErr = e;

				if (attempts >= 0) {
					console.log(
						`[Attempt ${
							5 - attempts
						}/5] Unable to create the extension; waiting for 5 seconds to try again`,
					);

					await new Promise((resolve) => setTimeout(resolve, 5000));
				}
			}
		}

		throw lastErr;
	};

	updateExtension = async (
		oldPhysicalResourceId: PhysicalResourceId['extensions'][number],
		extConfig: ExtensionConfig,
		extKey: string,
	): Promise<PhysicalResourceId['extensions'][number]> => {
		const { apiRoot } = this;

		console.log(`Updating extension ${extKey}`);

		const oldExt = await apiRoot
			.extensions()
			.withId({ ID: oldPhysicalResourceId.id })
			.get()
			.execute()
			.catch((e) => {
				console.error(JSON.stringify(e));
				throw e;
			});

		const update: ExtensionUpdate = {
			version: oldExt.body.version,
			actions: [
				{ action: 'changeTriggers', triggers: extConfig.triggers },
				{
					action: 'changeDestination',
					destination: {
						type: 'AWSLambda',
						arn: extConfig.lambdaArn,
						accessKey: extConfig.accessKey,
						accessSecret: extConfig.secretKey,
					},
				},
			],
		};

		if (oldExt.body.key !== extKey) {
			update.actions.push({ action: 'setKey', key: extKey });
		}

		if (oldExt.body.timeoutInMs !== extConfig.timeoutInMs) {
			update.actions.push({
				action: 'setTimeoutInMs',
				timeoutInMs: extConfig.timeoutInMs ? +extConfig.timeoutInMs : undefined,
			});
		}

		const res = await apiRoot
			.extensions()
			.withId({ ID: oldPhysicalResourceId.id })
			.post({
				body: update,
			})
			.execute()
			.catch((e) => {
				console.error(JSON.stringify(e));
				throw e;
			});

		const physicalResourceId: PhysicalResourceId['extensions'][number] = {
			id: res.body.id,
			version: res.body.version,
		};

		console.log(
			`Extension with ID ${physicalResourceId.id} and version ${physicalResourceId.version} is updated`,
		);

		return physicalResourceId;
	};

	deleteExtension = async (
		physicalResourceId: PhysicalResourceId['extensions'][number],
		extKey: string,
	) => {
		const { apiRoot } = this;

		console.log(`Deleting extension ${extKey}`);

		try {
			const res = await apiRoot
				.extensions()
				.withId({ ID: physicalResourceId.id })
				.delete({ queryArgs: { version: physicalResourceId.version } })
				.execute()
				.catch((e) => {
					console.error(JSON.stringify(e));
					throw e;
				});

			console.log(
				`Extension with ID ${res.body.id} and version ${res.body.version} is deleted`,
			);
		} catch (e) {
			console.error('Unable to delete the extension: ' + e);
		}
	};
}
