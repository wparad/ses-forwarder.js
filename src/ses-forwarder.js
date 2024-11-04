const { DateTime } = require('luxon');
const logger = require('./logger');

const forwardFrom = 'no-reply@warrenparad.net';
process.env.WARRENS_PERSONAL_EMAIL = '';
const forwardTo = process.env.WARRENS_PERSONAL_EMAIL;
const bucket = process.env.BucketName;

const blockedTags = {
  biologicaldiversity: true,
  clickup: true, // clickup.com
  shelling: true,
  lambdatest: true, // lambdatest.com,
  cryptobill: true
};

exports.handler = async function(s3client, sesClient, event) {
  logger.log({ title: 'Starting email handling' });
  const result = await handleRecord(s3client, sesClient, event.Records[0]);
  logger.log({ title: 'Result: ', event, result, messageId: event.Records[0].ses.mail.messageId });
  return result;
};

async function handleRecord(s3client, sesClient, record) {
  if (record.eventSource !== 'aws:ses' || record.eventVersion !== '1.0') {
    logger.log({ title: 'Message is not of the correct versioning "aws:ses" (1.0).' });
    return { disposition: 'STOP_RULE' };
  }

  let msgInfo = record.ses;
  // don't process spam messages
  if (msgInfo.receipt.spamVerdict.status === 'FAIL' || msgInfo.receipt.virusVerdict.status === 'FAIL') {
    return { disposition: 'CONTINUE' };
  }

  const spf = msgInfo.receipt.spfVerdict && msgInfo.receipt.spfVerdict.status;
  const dkim = msgInfo.receipt.dkimVerdict && msgInfo.receipt.dkimVerdict.status;
  const dmarc = msgInfo.receipt.dmarcVerdict && msgInfo.receipt.dmarcVerdict.status;
  const failCount = +(spf === 'FAIL') + (dkim === 'FAIL') + (dmarc === 'FAIL');
  const passCount = +(spf === 'PASS') + (dkim === 'PASS') + (dmarc === 'PASS');
  if (failCount > 1 && !passCount) {
    return { disposition: 'CONTINUE' };
  }

  let originalFrom = msgInfo.mail.commonHeaders.from[0];
  const mappedTo = msgInfo.mail.commonHeaders.to || msgInfo.receipt.recipients || [];
  let toList = mappedTo.join(', ');

  if (originalFrom.match('k_ngui1@dds.com') || originalFrom.match('Mrs Karen Ngui')) {
    return { disposition: 'CONTINUE' };
  }

  let amzToList = (msgInfo.receipt.recipients || []);
  const amzToListString = amzToList.join(', ');
  if (amzToListString.match(/rfc@warrenparad.net/)) {
    return { disposition: 'CONTINUE' };
  }

  for (const email of amzToList) {
    let toName = email.split('@')[0];
    if (blockedTags[toName.toLowerCase()] || toName.match(/^[-\d]{8,}$/) && DateTime.fromFormat(toName.replace(/-/g, ''), 'yyyyMMdd').plus({ days: 31 }) < DateTime.utc()) {
      return { disposition: 'CONTINUE' };
    }
  }

  let formatter = emailRaw => {
    let email = emailRaw;
    let index = email.indexOf('<');
    if (index > 0) {
      email = email.slice(0, index).trim();
    }
    return email.replace(/"/g, '');
  };

  let headers = '';
  headers += `X-SES-Sender-S3-Object-Id: ${msgInfo.mail.messageId}\r\n`;
  if (amzToListString) { headers += `X-AMZ-To: ${amzToListString}\r\n`; }
  if (msgInfo.mail.destination && msgInfo.mail.destination.length > 0) {
    headers += `X-SES-Destination: ${msgInfo.mail.destination.join(', ')}\r\n`;
  }

  if (spf !== undefined) { headers += `X-AMZ-Validation-SPF: ${spf}\r\n`; }
  if (dkim !== undefined) { headers += `X-AMZ-Validation-DKIM: ${dkim}\r\n`; }
  if (dmarc !== undefined) { headers += `X-AMZ-Validation-DMARC: ${dmarc}\r\n`; }

  headers += `X-SES-Original-Lambda-Event: ${Buffer.from(JSON.stringify(record)).toString('base64')}\r\n`;

  let headerDictionary = {};
  msgInfo.mail.headers.map(pair => headerDictionary[pair.name] = pair.value);

  if (headerDictionary['Content-Type']) { headers += `Content-Type: ${headerDictionary['Content-Type']}\r\n`; }
  if (headerDictionary['Content-Transfer-Encoding']) { headers += `Content-Transfer-Encoding: ${headerDictionary['Content-Transfer-Encoding']}\r\n`; }
  if (headerDictionary['MIME-Version']) { headers += `MIME-Version: ${headerDictionary['MIME-Version']}\r\n`; }

  // Move these down in case there is something weird on these headers;
  let originalTo = mappedTo[0];
  headers += `To: "${formatter(originalTo)}" <${forwardTo}>` + '\r\n';
  headers += `Subject: ${msgInfo.mail.commonHeaders.subject}\r\n`;
  headers += `From: "${formatter(originalFrom)}" <${forwardFrom}>` + '\r\n';
  headers += `Reply-To: ${originalFrom}\r\n`;
  headers += `X-Original-To: ${toList}\r\n`;

  try {
    const result = await s3client.getObject({ Bucket: bucket, Key: `Incoming/${msgInfo.mail.messageId}` }).promise();
    let email = result.Body.toString();
    let combinedEmail;
    if (email) {
      let splitEmail = email.split('\r\n\r\n');
      splitEmail.shift();
      combinedEmail = `${headers}\r\n${splitEmail.join('\r\n\r\n')}`;
    } else {
      combinedEmail = `${headers}\r\n` + 'Empty email';
    }

    await sesClient.sendRawEmail({ RawMessage: { Data: combinedEmail } }).promise();
    return { disposition: 'STOP_RULE' };
  } catch (failure) {
    logger.log({ title: `Failed to send email: ${failure}` });
    throw failure;
  }
}
