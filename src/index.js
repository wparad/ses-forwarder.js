'use strict';

const aws = require('aws-sdk');
const docClient = new aws.DynamoDB.DocumentClient();
const LambdaForwarder = require('./ses-forwarder');

module.exports.handler = async (event, context) => {
	console.log('RequestLogger', JSON.stringify({event: event, context: context}));
	const result = await LambdaForwarder.handler(new aws.S3(), new aws.SES(), event);
	return result;
};