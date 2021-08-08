const core = require('@actions/core');
const artifact = require('@actions/artifact');
const fs = require('fs');
const yaml = require('yaml');
const fetch = require('node-fetch');
const config = require('./config.js');
const process = require('process');
const standardVersion = require('standard-version');
const standardVersionDockerfileUpdater = require('@damlys/standard-version-updater-docker/dist/dockerfile.js');
const standardVersionDockerComposeUpdater = require('@damlys/standard-version-updater-docker/dist/docker-compose.js');

// Load .env file for local testing
require('dotenv').config();


function getPreReleaseType(ref) {

    for (const k in config.preReleaseTypes) {
        if (config.preReleaseTypes.hasOwnProperty(k) && ref.match(config.preReleaseTypes[k].branchPattern)) return  k;
    }

}

function parseManifestFile(manifestFilePath) {

    return yaml.parse(fs.readFileSync(manifestFilePath, 'utf-8'));
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

function aggregateProjectTypes() {

    let classArray = [];

    for (const k in config.projectGroups) {
        if (config.projectGroups.hasOwnProperty(k)) classArray = classArray.concat(config.projectGroups[k].topics)
    }

    return classArray
}

function getProjectGroup(projectType) {

    for (const k in config.projectGroups) {
        if (config.projectGroups.hasOwnProperty(k) && config.projectGroups[k].topics.includes(projectType)) return k
    }
}

function publishMetadata(metadata) {

    const artifactClient = artifact.create();
    const manifest = parseManifestFile(metadata.MANIFEST_FILE, 'utf-8');

    for (const k in ['overrides', 'annotations']) {
        if (k in manifest) {
            for (const j in manifest[k]) if (manifest[k].hasOwnProperty(j)) metadata[j] = manifest[k][j];
        }
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
    PROJECT_NAME: process.env.GITHUB_REPOSITORY.split('/')[1],
    TARGET_BRANCH: process.env.GITHUB_EVENT_NAME === 'push' ? process.env.GITHUB_REF : 'refs/heads/' + process.env.GITHUB_BASE_REF,
};

metadata.PRE_RELEASE_TYPE = getPreReleaseType(metadata.TARGET_BRANCH);
metadata.LEGACY = !!metadata.TARGET_BRANCH.match(config.customBranches.legacy.branchPattern);
metadata.HOTFIX = !!metadata.TARGET_BRANCH.match(config.customBranches.hotfix.branchPattern);

const gitHubUrl = process.env.GITHUB_API_URL + '/repos/' + process.env.GITHUB_REPOSITORY + '/topics';
const gitHubHeaders = {Authorization: 'token ' + core.getInput('github_token'), Accept: "application/vnd.github.mercy-preview+json"};
fetch(gitHubUrl, {headers: gitHubHeaders}).then(response => {

    if (response['status'] === 200) return response['json']();
    else throw ['Could not retrieve topics:', response['status'], response['statusText']].join(' ')

}).then(response => {

    const projectTopics = response['names'];
    metadata.TEAM = getMetadataFromTopics('team', config.teams, projectTopics, true);
    metadata.INTERPRETER = getMetadataFromTopics('interpreter', config.interpreters, projectTopics, true);
    metadata.PROJECT_TYPE = getMetadataFromTopics('group', aggregateProjectTypes(), projectTopics, true);
    metadata.PROJECT_GROUP = getProjectGroup(metadata.PROJECT_TYPE);
    metadata.MANIFEST_FILE = process.env.GITHUB_WORKSPACE + '/' + config.projectGroups[metadata.PROJECT_GROUP].manifestFile;

    console.log('Metadata: ' + JSON.stringify(metadata, null, 4));

    const manifest = parseManifestFile(metadata.MANIFEST_FILE, 'utf-8');
    metadata.SKIP_TESTS = manifest['skip_tests'];
    metadata.PRE_BUMP_VERSION = manifest['version'];

    let standardVersionArgv = {
        packageFiles: [
            {
                filename: metadata.MANIFEST_FILE,
                updater: config.projectGroups[metadata.PROJECT_GROUP].updater
            }
        ],
        bumpFiles: [
            {
                filename: "Dockerfile",
                updater: standardVersionDockerfileUpdater
            },
            {
                filename: "docker-compose.yml",
                updater: standardVersionDockerComposeUpdater
            }
        ],
        silent: metadata.SKIP_BUMP,
        dryRun: metadata.SKIP_BUMP,
        gitTagFallback: false,
     };

    if (metadata.PRE_RELEASE_TYPE) standardVersionArgv.prerelease = metadata.PRE_RELEASE_TYPE;

    return standardVersion(standardVersionArgv)

}).then(() => {

    metadata.PROJECT_VERSION = parseManifestFile(metadata.MANIFEST_FILE, 'utf-8').version;


    switch(getProjectGroup(metadata.PROJECT_TYPE)) {

        case 'package':

            publishMetadata(metadata);
            break;

        case 'helmChart':

            metadata.PROJECT_NAME = metadata.PROJECT_NAME.replace(/^charts_/, '');
            publishMetadata(metadata);
            break;

        case 'publicImage':

            metadata.DOCKER_BUILD_FROM_MASTER = true;
            metadata.DOCKER_IMAGE_NAME = config.containerRegistry.public + '/' + metadata.PROJECT_NAME.replace(/^dk_/, '');
            metadata.DOCKER_IMAGE_TAGS = 'latest ' + metadata.PROJECT_VERSION;
            publishMetadata(metadata);
            break;

        case 'kubernetesWorkload':

            metadata.DOCKER_BUILD_FROM_MASTER = false;
            metadata.DEPLOY_ENVIRONMENT = getDeployEnvironment(metadata);
            metadata.MAESTRO_REPOSITORY = config.teams[metadata.TEAM].repository;
            metadata.DOCKER_IMAGE_NAME = config.containerRegistry.private + '/' + metadata.PROJECT_NAME;
            metadata.DOCKER_IMAGE_TAGS = [metadata.PROJECT_VERSION, metadata.DEPLOY_ENVIRONMENT , metadata.LEGACY ? 'legacy' : 'latest'].join(' ');
            validateVersion(metadata);
            publishMetadata(metadata);
            break;

        case 'lambda':

            metadata.AWS_REGION = process.env.AWS_REGION;
            metadata.FUNCTION_NAME = metadata.PROJECT_NAME.substring(3);
            metadata.ARTIFACT_NAME = metadata.FUNCTION_NAME + '.zip';
            metadata.ARTIFACT_FULLNAME = metadata.FUNCTION_NAME + '-' + metadata.PROJECT_VERSION + '.zip';
            metadata.ARTIFACT_PATH = metadata.FUNCTION_NAME;
            metadata.ARTIFACT_BUCKET = config.lambdaBucketPrefix + '-' + metadata.AWS_REGION;
            publishMetadata(metadata);
            break;

        case 'webapp':

            metadata.ARTIFACT_FILENAME = metadata.PROJECT_NAME + '-' + metadata.PROJECT_VERSION + '.tgz';
            metadata.ARTIFACT_BUCKET = config.webappsArtifactBucket;
            metadata.WEBAPP_BUCKET = config.webappBucketPrefix + '-' + metadata.PROJECT_NAME;
            metadata.SUBDOMAIN = JSON.parse(fs.readFileSync(process.env.GITHUB_WORKSPACE +  '/package.json', 'utf-8'))['subdomain'];
            publishMetadata(metadata);
            break;

        default:

            core.setFailed('Could not build environment variables for ' + metadata.PROJECT_TYPE + '/' + metadata.INTERPRETER);

    }

}).catch(error => core.setFailed(error));
