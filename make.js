'use strict';

/**
 * Module dependencies
 */
var fs = require('fs-extra');
var path = require('path');
const aws = require('aws-sdk');
const commander = require('commander');

var AwsArchitect = require('aws-architect');
const version = `0.0.${process.env.CI_PIPELINE_ID || '0'}`;
commander.version(version);

var packageMetadataFile = path.join(__dirname, 'package.json');
var packageMetadata = require(packageMetadataFile);
packageMetadata.version = version;

const REGION = 'us-east-1';
aws.config.region = REGION;

var apiOptions = {
  deploymentBucket: 'wparad-microservice-deployment-artifacts-us-east-1',
  sourceDirectory: path.join(__dirname, 'src'),
  description: packageMetadata.description,
  regions: [REGION]
};

commander
  .command('run')
  .description('Run lambda web service locally.')
  .action(() => {
    aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'wparad' });

    var awsArchitect = new AwsArchitect(packageMetadata, apiOptions);
    awsArchitect.Run(8080)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((failure) => console.log(JSON.stringify(failure, null, 2)));
  });

commander
  .command('deploy')
  .description('Deploy to AWS.')
  .action(async () => {
    /****** */
    aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'wparad' });
    process.env.CI_COMMIT_REF_SLUG = 'master';
    /****** */
    await fs.writeJson(packageMetadataFile, packageMetadata, { spaces: 2 });

    const awsArchitect = new AwsArchitect(packageMetadata, apiOptions);
    const stackTemplateProvider = require('./cloudFormationServerlessTemplate');
    const stackTemplate = stackTemplateProvider.getStack();
    const isMasterBranch = process.env.CI_COMMIT_REF_SLUG === 'master';
    
    try {
      await awsArchitect.validateTemplate(stackTemplate);
      await awsArchitect.publishLambdaArtifactPromise();
      if (isMasterBranch) {
        const stackConfiguration = {
          changeSetName: `${process.env.CI_COMMIT_REF_SLUG}-${process.env.CI_PIPELINE_ID || '1'}-${process.env.CI_JOB_ID || '1'}`,
          stackName: packageMetadata.name,
          automaticallyProtectStack: true
        };
        const parameters = {
          serviceName: packageMetadata.name,
          serviceDescription: packageMetadata.description,
          emailBucketName: 'emails.warrenparad.net'
        };
        await awsArchitect.deployTemplate(stackTemplate, stackConfiguration, parameters);
      }

      const publicResult = await awsArchitect.publishAndDeployStagePromise({
        stage: isMasterBranch ? 'production' : process.env.CI_COMMIT_REF_SLUG,
        functionName: packageMetadata.name,
        deploymentKeyName: `${packageMetadata.name}/${version}/lambda.zip`
      });

      console.log(publicResult);
    } catch (failure) {
      console.log(failure);
      process.exit(1);
    }
  });

commander.on('*', () => {
  if(commander.args.join(' ') == 'tests/**/*.js') { return; }
  console.log('Unknown Command: ' + commander.args.join(' '));
  commander.help();
  process.exit(0);
});
commander.parse(process.argv[2] ? process.argv : process.argv.concat(['build']));