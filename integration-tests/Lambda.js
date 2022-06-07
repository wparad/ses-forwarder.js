'use strict';

const aws = require('aws-sdk');
aws.config.update({ region: 'us-east-1'});

var event = {
    "Records": [
        {
            "eventSource": "aws:ses",
            "eventVersion": "1.0",
            "ses": {
                "mail": {
                    "timestamp": "2017-01-20T13:33:58.861Z",
                    "source": `${process.env.WARRENS_PERSONAL_EMAIL}`,
                    "messageId": "3rk0d94itfc2i7u0sllkseg61nm8jej40i61s801",
                    "destination": [
                        "wparad@vortex.link"
                    ],
                    "headersTruncated": false,
                    "headers": [
                        {
                            "name": "Return-Path",
                            "value": `<${process.env.WARRENS_PERSONAL_EMAIL}>`
                        },
                        {
                            "name": "X-SES-Spam-Verdict",
                            "value": "PASS"
                        },
                        {
                            "name": "X-SES-Virus-Verdict",
                            "value": "PASS"
                        },
                        {
                            "name": "X-Received",
                            "value": "by 10.223.129.196 with SMTP id 62mr13011896wra.43.1484919237473; Fri, 20 Jan 2017 05:33:57 -0800 (PST)"
                        },
                        {
                            "name": "MIME-Version",
                            "value": "1.0"
                        },
                        {
                            "name": "Received",
                            "value": "by 10.28.1.4 with HTTP; Fri, 20 Jan 2017 05:33:16 -0800 (PST)"
                        },
                        {
                            "name": "Content-Type",
                            "value": "multipart/alternative; boundary=001a1148e7c2ab7f68054686b347"
                        }
                    ],
                    "commonHeaders": {
                        "returnPath": `${process.env.WARRENS_PERSONAL_EMAIL}`,
                        "from": [
                            `Warren Parad <${process.env.WARRENS_PERSONAL_EMAIL}>`
                        ],
                        "date": "Fri, 20 Jan 2017 08:33:16 -0500",
                        "to": [
                            "wparad@vortex.link"
                        ],
                        "messageId": "<CAB57QDkioMZyCQD9BuZv-2gG4=ZsckXVeC31Q1vDb+bjY_3adw@mail.gmail.com>",
                        "subject": "Hello2"
                    }
                },
                "receipt": {
                    "timestamp": "2017-01-20T13:33:58.861Z",
                    "processingTimeMillis": 499,
                    "recipients": [
                        "wparad@vortex.link"
                    ],
                    "spamVerdict": {
                        "status": "PASS"
                    },
                    "virusVerdict": {
                        "status": "PASS"
                    },
                    "spfVerdict": {
                        "status": "PASS"
                    },
                    "dkimVerdict": {
                        "status": "PASS"
                    },
                    "action": {
                        "type": "Lambda",
                        "functionArn": "arn:aws:lambda:us-east-1:729379526210:function:ses-forwarder-index",
                        "invocationType": "Event"
                    }
                }
            }
        }
    ]
};

new aws.Lambda().invoke({
    FunctionName: event.Records[0].ses.receipt.action.functionArn,
    InvocationType: 'RequestResponse',
    LogType: 'None',
    Payload: JSON.stringify(event)
}).promise()
.then((data) => { console.log(data); }, failure => {
    console.error('Failed to send email.');
    console.error(failure);
});