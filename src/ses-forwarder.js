'use strict';

const moment = require('moment');

const forwardFrom = 'no-reply@warrenparad.net';
const forwardTo = 'wparad@gmail.com';
const bucket = 'email.warrenparad.net';

exports.handler = function(s3client, sesClient, event) {
	return Promise.all(event.Records.map(r => handleRecord(s3client, sesClient, r)));
};

function handleRecord(s3client, sesClient, record) {
	if(record.eventSource !== 'aws:ses'  || record.eventVersion !== '1.0') {
		console.error('Message is not of the correct versioning "aws:ses" (1.0).');
	}

	var msgInfo = record.ses;
	// don't process spam messages
	if (msgInfo.receipt.spamVerdict.status === 'FAIL' || msgInfo.receipt.virusVerdict.status === 'FAIL') {
		return Promise.resolve('Message is spam or contains virus, ignoring.')
	}

	const spf = msgInfo.receipt.spfVerdict && msgInfo.receipt.spfVerdict.status;
	const dkim = msgInfo.receipt.dkimVerdict && msgInfo.receipt.dkimVerdict.status;
	const dmarc = msgInfo.receipt.dmarcVerdict && msgInfo.receipt.dmarcVerdict.status;
	const failCount = +(spf === 'FAIL') +(dkim === 'FAIL') +(dmarc === 'FAIL');
	const passCount = +(spf === 'PASS') +(dkim === 'PASS') +(dmarc === 'PASS');
	if (failCount > 1 && !passCount) {
		return Promise.resolve('Message failed some simple validation checks');
	}

	var originalFrom = msgInfo.mail.commonHeaders.from[0];
	var toList = msgInfo.mail.commonHeaders.to.join(', ');

	if (originalFrom.match('k_ngui1@dds.com') || originalFrom.match('Mrs Karen Ngui')) {
		return Promise.resolve('Blocked email address found');
	}

	var originalTo = msgInfo.mail.commonHeaders.to[0];
	var amzToList = (msgInfo.receipt.recipients || []).join(', ');
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
	if (msgInfo.mail.destination && msgInfo.mail.destination.length > 0) {
		headers += 'X-SES-Destination: ' + msgInfo.mail.destination.join(', ')  + "\r\n";
	}
	headers += 'To: "' + formatter(originalTo) + '" <' + forwardTo + '>' + "\r\n";
	headers += "Subject: " + msgInfo.mail.commonHeaders.subject + "\r\n";

	headers += "X-AMZ-Validation-SPF: " + spf + "\r\n";
	headers += "X-AMZ-Validation-DKIM: " + dkim + "\r\n";
	headers += "X-AMZ-Validation-DMARC: " + dmarc + "\r\n";

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