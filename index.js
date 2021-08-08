require('dotenv').config();
const core = require('@actions/core');
const artifact = require('@actions/artifact');
const fs = require('fs');
const fetch = require('node-fetch');
const base64 = require('base-64');
const AWS = require('aws-sdk');
const config = require('./config.js');
const process = require('process');
const standardVersion = require('standard-version');

const manifestFilePath = process.env.GITHUB_WORKSPACE + '/' + config.manifestFile;
const manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8'));


function getPreReleaseType(metadata) {

    for (const k in config.preReleaseTypes) {
        if (config.preReleaseTypes.hasOwnProperty(k) && metadata.TARGET_BRANCH.match(config.preReleaseTypes[k].branchPattern)) return  k;
    }

}

function getMetadataFromTopics(type, typeCollection, projectTopics, required) {

    let matches = [];
    for (const t of projectTopics) {
        if (Array.isArray(typeCollection)) typeCollection.includes(t) && matches.push(t);
        else t in typeCollection && matches.push(t);
    }

    if (matches.length === 1) return matches[0];
    else if (matches.length === 0) required && core.setFailed('Project missing ' + type + ' topic');
    else core.setFailed('Project has multiple ' + type + ' topics [' + matches.join(' ') + ']');

}

function aggregateClasses() {

    let classArray = [];

    for (const k in config.projectClasses) {
        if (config.projectClasses.hasOwnProperty(k)) classArray = classArray.concat(config.projectClasses[k])
    }

    return classArray
}

function getClassGrouping(projectClass) {

    for (const k in config.projectClasses) {
        if (config.projectClasses.hasOwnProperty(k) && config.projectClasses[k].includes(projectClass)) return k
    }
}

function buildBasicAuthHeader(user, password) {
    return {Authorization: 'Basic ' + base64.encode(user + ':' + password)};
}

function verifyArtifactOnS3(metadata) {

    const s3 = new AWS.S3({apiVersion: '2006-03-01'});

    let bucketParam = {
        Bucket: metadata.ARTIFACT_BUCKET,
        Key: metadata.ARTIFACT_PATH + '/' + metadata.ARTIFACT_FULLNAME
    };

    s3.headObject(bucketParam, function(err) {
        metadata.SKIP_VERSION_VALIDATION || err || core.setFailed(config.versionConflictMessage);
        publishMetadata(metadata, manifest);
    });
}

function publishMetadata(metadata, manifest) {

    const artifactClient = artifact.create();

    if ('overrides' in manifest) {
        for (const k in manifest.overrides) if (manifest.overrides.hasOwnProperty(k)) metadata[k] = manifest.overrides[k];
    }

    fs.writeFileSync('./metadata.json', JSON.stringify(metadata, null, 2));

    artifactClient
        .uploadArtifact('metadata', ['metadata.json'], '.')
        .catch(error => core.setFailed(error));

    core.info('Metadata: ' + JSON.stringify(metadata, null, 4));

}

function getDeployEnvironment(metadata) {

    const environment = metadata.PRE_RELEASE_TYPE ? config.preReleaseTypes[metadata.PRE_RELEASE_TYPE].environment : config.teams[metadata.TEAM].environment;

    if (environment) return environment;
    else core.setFailed(['Deployment environment not found:', metadata.TARGET_BRANCH, '/', metadata.PROJECT_VERSION].join(' '));

}

function validateVersion(metadata) {

    if (metadata.PROJECT_VERSION.match(config.environments[metadata.DEPLOY_ENVIRONMENT].versionPattern)) return true;
    else {
        core.setFailed(['Branch mismatch: version', metadata.PROJECT_VERSION, 'should not be committed to branch', metadata.TARGET_BRANCH].join(' '));
        return false
    }

}


///////////////////////////////////////////////////////////////////////////////



let metadata = {
    SKIP_BUMP: core.getBooleanInput('skip_bump'),
    SKIP_VERSION_VALIDATION: core.getBooleanInput('skip_version_validation'),
    SKIP_TESTS: manifest['skip_tests'],
    PROJECT_NAME: process.env.GITHUB_REPOSITORY.split('/')[1],
    TARGET_BRANCH: process.env.GITHUB_EVENT_NAME === 'push' ? process.env.GITHUB_REF : 'refs/heads/' + process.env.GITHUB_BASE_REF,
};

let standardVersionArgv = {
    packageFiles: [manifestFilePath],
    silent: metadata.SKIP_BUMP,
    dryRun: metadata.SKIP_BUMP,
    gitTagFallback: false
};

metadata.LEGACY = !!metadata.TARGET_BRANCH.match(config.customBranches.legacy.branchPattern);
metadata.HOTFIX = !!metadata.TARGET_BRANCH.match(config.customBranches.hotfix.branchPattern);

metadata.PRE_RELEASE_TYPE = getPreReleaseType(metadata);

if (metadata.PRE_RELEASE_TYPE) standardVersionArgv.prerelease = metadata.PRE_RELEASE_TYPE;

standardVersion(standardVersionArgv).then(() => {

    metadata.PROJECT_VERSION = JSON.parse(fs.readFileSync(manifestFilePath, 'utf-8')).version;

    // Fetch project topics from GitHub
    let gitHubUrl = process.env.GITHUB_API_URL + '/repos/' + process.env.GITHUB_REPOSITORY + '/topics';
    let gitHubHeaders = {Authorization: 'token ' + core.getInput('github_token'), Accept: "application/vnd.github.mercy-preview+json"};
    return fetch(gitHubUrl, {headers: gitHubHeaders})

}).then(response => {

    if (response['status'] === 200) return response['json']();
    else throw ['Could not retrieve topics:', response['status'], response['statusText']].join(' ')

}).then(response => {

    const projectTopics = response['names'];

    // Validate project topics
    metadata.TEAM = getMetadataFromTopics('team', config.teams, projectTopics, true);
    metadata.INTERPRETER = getMetadataFromTopics('interpreter', config.interpreters, projectTopics, true);
    metadata.PROJECT_CLASS = getMetadataFromTopics('class', aggregateClasses(), projectTopics, true);

    switch(getClassGrouping(metadata.PROJECT_CLASS)) {

        case 'package':

            if (metadata.INTERPRETER === 'python') {

                const pypiUrl = 'https://' + core.getInput('pypi_host') + '/simple/' + metadata.PROJECT_NAME + '/json';
                const pypiHeaders = buildBasicAuthHeader(core.getInput('pypi_user'), core.getInput( 'pypi_password'));
                fetch(pypiUrl, {headers: pypiHeaders}).then(response => {

                    if (response.status === 200) return response.json();
                    else if (response.status === 404) return {releases: []};
                    else core.setFailed('Could not retrieve pypi package versions: ' + response.status + ' ' + response.statusText)

                }).then(response => {

                    if (!metadata.SKIP_VERSION_VALIDATION && metadata.PROJECT_VERSION in response['releases']) core.setFailed(config['versionConflictMessage']);
                    publishMetadata(metadata, manifest)

                }).catch(error => core.setFailed(error))

            }

            break;

        case 'helmChart':

            metadata.PROJECT_NAME = metadata.PROJECT_NAME.replace(/^charts_/, '');

            const chartsUrl = 'https://' + core.getInput('chart_repository') +'/api/charts/' + metadata.PROJECT_NAME + '/' + metadata.PROJECT_NAME;
            const chartsHeaders = buildBasicAuthHeader(core.getInput('chart_repository_user'), core.getInput( 'chart_repository_password'));
            fetch(chartsUrl, {headers: chartsHeaders , method: 'HEAD'}).then(response => {

                metadata.SKIP_VERSION_VALIDATION || response.status === 200 && core.setFailed(config.versionConflictMessage);
                publishMetadata(metadata, manifest)

            }).catch(error => core.setFailed(error));

            break;

        case 'lambda':

            const functionName = metadata.PROJECT_NAME.substring(3);

            metadata.AWS_REGION = process.env.AWS_REGION;
            metadata.FUNCTION_NAME = functionName;
            metadata.ARTIFACT_NAME = functionName + '.zip';
            metadata.ARTIFACT_FULLNAME = functionName + '-' + metadata.PROJECT_VERSION + '.zip';
            metadata.ARTIFACT_PATH = functionName;
            metadata.ARTIFACT_BUCKET = config.lambdaBucketPrefix + '-' + metadata.AWS_REGION;

            verifyArtifactOnS3(metadata);

            break;

        case 'publicImage':

            const imageName = metadata.PROJECT_NAME.replace(/^dk_/, '');

            metadata.DOCKER_BUILD_FROM_MASTER = true;

            fetch('https://' + core.getInput('container_registry') + '/v2/' + imageName + '/manifests/' + metadata.PROJECT_VERSION).then(response => {

                metadata.SKIP_VERSION_VALIDATION || response.status === 200 && core.setFailed(config.versionConflictMessage);
                metadata.DOCKER_IMAGE_NAME = core.getInput('container_registry') + '/' + imageName;
                metadata.DOCKER_IMAGE_TAGS = 'latest ' + metadata.PROJECT_VERSION;

                publishMetadata(metadata, manifest)

            }).catch(error => core.setFailed(error));

            break;

        case 'kubernetesWorkload':

            metadata.DEPLOY_ENVIRONMENT = getDeployEnvironment(metadata);
            metadata.MAESTRO_REPOSITORY = config.teams[metadata.TEAM].repository;
            metadata.DOCKER_BUILD_FROM_MASTER = false;
            if (metadata.TARGET_BRANCH === 'ref/heads/master') metadata.VALIDATED_VERSION = manifest.version;

            validateVersion(metadata);

            const registryUrl = 'https://' + core.getInput('container_registry') + '/v2/' + metadata.PROJECT_NAME + '/manifests/' + metadata.PROJECT_VERSION;
            const registryHeaders = buildBasicAuthHeader(core.getInput('container_registry_user'), core.getInput( 'container_registry_password'));
            fetch(registryUrl, {headers: registryHeaders}).then(response => {

                metadata.SKIP_VERSION_VALIDATION || response.status === 200 && core.setFailed(config.versionConflictMessage);
                metadata.DOCKER_IMAGE_NAME = core.getInput('container_registry') + '/' + metadata.PROJECT_NAME;
                metadata.DOCKER_IMAGE_TAGS = [metadata.PROJECT_VERSION, metadata.DEPLOY_ENVIRONMENT , metadata.LEGACY ? 'legacy' : 'latest'].join(' ');

                publishMetadata(metadata, manifest)

            }).catch(error => core.setFailed(error));

            break;

        case 'webapp':

            metadata.ARTIFACT_FILENAME = metadata.PROJECT_NAME + '-' + metadata.PROJECT_VERSION + '.tgz';
            metadata.ARTIFACT_BUCKET = config.webappsArtifactBucket;
            metadata.WEBAPP_BUCKET = config.webappBucketPrefix + '-' + metadata.PROJECT_NAME;
            metadata.SUBDOMAIN = JSON.parse(fs.readFileSync(process.env.GITHUB_WORKSPACE +  '/package.json', 'utf-8'))['subdomain'];

            verifyArtifactOnS3(metadata);

            break;

        default:

            core.setFailed('Could not build environment variables for ' + metadata.PROJECT_CLASS + '/' + metadata.INTERPRETER);

    }

}).catch(error => core.setFailed(error));
