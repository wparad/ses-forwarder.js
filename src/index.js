'use strict';

const aws = require('aws-sdk');
const docClient = new aws.DynamoDB.DocumentClient();
const LambdaForwarder = require('./ses-forwarder');

module.exports.handler = (event, context, callback) => {
	console.log('RequestLogger', JSON.stringify({event: event, context: context}));
	return LambdaForwarder.handler(new aws.S3(), new aws.SES(), event)
	.then(() => { callback(null, 'Successfully Processed Message'); }, failure => { callback(failure); });
};