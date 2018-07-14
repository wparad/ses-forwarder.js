'use strict';

const moment = require('moment');

const forwardFrom = 'no-reply@warrenparad.net';
const forwardTo = 'wparad@gmail.com';
const bucket = 'email.warrenparad.net';

exports.handler = function(s3client, sesClient, event) {
	if(event.Records[0].eventSource !== 'aws:ses'  || event.Records[0].eventVersion !== '1.0') {
		return Promise.resolve('Message is not of the correct versioning "aws:ses" (1.0).')
	}
	var msgInfo = event.Records[0].ses;
	// don't process spam messages
	if (msgInfo.receipt.spamVerdict.status === 'FAIL' || msgInfo.receipt.virusVerdict.status === 'FAIL') {
		return Promise.resolve('Message is spam or contains virus, ignoring.')
	}

	var originalFrom = msgInfo.mail.commonHeaders.from[0];
	var toList = msgInfo.mail.commonHeaders.to.join(', ');
	var originalTo = msgInfo.mail.commonHeaders.to[0];
	var amzToList = msgInfo.receipt.recipients.join(', ');
	for(let index in msgInfo.mail.commonHeaders.to)
	{
		let toName = msgInfo.mail.commonHeaders.to[index].split('@')[0];
		if (toName.match(/^\d{8}$/) && moment(toName, "YYYYMMDD").add(31, "days") < moment()) {
			return Promise.resolve('Skipping, due to outdated email address.')
		}
	}

	let formatter = email => {
		let index = email.indexOf('<');
		if (index > 0) {
			email = email.slice(0, index).trim();
		}
		return email.replace(/"/g, '');
	};

	var headers = 'From: "' + formatter(originalFrom) + '" <' + forwardFrom + '>' + "\r\n";
	headers += "Reply-To: " + originalFrom + "\r\n";
	headers += "X-Original-To: " + toList + "\r\n";
	headers += "X-AMZ-To: " + amzToList + "\r\n";
	headers += "X-AMZ-Id: " + msgInfo.mail.messageId + "\r\n";
	if (msgInfo.mail.destination.length > 0) {
		headers += 'X-SES-Destination: ' + msgInfo.mail.destination.join(', ')  + "\r\n";
	}
	headers += 'To: "' + formatter(originalTo) + '" <' + forwardTo + '>' + "\r\n";
	headers += "Subject: " + msgInfo.mail.commonHeaders.subject + "\r\n";

	headers += "X-AMZ-Validation-SPF: " + msgInfo.receipt.spfVerdict.status + "\r\n";
	headers += "X-AMZ-Validation-DKIM: " + msgInfo.receipt.dkimVerdict.status + "\r\n";
	headers += "X-AMZ-Validation-DMARC: " + msgInfo.receipt.dmarcVerdict.status + "\r\n";

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
			return headers + "\r\n" + splitEmail.join("\r\n\r\n");
		}
		else {
			return headers + "\r\n" + "Empty email";
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