'use strict;'
var esprima = require('esprima');
var mocha = require('mocha');
var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

describe('src/ses-forwarder.js', function() {
	describe('Syntax', function () {
		it('Should be valid Javascript', function() {
			try {
				var userStringToTest = fs.readFileSync(path.resolve('src/ses-forwarder.js'));
				esprima.parse(userStringToTest);
				assert(true);
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
		it('Should be valid node', function(){
			try {
				var app = require('../src/ses-forwarder');
				assert(true);
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
	});
	describe('Handler', function() {
		it('', function(done) {
			var expectedMessage = `From: no-reply@warrenparad.net\r
Reply-To: UnitTestSender@unittent.com\r
X-Original-To: 20170101@unittest.net\r
To: wparad@gmail.com\r
Subject: UnitTest Subject (UnitTe)\r
\r
(FROM: UnitTestSender@unittent.com, TO: 20170101@unittest.net)\r
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
					console.log(options.RawMessage.Data);
					assert.equal(options.RawMessage.Data, expectedMessage, "Email message does not match");
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
	});
});