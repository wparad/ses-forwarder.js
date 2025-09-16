const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');

const { DateTime } = require('luxon');

const fw = require('../src/ses-forwarder');
const logger = require('../src/logger');

let sandbox;
beforeEach(() => { sandbox = sinon.createSandbox(); });
afterEach(() => sandbox.restore());

describe('src/ses-forwarder.js', () => {
  describe('Handler', () => {
    it('default handler test', async () => {
      const expectedMessage = `X-SES-Sender-S3-Object-Id: UnitTestId-0000\r\nX-SES-Original-Lambda-Event: eyJldmVudFNvdXJjZSI6ImF3czpzZXMiLCJldmVudFZlcnNpb24iOiIxLjAiLCJzZXMiOnsicmVjZWlwdCI6eyJzcGFtVmVyZGljdCI6eyJzdGF0dXMiOiJQQVNTIn0sInZpcnVzVmVyZGljdCI6eyJzdGF0dXMiOiJQQVNTIn19LCJtYWlsIjp7ImNvbW1vbkhlYWRlcnMiOnsiZnJvbSI6WyJVbml0VGVzdFNlbmRlckB1bml0dGVudC5jb20iXSwidG8iOlsiMjAxNzAxMDFAdW5pdHRlc3QubmV0Il0sInN1YmplY3QiOiJVbml0VGVzdCBTdWJqZWN0In0sImhlYWRlcnMiOltdLCJtZXNzYWdlSWQiOiJVbml0VGVzdElkLTAwMDAifX19\r\nTo: "20170101@unittest.net" <${process.env.WARRENS_PERSONAL_EMAIL}>\r\nSubject: UnitTest Subject\r\nFrom: "UnitTestSender@unittent.com" <no-reply@${process.env.WARRENS_EMAIL_DOMAIN}>\r\nReply-To: UnitTestSender@unittent.com\r\nX-Original-To: 20170101@unittest.net\r\n\r\nThis is the body.`;

      const mockLogger = sandbox.mock(logger);
      mockLogger.expects('log').exactly(2);

      await fw.handler({
        getObject(options) {
          if (options.Bucket === null) { return Promise.reject('Bucket not defined.'); }
          if (options.Key === null) { return Promise.reject('Bucket object key not defined.'); }
          return {
            promise: () => Promise.resolve({
              Body: '\r\n\r\nThis is the body.'
            })
          };
        }
      }, {
        sendRawEmail(options) {
          expect(options.RawMessage).to.not.eql(null, 'Message not defined.');
          expect(options.RawMessage.Data).to.not.eql(null, 'Message not defined.');
          expect(options.RawMessage.Data).to.eql(expectedMessage, 'Email message does not match');
          return { promise: () => Promise.resolve() };
        }
      }, {
        Records: [
          {
            eventSource: 'aws:ses',
            eventVersion: '1.0',
            ses: {
              receipt: {
                spamVerdict: {
                  status: 'PASS'
                },
                virusVerdict: {
                  status: 'PASS'
                }
              },
              mail: {
                commonHeaders: {
                  from: [
                    'UnitTestSender@unittent.com'
                  ],
                  to: [
                    '20170101@unittest.net'
                  ],
                  subject: 'UnitTest Subject'

                },
                headers: [

                ],
                messageId: 'UnitTestId-0000'
              }
            }
          }
        ]
      });
    });
    it('Email address older than 1 month used', async () => {
      const mockLogger = sandbox.mock(logger);
      mockLogger.expects('log').exactly(2);

      const result = await fw.handler({
        getObject(options) {
          if (options.Bucket === null) { return Promise.reject('Bucket not defined.'); }
          if (options.Key === null) { return Promise.reject('Bucket object key not defined.'); }
          return {
            promise: () => Promise.resolve({
              Body: '\r\n\r\nThis is the body.'
            })
          };
        }
      }, {
        sendRawEmail() {
          return { promise: () => Promise.reject(Error('Should never execute')) };
        }
      }, {
        Records: [
          {
            eventSource: 'aws:ses',
            eventVersion: '1.0',
            ses: {
              receipt: {
                spamVerdict: {
                  status: 'PASS'
                },
                virusVerdict: {
                  status: 'PASS'
                },
                recipients: [
                  `${DateTime.utc().plus({ days: -32 }).toFormat('yyyy-MM-dd')}@unittest.net`
                ]
              },
              mail: {
                commonHeaders: {
                  from: [
                    'UnitTestSender@unittent.com'
                  ],
                  to: [
                    `${DateTime.utc().plus({ days: -32 }).toFormat('yyyy-MM-dd')}@unittest.net`
                  ],
                  subject: 'UnitTest Subject'

                },
                headers: [

                ],
                messageId: 'UnitTestId-0000'
              }
            }
          }
        ]
      });

      expect(result).to.eql({ disposition: 'CONTINUE' });
    });
    it('Email address newer than 1 month used', async () => {
      const mockLogger = sandbox.mock(logger);
      mockLogger.expects('log').exactly(2);

      const result = await fw.handler({
        getObject(options) {
          if (options.Bucket === null) { return Promise.reject('Bucket not defined.'); }
          if (options.Key === null) { return Promise.reject('Bucket object key not defined.'); }
          return {
            promise: () => Promise.resolve({
              Body: '\r\n\r\nThis is the body.'
            })
          };
        }
      }, {
        sendRawEmail() {
          return { promise: () => Promise.resolve() };
        }
      }, {
        Records: [
          {
            eventSource: 'aws:ses',
            eventVersion: '1.0',
            ses: {
              receipt: {
                spamVerdict: {
                  status: 'PASS'
                },
                virusVerdict: {
                  status: 'PASS'
                }
              },
              mail: {
                commonHeaders: {
                  from: [
                    'UnitTestSender@unittent.com'
                  ],
                  to: [
                    `${DateTime.utc().plus({ days: -30 }).toFormat('yyyy-MM-dd')}@unittest.net`
                  ],
                  subject: 'UnitTest Subject'

                },
                headers: [

                ],
                messageId: 'UnitTestId-0000'
              }
            }
          }
        ]
      });
			
      expect(result).to.not.eql('Skipping, due to outdated email address.');
    });
  });

  describe('Validate my email address is still private', () => {
    it('process.env.WARRENS_PERSONAL_EMAIL', () => {
      expect(process.env.WARRENS_PERSONAL_EMAIL).to.eql(undefined);
    });
    it('process.env.WARRENS_EMAIL_DOMAIN', () => {
      expect(process.env.WARRENS_EMAIL_DOMAIN).to.eql(undefined);
    });
  });
});
