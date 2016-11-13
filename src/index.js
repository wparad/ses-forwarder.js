'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3();
const docClient = new aws.DynamoDB.DocumentClient();
const LambdaForwarder = require('./ses-forwarder');

module.exports.handler = (event, context, callback) => {
	console.log(JSON.stringify({Event: event, Context: context}));
	// return Promise.all(event.Records.map(record => {
	// 	return s3.getObject({
	// 		Bucket: 'email.warrenparad.net',
	// 		Key: record.s3.object.key
	// 	}).promise()
	// 	.then(data => {
	// 		// return docClient.put({
	// 		// 	TableName: 'email.prod',
	// 		// 	Item: {
	// 		// 		EmailId: record.s3.object.key,
	// 		// 		Time: new Date().getTime(),
	// 		// 		Raw: data.Body.toString()
	// 		// 	}
	// 		// }).promise().then(success => {
	// 		// 	return {Key: record.s3.object.key, Success: true} ;
	// 		// });
	// 		return {Key: record.S3.object.Key, Success: true};
	// 	}).catch(failure => {
	// 		console.error(`Failed to Convert: ${record.s3.object.key} because ${failure}`);
	// 		return {Key: record.s3.object.key, Success: false};
	// 	});
	// })).then(files => {
	// 	callback(null, {FilesRead: files});
	// });
	return LambdaForwarder.handler(event)
	.then(() => { callback(null, 'Successfully Processed Message'); }, failure => { callback(failure); });
};