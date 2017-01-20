'use strict';

var forwardFrom = 'no-reply@warrenparad.net';
var forwardTo = 'wparad@gmail.com';
var bucket = 'email.warrenparad.net';

exports.handler = function(s3client, sesClient, event) {
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

	var originalFrom = msgInfo.mail.commonHeaders.from[0];
	var originalTo = msgInfo.mail.commonHeaders.to[0];
	var toName = originalTo.split('@')[0];
	if (toName.match(/^\d{8}$/)) {
		//return Promise.resolve('Skipping, due to outdated email address.')
	}
	var headers = "From: " + forwardFrom + "\r\n";
	headers += "Reply-To: " + originalFrom + "\r\n";
	headers += "X-Original-To: " + originalTo + "\r\n";
	headers += "To: " + forwardTo + "\r\n";
	headers += "Subject: " + msgInfo.mail.commonHeaders.subject + " (" + msgInfo.mail.messageId.substring(0, 6) + ")" + "\r\n";

	var headerDictionary = {};
	msgInfo.mail.headers.map(pair => headerDictionary[pair.name] = pair.value );

	if(headerDictionary['Content-Type']) { headers += 'Content-Type: ' + headerDictionary['Content-Type'] + '\r\n'; }
	if(headerDictionary['Content-Transfer-Encoding']) { headers += 'Content-Transfer-Encoding: ' + headerDictionary['Content-Transfer-Encoding'] + '\r\n'; }
	if(headerDictionary['MIME-Version']) { headers += 'MIME-Version: ' + headerDictionary['MIME-Version'] + '\r\n'; }

	return s3client.getObject({
		Bucket: bucket,
		Key: msgInfo.mail.messageId
	}).promise()
	.then(result => {
		var email = result.Body.toString();
		if (email) {
			var splitEmail = email.split("\r\n\r\n");
			splitEmail.shift();
			return headers + "\r\n" + `(FROM: ${originalFrom}, TO: ${originalTo})\r\n` + splitEmail.join("\r\n\r\n");
		}
		else {
			return headers + "\r\n" + `(FROM: ${originalFrom}, TO: ${originalTo})\r\n` + "Empty email";
		}
	})
	.then(email => {
		return sesClient.sendRawEmail({ RawMessage: { Data: email } }).promise()
		.catch((failure) => {
			console.error(`Failed to send email: ${failure}`);
			return Promise.reject(failure);
		});
	});
};