import 'source-map-support/register';

import Serverless from 'serverless';
import path from 'path';
import fs from 'fs-extra';
import { IAM, Lambda, SQS, Fn } from 'cloudform-types';
import type { Policy as IAMUserPolicy } from 'cloudform-types/types/iam/user';

import {
	CTEvent,
	CustomResourcePropertiesSource,
	ExtensionEvent,
	SubscriptionEvent,
} from './lib/types';

interface Options {}

interface Config {
	projectKey: string;
	clientId: string;
	clientSecret: string;
	apiHost: string;
	authHost: string;
}

function isCTEvent(e: object): e is CTEvent {
	return Object.prototype.hasOwnProperty.call(e, 'commerceTools');
}

function isSubscriptionEvent(e: object): e is SubscriptionEvent {
	return isCTEvent(e) && Object.prototype.hasOwnProperty.call(e.commerceTools, 'subscription');
}

function isExtensionEvent(e: object): e is ExtensionEvent {
	return isCTEvent(e) && Object.prototype.hasOwnProperty.call(e.commerceTools, 'extension');
}

class ServerlessPlugin {
	commands = {};

	private s3CustomResourceArtifactPath: string | undefined;

	constructor(public serverless: Serverless, public options: Options) {
		serverless.configSchemaHandler.defineFunctionEvent('aws', 'commerceTools', {
			type: 'object',
			properties: {
				subscription: {
					type: 'object',
					properties: {
						changes: {
							type: 'array',
							minItems: 1,
							items: {
								type: 'object',
								properties: {
									resourceTypeId: { type: 'string' },
								},
								required: ['resourceTypeId'],
								additionalProperties: false,
							},
						},
						messages: {
							type: 'array',
							minItems: 1,
							items: {
								type: 'object',
								properties: {
									resourceTypeId: { type: 'string' },
									types: {
										type: 'array',
										minItems: 1,
										items: { type: 'string' },
									},
								},
								required: ['resourceTypeId'],
								additionalProperties: false,
							},
						},
						queueUrl: {
							oneOf: [{ type: 'string' }, { type: 'object' }],
						},
						queueArn: {
							oneOf: [{ type: 'string' }, { type: 'object' }],
						},
						batchSize: { type: 'number' },
						createQueue: { type: 'boolean' },
					},
					anyOf: [{ required: ['changes'] }, { required: ['messages'] }],
				},
				extension: {
					type: 'object',
					properties: {
						timeoutInMs: { type: 'integer', minimum: 1, maximum: 2000 },
						triggers: {
							type: 'array',
							minItems: 1,
							items: {
								type: 'object',
								properties: {
									resourceTypeId: { type: 'string' },
									actions: {
										type: 'array',
										minItems: 1,
										maxItems: 2,
										uniqueItems: true,
										items: {
											type: 'string',
											enum: ['Create', 'Update'],
										},
									},
								},
								required: ['resourceTypeId', 'actions'],
								additionalProperties: false,
							},
						},
					},
					required: ['triggers'],
					additionalProperties: false,
				},
			},
			additionalProperties: false,
		});

		serverless.configSchemaHandler.defineCustomProperties({
			type: 'object',
			properties: {
				commerceTools: {
					type: 'object',
					properties: {
						projectKey: { type: 'string' },
						clientId: { type: 'string' },
						clientSecret: { type: 'string' },
						apiHost: { type: 'string' },
						authHost: { type: 'string' },
					},
					required: ['projectKey', 'clientId', 'clientSecret', 'apiHost', 'authHost'],
				},
			},
			required: ['commerceTools'],
		});
	}

	updateFunctionsEvents = () => {
		const { serverless } = this;

		const fns = this.listFunctions();
		const subsList = Object.entries(fns).filter(([, { events }]) =>
			events.some(isSubscriptionEvent),
		);
		const extsList = Object.entries(fns).filter(([, { events }]) =>
			events.some(isExtensionEvent),
		);

		if (subsList.length || extsList.length) {
			serverless.cli.log('CommerceTools functions found:');
			subsList.forEach(([fnName, { events }]) =>
				serverless.cli.log(`  - ${fnName} - ${events.length} subscription(s)`),
			);
			extsList.forEach(([fnName, { events }]) =>
				serverless.cli.log(`  - ${fnName} - ${events.length} extension(s)`),
			);
		}

		Object.entries(fns).forEach(([fnName, { fn, events }]) => {
			const fnResourceName = this.transformCFNResourceName(fnName);

			events.filter(isSubscriptionEvent).forEach((event, eventIndex) => {
				fn.events.push({
					sqs: {
						arn: Fn.GetAtt(
							this.getCustomResourceName(fnResourceName),
							`SubscriptionQueueArn${eventIndex + 1}`,
						).toJSON(),
						batchSize: event.commerceTools.subscription.batchSize ?? 1,
					},
				});
			});
		});
	};

	addResources = () => {
		const { serverless } = this;
		const config = serverless.service.custom.commerceTools as Config;
		const resources = serverless.service.provider.compiledCloudFormationTemplate.Resources;

		Object.entries(this.listFunctions()).forEach(([fnName, { events }]) => {
			serverless.cli.log(`[CommerceTools] Creating resources for ${fnName}...`);

			const fnResourceName = this.transformCFNResourceName(fnName);

			const resourceNamePrefix = `${serverless.service.getServiceName()}-${serverless
				.getProvider('aws')
				.getStage()}-`;

			let subscriptionEventIndex = 0;
			let extensionEventIndex = 0;

			events.forEach((event) => {
				let eventType: 'Subscription' | 'Extension';
				let eventIndex: number;
				switch (true) {
					case isSubscriptionEvent(event):
						eventType = 'Subscription';
						eventIndex = subscriptionEventIndex++;
						break;
					case isExtensionEvent(event):
						eventType = 'Extension';
						eventIndex = extensionEventIndex++;
						break;
					default:
						throw new Error('unknown event type');
				}

				const userResourceName = this.getUserResourceName(
					fnResourceName,
					eventType,
					eventIndex,
				);
				const userCredsResourceName = this.getUserCredsResourceName(
					fnResourceName,
					eventType,
					eventIndex,
				);

				const userResource = new IAM.User({
					UserName: `${resourceNamePrefix}${fnName}${eventType}${eventIndex + 1}`,
				});
				resources[userResourceName] = userResource;

				resources[userCredsResourceName] = new IAM.AccessKey({
					Status: 'Active',
					UserName: Fn.Ref(userResourceName),
				});

				const userPolicies: IAMUserPolicy[] = [];

				if (isSubscriptionEvent(event) && event.commerceTools.subscription.createQueue) {
					const queueResourceName = `${fnResourceName}SubscriptionQueue${eventIndex + 1}`;

					resources[queueResourceName] = new SQS.Queue({
						QueueName: `${resourceNamePrefix}${fnName}-subscription-queue-${
							eventIndex + 1
						}`,
					});

					event.commerceTools.subscription.queueUrl = Fn.Ref(queueResourceName);
					event.commerceTools.subscription.queueArn = Fn.GetAtt(queueResourceName, 'Arn');

					userPolicies.push(
						new IAM.User.Policy({
							PolicyName: 'AllowPushToSQS',
							PolicyDocument: {
								Version: '2012-10-17',
								Statement: [
									{
										Effect: 'Allow',
										Action: 'sqs:SendMessage',
										Resource: event.commerceTools.subscription.queueArn,
									},
								],
							},
						}),
					);
				}

				if (isExtensionEvent(event)) {
					userPolicies.push(
						new IAM.User.Policy({
							PolicyName: 'AllowLambdaInvoke',
							PolicyDocument: {
								Version: '2012-10-17',
								Statement: [
									{
										Effect: 'Allow',
										Action: 'lambda:InvokeFunction',
										Resource: Fn.GetAtt(
											`${fnResourceName}LambdaFunction`,
											'Arn',
										),
									},
								],
							},
						}),
					);
				}

				userResource.Properties.Policies = userPolicies;
			});

			const customResourceName = this.getCustomResourceName(fnResourceName);
			const customResourceLambdaName = `${customResourceName}LambdaFunction`;
			const customResourceLambdaRoleName = `${customResourceName}Role`;

			resources[customResourceLambdaRoleName] = new IAM.Role({
				AssumeRolePolicyDocument: {
					Version: '2012-10-17',
					Statement: [
						{
							Effect: 'Allow',
							Principal: {
								Service: ['lambda.amazonaws.com'],
							},
							Action: ['sts:AssumeRole'],
						},
					],
				},
				ManagedPolicyArns: [
					'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
				],
			});

			if (!this.s3CustomResourceArtifactPath) {
				this.s3CustomResourceArtifactPath =
					path.dirname(
						resources[`${fnResourceName}LambdaFunction`].Properties.Code.S3Key,
					) + '/commercetools-serverless-plugin-custom-resource.zip';
			}

			resources[customResourceLambdaName] = new Lambda.Function({
				Handler: 'lambda.handler',
				FunctionName:
					`${resourceNamePrefix}${fnName}`.slice(0, 64 - '-custom-resource'.length) +
					'-custom-resource',
				Code: {
					S3Bucket: Fn.Ref('ServerlessDeploymentBucket'),
					S3Key: this.s3CustomResourceArtifactPath,
				},
				Timeout: 60,
				Runtime: 'nodejs12.x',
				Role: Fn.GetAtt(customResourceLambdaRoleName, 'Arn'),
			});

			const customResourceProperties: CustomResourcePropertiesSource = {
				ServiceToken: Fn.GetAtt(customResourceLambdaName, 'Arn'),
				fnName,
				authHost: config.authHost,
				apiHost: config.apiHost,
				projectKey: config.projectKey,
				clientId: config.clientId,
				clientSecret: config.clientSecret,
				subscriptions: events.filter(isSubscriptionEvent).map((event, eventIndex) => ({
					queueUrl: event.commerceTools.subscription.queueUrl,
					queueArn: event.commerceTools.subscription.queueArn,
					accessKey: Fn.Ref(
						this.getUserCredsResourceName(fnResourceName, 'Subscription', eventIndex),
					),
					secretKey: Fn.GetAtt(
						this.getUserCredsResourceName(fnResourceName, 'Subscription', eventIndex),
						'SecretAccessKey',
					),
					region: serverless.service.provider.region,
					messages: event.commerceTools.subscription.messages,
					changes: event.commerceTools.subscription.changes,
				})),
				extensions: events.filter(isExtensionEvent).map((event, eventIndex) => ({
					lambdaArn: Fn.GetAtt(`${fnResourceName}LambdaFunction`, 'Arn'),
					timeoutInMs: event.commerceTools.extension.timeoutInMs,
					accessKey: Fn.Ref(
						this.getUserCredsResourceName(fnResourceName, 'Extension', eventIndex),
					),
					secretKey: Fn.GetAtt(
						this.getUserCredsResourceName(fnResourceName, 'Extension', eventIndex),
						'SecretAccessKey',
					),
					triggers: event.commerceTools.extension.triggers,
				})),
			};

			resources[customResourceName] = {
				Type: 'Custom::CommerceToolsSubscription',
				Properties: customResourceProperties,
			};
		});
	};

	uploadCustomResourceArtifact = async () => {
		this.serverless.cli.log('[CommerceTools] Uploading custom resource artifact...');

		await this.serverless.getProvider('aws').request('S3', 'upload', {
			Body: fs.createReadStream(path.join(__dirname, 'lambda.zip')),
			Bucket: await this.serverless.getProvider('aws').getServerlessDeploymentBucketName(),
			Key: this.s3CustomResourceArtifactPath!,
		});
	};

	private listFunctions() {
		const { serverless } = this;
		const res: Record<
			string,
			{
				fn: Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage;
				events: CTEvent[];
			}
		> = {};

		Object.entries(serverless.service.functions).forEach(([fnName, fn]) => {
			fn.events?.forEach((event) => {
				if (isCTEvent(event)) {
					if (!res[fnName]) {
						res[fnName] = {
							fn,
							events: [],
						};
					}
					res[fnName].events.push(event);
				}
			});
		});

		return res;
	}

	private transformCFNResourceName(name: string): string {
		name = name.replace('-', 'Dash').replace('_', 'Underscore');
		return name[0].toUpperCase() + name.slice(1);
	}

	private getCustomResourceName(fnResourceName: string): string {
		return `${fnResourceName}CommerceToolsResource`;
	}

	private getUserResourceName(
		fnResourceName: string,
		eventType: 'Subscription' | 'Extension',
		eventIndex: number,
	): string {
		return `${fnResourceName}${eventType}ServiceUser${eventIndex + 1}`;
	}

	private getUserCredsResourceName(
		fnResourceName: string,
		eventType: 'Subscription' | 'Extension',
		eventIndex: number,
	): string {
		return `${fnResourceName}${eventType}ServiceUserCreds${eventIndex + 1}`;
	}

	hooks = {
		'before:package:createDeploymentArtifacts': this.updateFunctionsEvents,
		'before:package:finalize': this.addResources,
		'after:aws:deploy:deploy:uploadArtifacts': this.uploadCustomResourceArtifact,
	};
}

module.exports = ServerlessPlugin;
