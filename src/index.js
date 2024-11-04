const aws = require('aws-sdk');
const LambdaForwarder = require('./ses-forwarder');

module.exports.handler = async event => {
  const result = await LambdaForwarder.handler(new aws.S3(), new aws.SES(), event);
  return result;
};
