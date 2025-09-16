module.exports = {
  getStack() {
    const template = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Track data from streams such as CloudWatch',
      Parameters: {
        emailBucketName: {
          Type: 'String',
          Description: 'The name of the email bucket where to save incoming emails'
        },
        serviceName: {
          Type: 'String',
          Description: 'The name of the microservice'
        },
        serviceDescription: {
          Type: 'String',
          Description: 'Service description used for AWS resources'
        }
      },

      Resources: {
        S3Bucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: { 'Fn::Sub': '${emailBucketName}-${AWS::AccountId}' },
            AccessControl: 'Private',
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: true,
              BlockPublicPolicy: true,
              IgnorePublicAcls: true,
              RestrictPublicBuckets: true
            },
            LifecycleConfiguration: {
              Rules: [{
                Id: 'Delete old objects',
                Status: 'Enabled',
                AbortIncompleteMultipartUpload: { DaysAfterInitiation: 30 },
                ExpirationInDays: 365
              }]
            },
            Tags: [
              {
                Key: 'Service',
                Value: { Ref: 'AWS::StackName' }
              }
            ]
          }
        },
    
        S3BucketPolicy: {
          Type: 'AWS::S3::BucketPolicy',
          Properties: {
            Bucket: { 'Fn::Sub': '${emailBucketName}-${AWS::AccountId}' },
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Sid: 'Allow SES to push emails here',
                  Effect: 'Allow',
                  Principal: { Service: 'ses.amazonaws.com' },
                  Action: 's3:PutObject',
                  Resource: { 'Fn::Sub': 'arn:aws:s3:::${emailBucketName}-${AWS::AccountId}/*' },
                  Condition: {
                    StringEquals: {
                      'aws:Referer': { Ref: 'AWS::AccountId' }
                    }
                  }
                }
              ]
            }
          }
        },
        
        LambdaFunction: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            FunctionName: { Ref: 'serviceName' },
            Description: { Ref: 'serviceDescription' },
            Handler: 'index.handler',
            Runtime: 'nodejs18.x',
            TracingConfig: {
              Mode: 'Active'
            },
            Code: {
              ZipFile: 'exports.handler = async() => Promise.resolve()'
            },
            Environment: {
              Variables: {
                BucketName: { 'Fn::Sub': '${emailBucketName}-${AWS::AccountId}' }
              }
            },
            MemorySize: 128,
            Timeout: 30,
            Role: { 'Fn::GetAtt': ['LambdaRole', 'Arn'] },
            Tags: [
              {
                Key: 'Service',
                Value: { Ref: 'serviceName' }
              }
            ]
          }
        },
        LambdaRole: {
          Type: 'AWS::IAM::Role',
          Properties: {
            RoleName: {
              'Fn::Join': [
                '',
                [
                  { Ref: 'serviceName' },
                  'LambdaRole'
                ]
              ]
            },
            AssumeRolePolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: {
                    Service: ['lambda.amazonaws.com']
                  },
                  Action: ['sts:AssumeRole']
                }
              ]
            },
            ManagedPolicyArns: [
              'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess'
            ],
            Policies: [
              {
                PolicyName: 'MicroservicePolicy',
                PolicyDocument: {
                  Version: '2012-10-17',
                  Statement: [
                    {
                      Sid: 'S3EmailRead',
                      Action: [
                        's3:*'
                      ],
                      Effect: 'Allow',
                      Resource: { 'Fn::Sub': 'arn:aws:s3:::${emailBucketName}-${AWS::AccountId}/*' }
                    },
                    {
                      Sid: 'SESAllowAll',
                      Action: [
                        'ses:*'
                      ],
                      Effect: 'Allow',
                      Resource: 'arn:aws:ses:*:*:*'
                    },
                    {
                      Sid: 'SESSendTheEmail',
                      Action: [
                        'ses:SendRawEmail'
                      ],
                      Effect: 'Allow',
                      Resource: 'arn:aws:ses:*:*:identity/*',
                      Condition: {
                        StringLike: {
                          'ses:FromAddress': '*+noreply@*'
                        }
                      }
                    },
                    {
                      Sid: 'SESSendTheEmailNoReply',
                      Action: [
                        'ses:SendRawEmail'
                      ],
                      Effect: 'Allow',
                      Resource: 'arn:aws:ses:*:*:identity/*',
                      Condition: {
                        StringLike: {
                          'ses:FromAddress': 'no-reply@*'
                        }
                      }
                    }
                  ]
                }
              }
            ],
            Path: '/'
          }
        },

        LambdaFunctionVersion: {
          Type: 'AWS::Lambda::Version',
          Properties: {
            FunctionName: { Ref: 'LambdaFunction' },
            Description: 'Initial Production Deployed Version'
          }
        },
        ProductionAlias: {
          Type: 'AWS::Lambda::Alias',
          Properties: {
            Description: 'The production alias',
            FunctionName: { 'Fn::GetAtt': ['LambdaFunction', 'Arn'] },
            FunctionVersion: { 'Fn::GetAtt': ['LambdaFunctionVersion', 'Version'] },
            Name: 'production'
          }
        },
        SesLambdaInvokePermission: {
          Type: 'AWS::Lambda::Permission',
          Properties: {
            FunctionName: { Ref: 'ProductionAlias' },
            Action: 'lambda:InvokeFunction',
            Principal: 'ses.amazonaws.com',
            SourceAccount: { Ref: 'AWS::AccountId' },
            SourceArn: { 'Fn::Sub': 'arn:aws:ses:${AWS::Region}:${AWS::AccountId}:receipt-rule-set/${SesIncomingHandler}:*' }
          }
        },

        CloudWatchLambdaLogGroup: {
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: { 'Fn::Sub': '/aws/lambda/${serviceName}' },
            RetentionInDays: 365
          }
        },

        SesIncomingHandler: {
          Type: 'AWS::SES::ReceiptRuleSet',
          Properties: {
            // You must manually set the Rule Set to active after creating it
            RuleSetName: 'DefaultRuleSet'
          }
        },

        SesHandleWithLambdaS3: {
          Type: 'AWS::SES::ReceiptRule',
          Properties: {
            Rule: {
              Actions: [{
                S3Action: {
                  BucketName: { Ref: 'S3Bucket' },
                  ObjectKeyPrefix: 'Incoming'
                }
              }, {
                LambdaAction: {
                  'FunctionArn': { Ref: 'ProductionAlias' },
                  'InvocationType': 'RequestResponse'
                }
              }, {
                BounceAction: {
                  'Message': 'Message content rejected',
                  'Sender': `no-reply@${process.env.WARRENS_EMAIL_DOMAIN}`,
                  'SmtpReplyCode': '500',
                  'StatusCode': '5.6.1'
                }
              }],
              Enabled: true,
              Name: 'LambdaHandler',
              ScanEnabled: true,
              TlsPolicy: 'Optional'
            },
            RuleSetName: 'DefaultRuleSet'
          }
        }
      }
    };

    return template;
  }
};
