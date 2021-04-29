'use strict';

const moment = require('moment');

const forwardFrom = 'no-reply@warrenparad.net';
const forwardTo = 'wparad@gmail.com';
const bucket = 'email.warrenparad.net';

const blockedTags = {
	'biologicaldiversity': true,
	'clickup': true, // clickup.com
	'shelling': true
};

exports.handler = function(s3client, sesClient, event) {
	return handleRecord(s3client, sesClient, event.Records[0]);
};

async function handleRecord(s3client, sesClient, record) {
	if(record.eventSource !== 'aws:ses'  || record.eventVersion !== '1.0') {
		console.error('Message is not of the correct versioning "aws:ses" (1.0).');
		return { "disposition" : "STOP_RULE" };
	}

	var msgInfo = record.ses;
	// don't process spam messages
	if (msgInfo.receipt.spamVerdict.status === 'FAIL' || msgInfo.receipt.virusVerdict.status === 'FAIL') {
		return { "disposition" : "CONTINUE" }
	}

	const spf = msgInfo.receipt.spfVerdict && msgInfo.receipt.spfVerdict.status;
	const dkim = msgInfo.receipt.dkimVerdict && msgInfo.receipt.dkimVerdict.status;
	const dmarc = msgInfo.receipt.dmarcVerdict && msgInfo.receipt.dmarcVerdict.status;
	const failCount = +(spf === 'FAIL') +(dkim === 'FAIL') +(dmarc === 'FAIL');
	const passCount = +(spf === 'PASS') +(dkim === 'PASS') +(dmarc === 'PASS');
	if (failCount > 1 && !passCount) {
		return { "disposition" : "CONTINUE" }
	}

	var originalFrom = msgInfo.mail.commonHeaders.from[0];
	var toList = msgInfo.mail.commonHeaders.to.join(', ');

	if (originalFrom.match('k_ngui1@dds.com') || originalFrom.match('Mrs Karen Ngui')) {
		return { "disposition" : "CONTINUE" }
	}

	var amzToList = (msgInfo.receipt.recipients || []).join(', ');
	if (amzToList.match(/rfc@warrenparad.net/)) {
		return { "disposition" : "CONTINUE" }
	}

	for(let index in msgInfo.mail.commonHeaders.to) {
		let toName = msgInfo.mail.commonHeaders.to[index].split('@')[0];
		if (blockedTags[toName.toLowerCase()] || toName.match(/^\d{8}$/) && moment(toName, "YYYYMMDD").add(31, "days") < moment()) {
			return { "disposition" : "CONTINUE" }
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

	var originalTo = msgInfo.mail.commonHeaders.to[0];
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

	try {
		const result = await s3client.getObject({ Bucket: bucket, Key: msgInfo.mail.messageId }).promise();
		var email = result.Body.toString();
		let combinedEmail;
		if (email) {
			var splitEmail = email.split("\r\n\r\n");
			splitEmail.shift();
			combinedEmail = headers + "\r\n" + splitEmail.join("\r\n\r\n");
		}
		else {
			combinedEmail = headers + "\r\n" + "Empty email";
		}

		await sesClient.sendRawEmail({ RawMessage: { Data: combinedEmail } }).promise();
		return { "disposition" : "STOP_RULE" };
	} catch (failure) {
		console.error(`Failed to send email: ${failure}`);
		throw failure;
	}
};