import 'source-map-support/register';

import type {
	CloudFormationCustomResourceHandler,
	CloudFormationCustomResourceEvent,
	Context,
} from 'aws-lambda';
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';
import { createClient } from '@commercetools/sdk-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import fetch from 'node-fetch';

import SubscriptionManager from '../lib/SubscriptionManager';
import { CustomResourceProperties, PhysicalResourceId } from '../lib/types';
import ExtensionManager from '../lib/ExtensionManager';

export const handler: CloudFormationCustomResourceHandler = async (event, context) => {
	try {
		console.log(
			`Event data: ${JSON.stringify({
				ResponseURL: event.ResponseURL,
				PhysicalResourceId:
					event.RequestType !== 'Create'
						? event.PhysicalResourceId
						: context.logStreamName,
				RequestId: event.RequestId,
				LogicalResourceId: event.LogicalResourceId,
			})}`,
		);

		const resourceProperties = event.ResourceProperties as CustomResourceProperties;

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

		const newPhysicalResourceId: PhysicalResourceId = {
			subscriptions: [],
			extensions: [],
		};
		const subscriptionQueueArns: string[] = [];

		if (resourceProperties.subscriptions) {
			await Promise.all(
				resourceProperties.subscriptions.map(async (subConfig, subIndex) => {
					const subKey = `ServerlessLambda_${resourceProperties.fnName}`;

					const subscriptionManager = new SubscriptionManager(apiRoot);

					let oldPhysicalResourceId: PhysicalResourceId | undefined;

					switch (event.RequestType) {
						case 'Create':
							newPhysicalResourceId.subscriptions[
								subIndex
							] = await subscriptionManager.createSubscription(subConfig, subKey);
							subscriptionQueueArns.push(subConfig.queueArn);

							break;

						case 'Update':
							oldPhysicalResourceId = JSON.parse(
								event.PhysicalResourceId,
							) as PhysicalResourceId;
							newPhysicalResourceId.subscriptions[
								subIndex
							] = await subscriptionManager.updateSubscription(
								oldPhysicalResourceId.subscriptions[subIndex],
								subConfig,
								subKey,
							);
							subscriptionQueueArns.push(subConfig.queueArn);

							break;

						case 'Delete':
							oldPhysicalResourceId = JSON.parse(
								event.PhysicalResourceId,
							) as PhysicalResourceId;
							await subscriptionManager.deleteSubscription(
								oldPhysicalResourceId.subscriptions[subIndex],
								subKey,
							);

							break;
					}
				}),
			);
		}

		if (resourceProperties.extensions) {
			await Promise.all(
				resourceProperties.extensions.map(async (extConfig, extIndex) => {
					const extKey = `ServerlessLambda_${resourceProperties.fnName}`;

					const extensionManager = new ExtensionManager(apiRoot);

					let oldPhysicalResourceId: PhysicalResourceId | undefined;

					switch (event.RequestType) {
						case 'Create':
							newPhysicalResourceId.extensions[
								extIndex
							] = await extensionManager.createExtension(extConfig, extKey);

							break;

						case 'Update':
							oldPhysicalResourceId = JSON.parse(
								event.PhysicalResourceId,
							) as PhysicalResourceId;
							newPhysicalResourceId.extensions[
								extIndex
							] = await extensionManager.updateExtension(
								oldPhysicalResourceId.extensions[extIndex],
								extConfig,
								extKey,
							);

							break;

						case 'Delete':
							oldPhysicalResourceId = JSON.parse(
								event.PhysicalResourceId,
							) as PhysicalResourceId;
							await extensionManager.deleteExtension(
								oldPhysicalResourceId.extensions[extIndex],
								extKey,
							);

							break;
					}
				}),
			);
		}

		await sendSuccessResponse(newPhysicalResourceId, { subscriptionQueueArns }, event, context);
	} catch (e) {
		console.error(e);
		await sendFailedResponse(event, context);
	}
};

interface ResponseData {
	subscriptionQueueArns: string[];
}

async function sendSuccessResponse(
	physicalResourceId: PhysicalResourceId,
	data: ResponseData,
	event: CloudFormationCustomResourceEvent,
	context: Context,
) {
	return sendResponse('SUCCESS', physicalResourceId, data, event, context);
}

async function sendFailedResponse(event: CloudFormationCustomResourceEvent, context: Context) {
	return sendResponse('FAILED', undefined, undefined, event, context);
}

async function sendResponse(
	status: 'SUCCESS' | 'FAILED',
	physicalResourceId: PhysicalResourceId | undefined,
	data: ResponseData | undefined,
	event: CloudFormationCustomResourceEvent,
	context: Context,
): Promise<void> {
	const outputs: Record<string, string> = {};
	data?.subscriptionQueueArns?.forEach((arn, i) => {
		outputs[`SubscriptionQueueArn${i + 1}`] = arn;
	});

	const responseBody = JSON.stringify({
		Status: status,
		Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
		PhysicalResourceId: physicalResourceId
			? JSON.stringify(physicalResourceId)
			: event.RequestType !== 'Create'
			? event.PhysicalResourceId
			: context.logStreamName,
		StackId: event.StackId,
		RequestId: event.RequestId,
		LogicalResourceId: event.LogicalResourceId,
		Data: outputs,
	});

	try {
		const res = await fetch(event.ResponseURL, {
			method: 'put',
			body: responseBody,
			headers: {
				'content-type': '',
				'content-length': `${responseBody.length}`,
			},
		});

		console.log('Status code: ' + res.status);
		console.log('Status message: ' + res.statusText);
	} catch (e) {
		console.error('send(..) failed executing https.request(..): ' + e);
	}
}
