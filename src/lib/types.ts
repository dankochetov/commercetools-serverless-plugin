import {
	ChangeSubscription,
	ExtensionTrigger,
	MessageSubscription,
} from '@commercetools/platform-sdk';
import { CloudFormationCustomResourceEventCommon } from 'aws-lambda';
import type { IntrinsicFunction } from 'cloudform';

export interface SubscriptionEvent {
	commerceTools: {
		subscription: {
			changes?: ChangeSubscription[];
			messages?: MessageSubscription[];
			batchSize?: number;
			queueUrl?: IntrinsicFunction | string;
			queueArn?: IntrinsicFunction | string;
			createQueue?: boolean;
		};
	};
}

export interface ExtensionEvent {
	commerceTools: {
		extension: {
			timeoutInMs?: number;
			triggers: ExtensionTrigger[];
		};
	};
}

export type CTEvent = SubscriptionEvent | ExtensionEvent;

export type CustomResourceProperties = Omit<
	CloudFormationCustomResourceEventCommon['ResourceProperties'],
	'ServiceToken'
> & {
	ServiceToken: IntrinsicFunction | string;
	fnName: string;
	authHost: string;
	apiHost: string;
	projectKey: string;
	clientId: string;
	clientSecret: string;
	subscriptions?: SubscriptionConfig[];
	extensions?: ExtensionConfig[];
};

export type CustomResourcePropertiesSource = Omit<CustomResourceProperties, 'subscriptions'> & {
	subscriptions: SubscriptionConfigSource[];
};

export interface PhysicalResourceId {
	subscriptions: {
		id: string;
		version: number;
	}[];
	extensions: {
		id: string;
		version: number;
	}[];
}

export interface SubscriptionConfig {
	queueUrl: string;
	queueArn: string;
	accessKey: string;
	secretKey: string;
	region: string;
	changes?: ChangeSubscription[];
	messages?: MessageSubscription[];
}

export type SubscriptionConfigSource = Omit<
	SubscriptionConfig,
	'queueUrl' | 'queueArn' | 'accessKey' | 'secretKey'
> &
	Pick<SubscriptionEvent['commerceTools']['subscription'], 'queueUrl' | 'queueArn'> & {
		accessKey: IntrinsicFunction | string;
		secretKey: IntrinsicFunction | string;
	};

export interface ExtensionConfig {
	lambdaArn: string;
	timeoutInMs?: string;
	accessKey: string;
	secretKey: string;
	triggers: ExtensionTrigger[];
}

export type ExtensionConfigSource = Omit<
	ExtensionConfig,
	'lambdaArn' | 'accessKey' | 'secretKey' | 'timeoutInMs'
> & {
	lambdaArn: IntrinsicFunction | string;
	accessKey: IntrinsicFunction | string;
	secretKey: IntrinsicFunction | string;
	timeoutInMs?: number;
};
