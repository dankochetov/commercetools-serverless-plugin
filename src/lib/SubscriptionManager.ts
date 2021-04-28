import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/generated/client/by-project-key-request-builder';
import { PhysicalResourceId, SubscriptionConfig } from './types';
import { SubscriptionUpdate } from '@commercetools/platform-sdk';

export default class SubscriptionManager {
	constructor(private apiRoot: ByProjectKeyRequestBuilder) {}

	createSubscription = async (
		subConfig: SubscriptionConfig,
		subKey: string,
	): Promise<PhysicalResourceId['subscriptions'][number]> => {
		const { apiRoot } = this;

		console.log(`Creating subscription ${subKey}`);

		let lastErr: Error | undefined;

		for (let attempts = 4; attempts >= 0; --attempts) {
			try {
				const subscriptionResponse = await apiRoot
					.subscriptions()
					.post({
						body: {
							key: subKey,
							destination: {
								type: 'SQS',
								queueUrl: subConfig.queueUrl,
								accessKey: subConfig.accessKey,
								accessSecret: subConfig.secretKey,
								region: subConfig.region,
							},
							changes: subConfig.changes,
							messages: subConfig.messages,
						},
					})
					.execute();

				console.log(
					`Subscription created with ID ${subscriptionResponse.body.id} and version ${subscriptionResponse.body.version}`,
				);

				return {
					id: subscriptionResponse.body.id,
					version: subscriptionResponse.body.version,
				};
			} catch (e) {
				lastErr = e;

				if (attempts >= 0) {
					console.log(
						`[Attempt ${
							5 - attempts
						}/5] Unable to create the subscription; waiting for 5 seconds to try again`,
					);
					await new Promise((resolve) => setTimeout(resolve, 5000));
				}
			}
		}

		throw lastErr;
	};

	updateSubscription = async (
		oldPhysicalResourceId: PhysicalResourceId['subscriptions'][number],
		subConfig: SubscriptionConfig,
		subKey: string,
	): Promise<PhysicalResourceId['subscriptions'][number]> => {
		const { apiRoot } = this;

		console.log(`Updating subscription ${subKey}`);

		const oldSub = await apiRoot
			.subscriptions()
			.withId({ ID: oldPhysicalResourceId.id })
			.get()
			.execute();

		const update: SubscriptionUpdate = {
			version: oldSub.body.version,
			actions: [
				{
					action: 'setChanges',
					changes: subConfig.changes,
				},
				{
					action: 'setMessages',
					messages: subConfig.messages,
				},
				{
					action: 'changeDestination',
					destination: {
						type: 'SQS',
						queueUrl: subConfig.queueUrl,
						accessKey: subConfig.accessKey,
						accessSecret: subConfig.secretKey,
						region: subConfig.region,
					},
				},
			],
		};

		if (oldSub.body.key !== subKey) {
			update.actions.push({ action: 'setKey', key: subKey });
		}

		const res = await apiRoot
			.subscriptions()
			.withId({ ID: oldPhysicalResourceId.id })
			.post({
				body: update,
			})
			.execute();

		const physicalResourceId: PhysicalResourceId['subscriptions'][number] = {
			id: res.body.id,
			version: res.body.version,
		};

		console.log(
			`Subscription with ID ${physicalResourceId.id} and version ${physicalResourceId.version} is updated`,
		);

		return physicalResourceId;
	};

	deleteSubscription = async (
		physicalResourceId: PhysicalResourceId['subscriptions'][number],
		subKey: string,
	) => {
		const { apiRoot } = this;

		console.log(`Deleting subscription ${subKey}`);

		try {
			const res = await apiRoot
				.subscriptions()
				.withId({ ID: physicalResourceId.id })
				.delete({ queryArgs: { version: physicalResourceId.version } })
				.execute();

			console.log(
				`Subscription with ID ${res.body.id} and version ${res.body.version} is deleted`,
			);
		} catch (e) {
			console.error('Unable to delete the subscription: ' + e);
		}
	};
}
