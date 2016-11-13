'use strict';

const AWS = require('aws-sdk');

var forwardFrom = 'no-reply@warrenparad.net';
var forwardTo = 'wparad@gmail.com';
var bucket = 'email.warrenparad.net';

exports.handler = function(event) {
	var msgInfo = JSON.parse(event.Records[0].ses);
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
	headers += "Subject: Fwd: " + msgInfo.mail.commonHeaders.subject + "(" +  + ")" + "\r\n";

	var headerDictionary = {};
	msgInfo.mail.headers.map(pair => headerDictionary[pair.name] = pair.value );

	if(headerDictionary['Content-Type']) { headers += 'Content-Type: ' + contentType.value; }
	if(headerDictionary['Content-Transfer-Encoding']) { headers += 'Content-Transfer-Encoding: ' + contentType.value; }
	if(headerDictionary['MIME-Version']) { headers += 'MIME-Version: ' + contentType.value; }

	return new AWS.S3().getObject({
		Bucket: bucket,
		Key: msgInfo.mail.messageId
	}).promise()
	.then(result => {
		var email = result.Body.toString();
		if (email) {
			var splitEmail = email.split("\r\n\r\n");
			splitEmail.shift();
			email = headers + "\r\n" + splitEmail.join("\r\n\r\n");
		}
		else {
			email = headers + "\r\n" + "Empty email";
		}
		return email;
	})
	.then(email => {
		return new AWS.SES().sendRawEmail({ RawMessage: { Data: email } }).promise();
	});
};