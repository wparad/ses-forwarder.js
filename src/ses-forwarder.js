'use strict';

const AWS = require('aws-sdk');

var forwardFrom = 'no-reply@warrenparad.net';
var forwardTo = 'wparad@gmail.com';
var bucket = 'email.warrenparad.net';

exports.handler = function(event) {
	if(event.Records[0].eventSource !== 'aws:ses'  || event.Records[0].eventVersion !== '1.0') {
		return Promise.resolve('Message is not of the correct versioning "aws:ses" (1.0).')
	}
	var msgInfo = event.Records[0].ses;
	// don't process spam messages
	if (msgInfo.receipt.spamVerdict.status === 'FAIL' || msgInfo.receipt.virusVerdict.status === 'FAIL') {
		/*
			"spfVerdict": {
				"status": "PASS"
			},
			"dkimVerdict": {
				"status": "PASS"
			}
		*/
		return Promise.resolve('Message is spam or contains virus, ignoring.')
	}

	var headers = "From: " + forwardFrom + "\r\n";
	headers += "Reply-To: " + msgInfo.mail.commonHeaders.from[0] + "\r\n";
	headers += "X-Original-To: " + msgInfo.mail.commonHeaders.to[0] + "\r\n";
	headers += "To: " + forwardTo + "\r\n";
	headers += "Subject: SES-Fwd: " + msgInfo.mail.commonHeaders.subject + " (" + msgInfo.mail.messageId.substring(0, 6) + ")" + "\r\n";

	var headerDictionary = {};
	msgInfo.mail.headers.map(pair => headerDictionary[pair.name] = pair.value );

	if(headerDictionary['Content-Type']) { headers += 'Content-Type: ' + headerDictionary['Content-Type'] + '\r\n'; }
	if(headerDictionary['Content-Transfer-Encoding']) { headers += 'Content-Transfer-Encoding: ' + headerDictionary['Content-Transfer-Encoding'] + '\r\n'; }
	if(headerDictionary['MIME-Version']) { headers += 'MIME-Version: ' + headerDictionary['MIME-Version'] + '\r\n'; }

	return new AWS.S3().getObject({
		Bucket: bucket,
		Key: msgInfo.mail.messageId
	}).promise()
	.then(result => {
		var email = result.Body.toString();
		if (email) {
			var splitEmail = email.split("\r\n\r\n");
			splitEmail.shift();
			return headers + "\r\n" + splitEmail.join("\r\n\r\n");
		}
		else {
			return headers + "\r\n" + "Empty email";
		}
	})
	.then(email => {
		return new AWS.SES().sendRawEmail({ RawMessage: { Data: email } }).promise();
	});
};