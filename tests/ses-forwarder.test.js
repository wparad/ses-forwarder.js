const mocha = require('mocha');
const { expect } = require('chai');
const fs = require('fs');

const moment = require('moment');

describe('src/ses-forwarder.js', () =>  {
	describe('Syntax', () => {
		it('Should be valid node', () => {
			try {
				var app = require('../src/ses-forwarder');
			}
			catch(e) {
				console.log(e.stack);
				expect(e).to.eql(null, e.toString());
			}
		});
	});
	describe('Handler', () =>  {
		it('default handler test', function(done) {
			var expectedMessage = `From: "UnitTestSender@unittent.com" <no-reply@warrenparad.net>\r
Reply-To: UnitTestSender@unittent.com\r
X-Original-To: 20170101@unittest.net\r
X-AMZ-Id: UnitTestId-0000\r
To: "20170101@unittest.net" <${process.env.WARRENS_PERSONAL_EMAIL}>\r
Subject: UnitTest Subject\r
\r
This is the body.`;
			var fw = require('../src/ses-forwarder');
			fw.handler({
				getObject: function(options) {
					if (options.Bucket === null) { return Promise.reject('Bucket not defined.'); }
					if (options.Key === null) { return Promise.reject('Bucket object key not defined.'); }
					return {
						promise: () => Promise.resolve({
							Body: '\r\n\r\nThis is the body.'
						})
					};
				}
			}, {
				sendRawEmail: function(options) {
					if (options.RawMessage === null) { return Promise.reject('Message not defined.'); }
					if (options.RawMessage.Data === null) { return Promise.reject('Message not defined.'); }
					if (options.RawMessage.Data !== expectedMessage) {
						console.log(options.RawMessage.Data);
						console.log(expectedMessage);
						expect(false).to.eql(true, 'Email message does not match');
					}
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
									subject: 'UnitTest Subject',

								},
								headers: [

								],
								messageId: 'UnitTestId-0000'
							}
						}
					}
				]
			})
			.then(() => done())
			.catch((failure) => done(failure));
		});
		it('Email address older than 1 month used', function(done) {
			var fw = require('../src/ses-forwarder');
			fw.handler({
				getObject: function(options) {
					if (options.Bucket === null) { return Promise.reject('Bucket not defined.'); }
					if (options.Key === null) { return Promise.reject('Bucket object key not defined.'); }
					return {
						promise: () => Promise.resolve({
							Body: '\r\n\r\nThis is the body.'
						})
					};
				}
			}, {
				sendRawEmail: function(options) {
					return { promise: () => Promise.reject('Should never execute') };
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
                  `${moment().add(-32, 'days').format('YYYYMMDD')}@unittest.net`
                ]
							},
							mail: {
								commonHeaders: {
									from: [
										'UnitTestSender@unittent.com'
									],
									to: [
										`${moment().add(-32, 'days').format('YYYYMMDD')}@unittest.net`
									],
									subject: 'UnitTest Subject',

								},
								headers: [

								],
								messageId: 'UnitTestId-0000'
							}
						}
					}
				]
			})
			.then(result => {
				if (expect(result).to.eql({ disposition: 'CONTINUE' })) { done(); }
				else { done(`Should have skipped email because it is outdated.`); }
			})
			.catch((failure) => done(failure));
		});
		it('Email address newer than 1 month used', function(done) {
			var fw = require('../src/ses-forwarder');
			fw.handler({
				getObject: function(options) {
					if (options.Bucket === null) { return Promise.reject('Bucket not defined.'); }
					if (options.Key === null) { return Promise.reject('Bucket object key not defined.'); }
					return {
						promise: () => Promise.resolve({
							Body: '\r\n\r\nThis is the body.'
						})
					};
				}
			}, {
				sendRawEmail: function(options) {
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
										`${moment().add(-30, 'days').format('YYYYMMDD')}@unittest.net`
									],
									subject: 'UnitTest Subject',

								},
								headers: [

								],
								messageId: 'UnitTestId-0000'
							}
						}
					}
				]
			})
			.then(result => {
				if (result !== 'Skipping, due to outdated email address.') { done(); }
				else { done(`Should not have skipped email because it is new.`); }
			})
			.catch((failure) => done(failure));
		});
	});
});