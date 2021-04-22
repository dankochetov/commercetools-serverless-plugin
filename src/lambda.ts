import 'source-map-support/register';

import type {
	CloudFormationCustomResourceHandler,
	CloudFormationCustomResourceEventCommon,
	CloudFormationCustomResourceEvent,
	Context,
} from 'aws-lambda';
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';
import { createClient } from '@commercetools/sdk-client';
import {
	createApiBuilderFromCtpClient,
	ChangeSubscription,
	MessageSubscription,
	SubscriptionUpdate,
} from '@commercetools/platform-sdk';
import fetch from 'node-fetch';

type ResourceProperties = CloudFormationCustomResourceEventCommon['ResourceProperties'] & {
	fnName: string;
	authHost: string;
	apiHost: string;
	projectKey: string;
	clientId: string;
	clientSecret: string;
	subscription?: {
		queueUrl: string;
		accessKey: string;
		secretKey: string;
		region: string;
		changes: ChangeSubscription[];
		messages: MessageSubscription[];
	};
};

export const handler: CloudFormationCustomResourceHandler = async (event, context) => {
	try {
		const resourceProperties = event.ResourceProperties as ResourceProperties;

		const authMiddleware = createAuthMiddlewareForClientCredentialsFlow({
			host: resourceProperties.authHost,
			projectKey: resourceProperties.projectKey,
			credentials: {
				clientId: resourceProperties.clientId,
				clientSecret: resourceProperties.clientSecret,
			},
			fetch,
		});

		const httpMiddleware = createHttpMiddleware({
			host: resourceProperties.apiHost,
			fetch,
		});

		const ctClient = createClient({
			middlewares: [authMiddleware, httpMiddleware],
		});

		const apiRoot = createApiBuilderFromCtpClient(ctClient).withProjectKey({
			projectKey: resourceProperties.projectKey,
		});

		if (resourceProperties.subscription) {
			const subConfig = resourceProperties.subscription;

			const subKey = `ServerlessLambda_${resourceProperties.fnName}`;

			switch (event.RequestType) {
				case 'Create':
					await (async () => {
						console.log(`Creating subscription for ${resourceProperties.fnName}`);

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

								const physicalResourceId: PhysicalResourceId = {
									subscriptionId: subscriptionResponse.body.id,
									version: subscriptionResponse.body.version,
								};

								await sendResponse('SUCCESS', physicalResourceId, event, context);

								break;
							} catch (e) {
								if (!attempts) {
									throw e;
								}

								console.log(
									`[Attempt ${
										5 - attempts
									}/5] Unable to create the subscription; waiting for 5 seconds to try again`,
								);
								await new Promise((resolve) => setTimeout(resolve, 5000));
							}
						}
					})();

					break;

				case 'Update':
					await (async () => {
						console.log(`Updating subscription for ${resourceProperties.fnName}`);

						const physicalResourceId = JSON.parse(
							event.PhysicalResourceId,
						) as PhysicalResourceId;

						const oldSub = await apiRoot
							.subscriptions()
							.withId({ ID: physicalResourceId.subscriptionId })
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
							.withId({ ID: physicalResourceId.subscriptionId })
							.post({
								body: update,
							})
							.execute();

						physicalResourceId.subscriptionId = res.body.id;
						physicalResourceId.version = res.body.version;

						console.log(
							`Subscription with ID ${physicalResourceId.subscriptionId} and version ${physicalResourceId.version} is updated`,
						);

						await sendResponse('SUCCESS', physicalResourceId, event, context);
					})();

					break;

				case 'Delete':
					await (async () => {
						console.log(`Deleting subscription for ${resourceProperties.fnName}`);

						const physicalResourceId = JSON.parse(
							event.PhysicalResourceId,
						) as PhysicalResourceId;
						try {
							const res = await apiRoot
								.subscriptions()
								.withId({ ID: physicalResourceId.subscriptionId })
								.delete({ queryArgs: { version: physicalResourceId.version } })
								.execute();

							physicalResourceId.subscriptionId = res.body.id;
							physicalResourceId.version = res.body.version;

							console.log(
								`Subscription with ID ${physicalResourceId.subscriptionId} and version ${physicalResourceId.version} is deleted`,
							);
						} catch (e) {
							console.error('Unable to delete the subscription: ' + e);
						} finally {
							await sendResponse('SUCCESS', physicalResourceId, event, context);
						}
					})();

					break;
			}
		}
	} catch (e) {
		console.error(e);
		await sendResponse('FAILED', undefined, event, context);
	}
};

interface PhysicalResourceId {
	subscriptionId: string;
	version: number;
}

async function sendResponse(
	status: 'SUCCESS' | 'FAILED',
	physicalResourceId: PhysicalResourceId | undefined,
	event: CloudFormationCustomResourceEvent,
	context: Context,
): Promise<void> {
	const requestBody = JSON.stringify({
		Status: status,
		Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
		PhysicalResourceId: physicalResourceId
			? JSON.stringify(physicalResourceId)
			: context.logStreamName,
		StackId: event.StackId,
		RequestId: event.RequestId,
		LogicalResourceId: event.LogicalResourceId,
	});

	try {
		const res = await fetch(event.ResponseURL, {
			method: 'put',
			body: requestBody,
			headers: {
				'content-type': '',
				'content-length': `${requestBody.length}`,
			},
		});

		console.log('Status code: ' + res.status);
		console.log('Status message: ' + res.statusText);
	} catch (e) {
		console.error('send(..) failed executing https.request(..): ' + e);
	}
}
