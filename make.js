/**
 * Module dependencies
 */
let fs = require('fs-extra');
let path = require('path');
const aws = require('aws-sdk');
const commander = require('commander');

// const githubActionsRunner = require('ci-build-tools')(process.env.GITHUB_TOKEN);
function getVersion() {
  let release_version = '0.0';
  const pull_request = '';
  const branch = process.env.GITHUB_REF;
  const build_number = process.env.GITHUB_RUN_NUMBER;

  //Builds of pull requests
  if (pull_request && !pull_request.match(/false/i)) {
    release_version = `0.${pull_request}`;
  } else if (!branch || !branch.match(/^(refs\/heads\/)?release[/-]/i)) {
    //Builds of branches that aren't master or release
    release_version = '0.0';
  } else {
    //Builds of release branches (or locally or on server)
    release_version = branch.match(/^(?:refs\/heads\/)?release[/-](\d+(?:\.\d+){0,3})$/i)[1];
  }
  return `${release_version}.${(build_number || '0')}.0.0.0.0`.split('.').slice(0, 3).join('.');
}
const version = getVersion();
commander.version(version);

let AwsArchitect = require('aws-architect');

const packageMetadataFile = path.join(__dirname, 'package.json');
const packageMetadata = require(packageMetadataFile);
packageMetadata.version = version;

const REGION = 'us-east-1';
aws.config.region = REGION;

let apiOptions = {
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

    let awsArchitect = new AwsArchitect(packageMetadata, apiOptions);
    awsArchitect.run(8080)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(failure => console.log(JSON.stringify(failure, null, 2)));
  });

commander
  .command('deploy')
  .description('Deploy to AWS.')
  .action(async () => {
    // /****** */
    // process.env.GITHUB_REF = 'refs/heads/master';
    // /****** */
    await fs.writeJson(packageMetadataFile, packageMetadata, { spaces: 2 });

    const awsArchitect = new AwsArchitect(packageMetadata, apiOptions);
    const stackTemplateProvider = require('./cloudFormationServerlessTemplate');
    const stackTemplate = stackTemplateProvider.getStack();
    const isMasterBranch = process.env.GITHUB_REF?.match(/master/);

    if (!process.env.WARRENS_PERSONAL_EMAIL || !process.env.WARRENS_EMAIL_DOMAIN) {
      throw Error('WARRENS_PERSONAL_EMAIL environment variable is not set.');
    }
    
    try {
      await awsArchitect.validateTemplate(stackTemplate);
      await awsArchitect.publishLambdaArtifactPromise();
      if (isMasterBranch) {
        const stackConfiguration = {
          changeSetName: version,
          stackName: packageMetadata.name,
          automaticallyProtectStack: true
        };
        const parameters = {
          serviceName: packageMetadata.name,
          serviceDescription: packageMetadata.description,
          emailBucketName: `emails.${process.env.WARRENS_EMAIL_DOMAIN}`
        };

        await awsArchitect.deployTemplate(stackTemplate, stackConfiguration, parameters);
      }

      const publicResult = await awsArchitect.publishAndDeployStagePromise({
        stage: isMasterBranch ? 'production' : process.env.GITHUB_REF,
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
  if (commander.args.join(' ') === "'tests/**/*.js'") { return; }
  console.log(`Unknown Command: ${commander.args.join(' ')}`);
  commander.help();
  process.exit(0);
});
commander.parse(process.argv[2] ? process.argv : process.argv.concat(['build']));
