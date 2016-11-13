'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3();
const docClient = new aws.DynamoDB.DocumentClient();
const LambdaForwarder = require('./ses-forwarder');

module.exports = (event, contxet, callback) => {
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

	// Configure the S3 bucket and key prefix for stored raw emails, and the
	// mapping of email addresses to forward from and to.
	//
	// Expected keys/values:
	// - fromEmail: Forwarded emails will come from this verified address
	// - emailBucket: S3 bucket name where SES stores emails.
	// - emailKeyPrefix: S3 key name prefix where SES stores email. Include the
	//	 trailing slash.
	// - forwardMapping: Object where the key is the email address from which to
	//	 forward and the value is an array of email addresses to which to send the
	//	 message.
	var overrides = {
		config: {
			fromEmail: "noreply@example.com",
			emailBucket: "s3-bucket-name",
			emailKeyPrefix: "emailsPrefix/",
			forwardMapping: {
				"info@example.com": [
					"example.john@example.com",
					"example.jen@example.com"
				],
				"abuse@example.com": [
					"example.jim@example.com"
				]
			}
		}
	};
	return LambdaForwarder.handler(event, context, callback, overrides);
};