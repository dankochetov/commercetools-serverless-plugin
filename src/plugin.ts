import 'source-map-support/register';

import Serverless from 'serverless';
import type { ChangeSubscription, MessageSubscription } from '@commercetools/platform-sdk';
import path from 'path';
import fs from 'fs-extra';
import type { CloudFormationResource } from 'serverless/plugins/aws/provider/awsProvider';

interface Options {}

interface Config {
	projectKey: string;
	clientId: string;
	clientSecret: string;
	apiHost: string;
	authHost: string;
}

interface CTEvent {
	commerceTools: {
		subscription?: {
			changes: ChangeSubscription[];
			messages: MessageSubscription[];
		} & (
			| {
					queueUrl: { Ref: string } | undefined;
					queueArn: { 'Fn::GetAtt': string[] } | undefined;
					createQueue: false | undefined;
			  }
			| {
					queueUrl: { Ref: string } | undefined;
					queueArn: { 'Fn::GetAtt': string[] } | undefined;
					createQueue: true;
			  }
		);
	};
}

function isCTEvent(e: object): e is CTEvent {
	return e.hasOwnProperty('commerceTools');
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
							items: {
								type: 'object',
								properties: {
									resourceTypeId: { type: 'string' },
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
						createQueue: { type: 'boolean' },
					},
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

	private transformCFResourceName(name: string): string {
		name = name.replace('-', 'Dash').replace('_', 'Underscore');
		return name[0].toUpperCase() + name.slice(1);
	}

	updateFunctionsEvents = () => {
		const { serverless } = this;

		serverless.cli.log('[CommerceTools] Updating functions events...');

		Object.entries(serverless.service.functions).forEach(([fnName, fn]) => {
			let event: CTEvent | undefined;
			fn.events?.forEach((curEvent) => {
				if (!event && isCTEvent(curEvent)) {
					event = curEvent;
				}
			});

			if (!event) return;

			const fnResourceName = this.transformCFResourceName(fnName);

			fn.events.push({
				sqs: {
					arn: {
						'Fn::GetAtt': [`${fnResourceName}SubscriptionQueue`, 'Arn'],
					},
				},
			});
		});
	};

	addResources = () => {
		const { serverless } = this;
		const config = serverless.service.custom.commerceTools as Config;

		Object.entries(serverless.service.functions).forEach(([fnName, fn]) => {
			let event: CTEvent | undefined;
			fn.events?.forEach((curEvent) => {
				if (!event && isCTEvent(curEvent)) {
					event = curEvent;
				}
			});

			if (!event) return;

			serverless.cli.log(`[CommerceTools] Creating resources for ${fnName}...`);

			const fnResourceName = this.transformCFResourceName(fnName);

			const resourceNamePrefix = `${serverless.service.getServiceName()}-${serverless
				.getProvider('aws')
				.getStage()}-`;

			const userResourceName = `${fnResourceName}ServiceUser`;
			const userCredsResourceName = `${userResourceName}Creds`;
			const customResourceName = `${fnResourceName}Subscription`;
			const customResourceLambdaName = `${fnResourceName}SubscriptionTriggerLambdaFunction`;
			const customResourceLambdaRoleName = `${fnResourceName}SubscriptionTriggerRole`;

			const resources = serverless.service.provider.compiledCloudFormationTemplate.Resources;

			const userResource: CloudFormationResource = {
				Type: 'AWS::IAM::User',
				Properties: {
					UserName: `${resourceNamePrefix}${fnName}-ct-user`,
				},
			};

			resources[userResourceName] = userResource;

			const userCredsResource: CloudFormationResource = {
				Type: 'AWS::IAM::AccessKey',
				Properties: {
					Status: 'Active',
					UserName: {
						Ref: userResourceName,
					},
				},
			};

			resources[userCredsResourceName] = userCredsResource;

			if (event.commerceTools.subscription) {
				serverless.cli.log(
					`[CommerceTools] Creating subscription resources for ${fnName}...`,
				);

				if (event.commerceTools.subscription.createQueue) {
					const queueResourceName = `${fnResourceName}SubscriptionQueue`;

					resources[queueResourceName] = {
						Type: 'AWS::SQS::Queue',
						Properties: {
							QueueName: `${resourceNamePrefix}${fnName}-subscription-queue`,
						},
					};

					event.commerceTools.subscription.queueUrl = {
						Ref: queueResourceName,
					};
					event.commerceTools.subscription.queueArn = {
						'Fn::GetAtt': [queueResourceName, 'Arn'],
					};
				}

				userResource.Properties.Policies = [
					{
						PolicyName: 'AllowPushToSQS',
						PolicyDocument: {
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Action: ['sqs:SendMessage'],
									Resource: [event.commerceTools.subscription.queueArn],
								},
							],
						},
					},
				];
			}

			resources[customResourceLambdaRoleName] = {
				Type: 'AWS::IAM::Role',
				Properties: {
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
				},
			};

			if (!this.s3CustomResourceArtifactPath) {
				this.s3CustomResourceArtifactPath =
					path.dirname(
						resources[`${fnResourceName}LambdaFunction`].Properties.Code.S3Key,
					) + '/commercetools-serverless-plugin-custom-resource.zip';
			}

			resources[customResourceLambdaName] = {
				Type: 'AWS::Lambda::Function',
				Properties: {
					Handler: 'lambda.handler',
					Code: {
						S3Bucket: {
							Ref: 'ServerlessDeploymentBucket',
						},
						S3Key: this.s3CustomResourceArtifactPath,
					},
					Timeout: 60,
					Runtime: 'nodejs12.x',
					Role: {
						'Fn::GetAtt': [customResourceLambdaRoleName, 'Arn'],
					},
				},
			};

			resources[customResourceName] = {
				Type: 'Custom::CommerceToolsSubscription',
				Properties: {
					ServiceToken: {
						'Fn::GetAtt': [customResourceLambdaName, 'Arn'],
					},
					fnName,
					authHost: config.authHost,
					apiHost: config.apiHost,
					projectKey: config.projectKey,
					clientId: config.clientId,
					clientSecret: config.clientSecret,
					...(event.commerceTools.subscription
						? {
								subscription: {
									queueUrl: event.commerceTools.subscription.queueUrl,
									accessKey: {
										Ref: userCredsResourceName,
									},
									secretKey: {
										'Fn::GetAtt': [userCredsResourceName, 'SecretAccessKey'],
									},
									region: serverless.service.provider.region,
									messages: event.commerceTools.subscription.messages,
									changes: event.commerceTools.subscription.changes,
								},
						  }
						: {}),
				},
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

	hooks = {
		'before:package:createDeploymentArtifacts': this.updateFunctionsEvents,
		'before:package:finalize': this.addResources,
		'after:aws:deploy:deploy:uploadArtifacts': this.uploadCustomResourceArtifact,
	};
}

module.exports = ServerlessPlugin;
