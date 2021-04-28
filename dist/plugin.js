parcelRequire=function(e,r,t,n){var i,o="function"==typeof parcelRequire&&parcelRequire,u="function"==typeof require&&require;function f(t,n){if(!r[t]){if(!e[t]){var i="function"==typeof parcelRequire&&parcelRequire;if(!n&&i)return i(t,!0);if(o)return o(t,!0);if(u&&"string"==typeof t)return u(t);var c=new Error("Cannot find module '"+t+"'");throw c.code="MODULE_NOT_FOUND",c}p.resolve=function(r){return e[t][1][r]||r},p.cache={};var l=r[t]=new f.Module(t);e[t][0].call(l.exports,p,l,l.exports,this)}return r[t].exports;function p(e){return f(p.resolve(e))}}f.isParcelRequire=!0,f.Module=function(e){this.id=e,this.bundle=f,this.exports={}},f.modules=e,f.cache=r,f.parent=o,f.register=function(r,t){e[r]=[function(e,r){r.exports=t},{}]};for(var c=0;c<t.length;c++)try{f(t[c])}catch(e){i||(i=e)}if(t.length){var l=f(t[t.length-1]);"object"==typeof exports&&"undefined"!=typeof module?module.exports=l:"function"==typeof define&&define.amd?define(function(){return l}):n&&(this[n]=l)}if(parcelRequire=f,i)throw i;return f}({"NfXO":[function(require,module,exports) {
"use strict";var e=this&&this.__awaiter||function(e,t,r,o){return new(r||(r=Promise))(function(s,n){function i(e){try{u(o.next(e))}catch(t){n(t)}}function c(e){try{u(o.throw(e))}catch(t){n(t)}}function u(e){var t;e.done?s(e.value):(t=e.value,t instanceof r?t:new r(function(e){e(t)})).then(i,c)}u((o=o.apply(e,t||[])).next())})},t=this&&this.__generator||function(e,t){var r,o,s,n,i={label:0,sent:function(){if(1&s[0])throw s[1];return s[1]},trys:[],ops:[]};return n={next:c(0),throw:c(1),return:c(2)},"function"==typeof Symbol&&(n[Symbol.iterator]=function(){return this}),n;function c(n){return function(c){return function(n){if(r)throw new TypeError("Generator is already executing.");for(;i;)try{if(r=1,o&&(s=2&n[0]?o.return:n[0]?o.throw||((s=o.return)&&s.call(o),0):o.next)&&!(s=s.call(o,n[1])).done)return s;switch(o=0,s&&(n=[2&n[0],s.value]),n[0]){case 0:case 1:s=n;break;case 4:return i.label++,{value:n[1],done:!1};case 5:i.label++,o=n[1],n=[0];continue;case 7:n=i.ops.pop(),i.trys.pop();continue;default:if(!(s=(s=i.trys).length>0&&s[s.length-1])&&(6===n[0]||2===n[0])){i=0;continue}if(3===n[0]&&(!s||n[1]>s[0]&&n[1]<s[3])){i.label=n[1];break}if(6===n[0]&&i.label<s[1]){i.label=s[1],s=n;break}if(s&&i.label<s[2]){i.label=s[2],i.ops.push(n);break}s[2]&&i.ops.pop(),i.trys.pop();continue}n=t.call(e,i)}catch(c){n=[6,c],o=0}finally{r=s=0}if(5&n[0])throw n[1];return{value:n[0]?n[1]:void 0,done:!0}}([n,c])}}},r=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),require("source-map-support/register");var o=r(require("path")),s=r(require("fs-extra")),n=require("cloudform-types");function i(e){return Object.prototype.hasOwnProperty.call(e,"commerceTools")}function c(e){return i(e)&&Object.prototype.hasOwnProperty.call(e.commerceTools,"subscription")}function u(e){return i(e)&&Object.prototype.hasOwnProperty.call(e.commerceTools,"extension")}var a=function(){function r(r,i){var a=this;this.serverless=r,this.options=i,this.commands={},this.updateFunctionsEvents=function(){var e=a.serverless,t=a.listFunctions(),r=Object.entries(t).filter(function(e){return e[1].events.some(c)}),o=Object.entries(t).filter(function(e){return e[1].events.some(u)});(r.length||o.length)&&(e.cli.log("CommerceTools functions found:"),r.forEach(function(t){var r=t[0],o=t[1].events;return e.cli.log("  - "+r+" - "+o.length+" subscription(s)")}),o.forEach(function(t){var r=t[0],o=t[1].events;return e.cli.log("  - "+r+" - "+o.length+" extension(s)")})),Object.entries(t).forEach(function(e){var t=e[0],r=e[1],o=r.fn,s=r.events,i=a.transformCFNResourceName(t);s.filter(c).forEach(function(e,t){var r;o.events.push({sqs:{arn:n.Fn.GetAtt(a.getCustomResourceName(i),"SubscriptionQueueArn"+(t+1)).toJSON(),batchSize:null!==(r=e.commerceTools.subscription.batchSize)&&void 0!==r?r:1}})})})},this.addResources=function(){var e=a.serverless,t=e.service.custom.commerceTools,r=e.service.provider.compiledCloudFormationTemplate.Resources;Object.entries(a.listFunctions()).forEach(function(s){var i=s[0],l=s[1].events;e.cli.log("[CommerceTools] Creating resources for "+i+"...");var p=a.transformCFNResourceName(i),m=e.service.getServiceName()+"-"+e.getProvider("aws").getStage()+"-",f=0,d=0;l.forEach(function(e){var t,o;switch(!0){case c(e):t="Subscription",o=f++;break;case u(e):t="Extension",o=d++;break;default:throw new Error("unknown event type")}var s=a.getUserResourceName(p,t,o),l=a.getUserCredsResourceName(p,t,o),y=new n.IAM.User({UserName:""+m+i+t+(o+1)});r[s]=y,r[l]=new n.IAM.AccessKey({Status:"Active",UserName:n.Fn.Ref(s)});var h=[];if(c(e)&&e.commerceTools.subscription.createQueue){var v=p+"SubscriptionQueue"+(o+1);r[v]=new n.SQS.Queue({QueueName:""+m+i+"-subscription-queue-"+(o+1)}),e.commerceTools.subscription.queueUrl=n.Fn.Ref(v),e.commerceTools.subscription.queueArn=n.Fn.GetAtt(v,"Arn"),h.push(new n.IAM.User.Policy({PolicyName:"AllowPushToSQS",PolicyDocument:{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:"sqs:SendMessage",Resource:e.commerceTools.subscription.queueArn}]}}))}u(e)&&h.push(new n.IAM.User.Policy({PolicyName:"AllowLambdaInvoke",PolicyDocument:{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:"lambda:InvokeFunction",Resource:n.Fn.GetAtt(p+"LambdaFunction","Arn")}]}})),y.Properties.Policies=h});var y=a.getCustomResourceName(p),h=y+"LambdaFunction",v=y+"Role";r[v]=new n.IAM.Role({AssumeRolePolicyDocument:{Version:"2012-10-17",Statement:[{Effect:"Allow",Principal:{Service:["lambda.amazonaws.com"]},Action:["sts:AssumeRole"]}]},ManagedPolicyArns:["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]}),a.s3CustomResourceArtifactPath||(a.s3CustomResourceArtifactPath=o.default.dirname(r[p+"LambdaFunction"].Properties.Code.S3Key)+"/commercetools-serverless-plugin-custom-resource.zip"),r[h]=new n.Lambda.Function({Handler:"lambda.handler",FunctionName:(""+m+i).slice(0,64-"-custom-resource".length)+"-custom-resource",Code:{S3Bucket:n.Fn.Ref("ServerlessDeploymentBucket"),S3Key:a.s3CustomResourceArtifactPath},Timeout:60,Runtime:"nodejs12.x",Role:n.Fn.GetAtt(v,"Arn")});var b={ServiceToken:n.Fn.GetAtt(h,"Arn"),fnName:i,authHost:t.authHost,apiHost:t.apiHost,projectKey:t.projectKey,clientId:t.clientId,clientSecret:t.clientSecret,subscriptions:l.filter(c).map(function(t,r){return{queueUrl:t.commerceTools.subscription.queueUrl,queueArn:t.commerceTools.subscription.queueArn,accessKey:n.Fn.Ref(a.getUserCredsResourceName(p,"Subscription",r)),secretKey:n.Fn.GetAtt(a.getUserCredsResourceName(p,"Subscription",r),"SecretAccessKey"),region:e.service.provider.region,messages:t.commerceTools.subscription.messages,changes:t.commerceTools.subscription.changes}}),extensions:l.filter(u).map(function(e,t){return{lambdaArn:n.Fn.GetAtt(p+"LambdaFunction","Arn"),timeoutInMs:e.commerceTools.extension.timeoutInMs,accessKey:n.Fn.Ref(a.getUserCredsResourceName(p,"Extension",t)),secretKey:n.Fn.GetAtt(a.getUserCredsResourceName(p,"Extension",t),"SecretAccessKey"),triggers:e.commerceTools.extension.triggers}})};r[y]={Type:"Custom::CommerceToolsSubscription",Properties:b}})},this.uploadCustomResourceArtifact=function(){return e(a,void 0,void 0,function(){var e,r,n,i;return t(this,function(t){switch(t.label){case 0:return this.serverless.cli.log("[CommerceTools] Uploading custom resource artifact..."),r=(e=this.serverless.getProvider("aws")).request,n=["S3","upload"],i={Body:s.default.createReadStream(o.default.join(__dirname,"lambda.zip"))},[4,this.serverless.getProvider("aws").getServerlessDeploymentBucketName()];case 1:return[4,r.apply(e,n.concat([(i.Bucket=t.sent(),i.Key=this.s3CustomResourceArtifactPath,i)]))];case 2:return t.sent(),[2]}})})},this.hooks={"before:package:createDeploymentArtifacts":this.updateFunctionsEvents,"before:package:finalize":this.addResources,"after:aws:deploy:deploy:uploadArtifacts":this.uploadCustomResourceArtifact},r.configSchemaHandler.defineFunctionEvent("aws","commerceTools",{type:"object",properties:{subscription:{type:"object",properties:{changes:{type:"array",minItems:1,items:{type:"object",properties:{resourceTypeId:{type:"string"}},required:["resourceTypeId"],additionalProperties:!1}},messages:{type:"array",minItems:1,items:{type:"object",properties:{resourceTypeId:{type:"string"}},required:["resourceTypeId"],additionalProperties:!1}},queueUrl:{oneOf:[{type:"string"},{type:"object"}]},queueArn:{oneOf:[{type:"string"},{type:"object"}]},batchSize:{type:"number"},createQueue:{type:"boolean"}},anyOf:[{required:["changes"]},{required:["messages"]}]},extension:{type:"object",properties:{timeoutInMs:{type:"integer",minimum:1,maximum:2e3},triggers:{type:"array",minItems:1,items:{type:"object",properties:{resourceTypeId:{type:"string"},actions:{type:"array",minItems:1,maxItems:2,uniqueItems:!0,items:{type:"string",enum:["Create","Update"]}}},required:["resourceTypeId","actions"],additionalProperties:!1}}},required:["triggers"],additionalProperties:!1}},additionalProperties:!1}),r.configSchemaHandler.defineCustomProperties({type:"object",properties:{commerceTools:{type:"object",properties:{projectKey:{type:"string"},clientId:{type:"string"},clientSecret:{type:"string"},apiHost:{type:"string"},authHost:{type:"string"}},required:["projectKey","clientId","clientSecret","apiHost","authHost"]}},required:["commerceTools"]})}return r.prototype.listFunctions=function(){var e=this.serverless,t={};return Object.entries(e.service.functions).forEach(function(e){var r,o=e[0],s=e[1];null===(r=s.events)||void 0===r||r.forEach(function(e){i(e)&&(t[o]||(t[o]={fn:s,events:[]}),t[o].events.push(e))})}),t},r.prototype.transformCFNResourceName=function(e){return(e=e.replace("-","Dash").replace("_","Underscore"))[0].toUpperCase()+e.slice(1)},r.prototype.getCustomResourceName=function(e){return e+"CommerceToolsResource"},r.prototype.getUserResourceName=function(e,t,r){return""+e+t+"ServiceUser"+(r+1)},r.prototype.getUserCredsResourceName=function(e,t,r){return""+e+t+"ServiceUserCreds"+(r+1)},r}();module.exports=a;
},{}]},{},["NfXO"], null)
//# sourceMappingURL=/plugin.js.map