# CommerceTools Serverless plugin

[![Known Vulnerabilities](https://snyk.io/test/github/dankochetov/commercetools-serverless-plugin/badge.svg)](https://snyk.io/test/github/dankochetov/commercetools-serverless-plugin)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/dankochetov/commercetools-serverless-plugin)

This plugin allows you to seamlessly integrate CommerceTools subscriptions and extensions with Serverless functions.

## Installation [![npm version](https://badge.fury.io/js/%40dankochetov%2Fcommercetools-serverless-plugin.svg)](https://badge.fury.io/js/%40dankochetov%2Fcommercetools-serverless-plugin)
```shell
npm i -D @dankochetov/commercetools-serverless-plugin
```

## Configuration

```yaml 
custom:
  commerceTools:
    projectKey: string
    clientId: string
    clientSecret: string
    authHost: "https://auth.<region>.<provider>.commercetools.com/"
    apiHost: "https://api.<region>.<provider>.commercetools.com/"
```

### Subscription

Only `SQS` destination is supported.

```yaml
functions:
  Subscription:
    events:
      - commerceTools:
          subscription:
            createQueue: true # skip if queueArn is used
            batchSize: <number> # skip if queueArn is used
            queueArn: <arn> # skip if createQueue is used
            changes: # optional
              - resourceTypeId: <resourceTypeId>
              - ...
            messages: # optional
              - resourceTypeId: <resourceTypeId>
              - ...
                
```

If you specify `createQueue: true` option, SQS queue will be created as a part of the current stack. 
Its batch size can be configured with the `batchSize` option and is set to `1` by default.

### Extension

Only `AWSLambda` destination is supported.

```yaml
functions:
  Extension:
    events:
      - commerceTools:
          extension:
            timeoutInMs: 1000 # optional
            triggers:
              - resourceTypeId: cart
                actions:
                  - Create
                  - Update
              - ...
```

## How does it work?

For every subscription/extension configuration, the plugin adds the following list of resources to the template:
- IAM user with minimal permissions and a set of security credentials;
- CFN custom resource that manages the creation, modification and deletion of the subscription/extension;
- (Subscriptions with `createQueue: true` only) SQS queue and corresponding `sqs` event to the function.

## Contribution

After you change the code, don't forget to run `npm run build` to update the artifacts. 
