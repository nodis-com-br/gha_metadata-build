const core = require('@actions/core');
const artifact = require('@actions/artifact');
const fs = require('fs');
const yamlParser = require('yaml');
const fetch = require('node-fetch');
const config = require('./config.js');
const process = require('process');
const standardVersion = require('standard-version');
const standardVersionDockerfileUpdater = require('@damlys/standard-version-updater-docker/dist/dockerfile.js');
const standardVersionDockerComposeUpdater = require('@damlys/standard-version-updater-docker/dist/docker-compose.js');


// Load .env file for local testing
require('dotenv').config();


function getPreReleaseType(ref) {

    for (const k in config.preReleaseType) {
        if (config.preReleaseType.hasOwnProperty(k) && ref.match(config.preReleaseType[k].branchPattern)) return  k;
    }

}

function parsePackageFile(manifestFilePath) {

    try {
        return yamlParser.parse(fs.readFileSync(manifestFilePath, 'utf-8'));
    } catch (e) {
        core.setFailed(e)
    }

}

function getMetadataFromTopics(label, typeCollection, projectTopics, required) {

    let matches = [];
    for (const t of projectTopics) {
        if (Array.isArray(typeCollection)) typeCollection.includes(t) && matches.push(t);
        else t in typeCollection && matches.push(t);
    }

    if (matches.length === 1) return matches[0];
    else if (matches.length === 0) required && core.setFailed('Project missing ' + label + ' topic');
    else core.setFailed('Project has multiple ' + label + ' classes [' + matches.join(' ') + ']');

}

function aggregateProjectClasses() {

    let classArray = [];

    for (const k in config.projectGroup) {
        if (config.projectGroup.hasOwnProperty(k)) classArray = classArray.concat(config.projectGroup[k].classes)
    }

    return classArray
}

function getProjectGroup(projectType) {

    for (const k in config.projectGroup) {
        if (config.projectGroup.hasOwnProperty(k) && config.projectGroup[k].classes.includes(projectType)) return k
    }
}

function publishMetadata(metadata) {

    const artifactClient = artifact.create();
    const packageFile = parsePackageFile(metadata.PACKAGE_FILE, 'utf-8');

    for (const i in config.packageOverrideKeys) {
        const k = config.packageOverrideKeys[i];
        if (k in packageFile) {
            for (const j in packageFile[k]) if (packageFile[k].hasOwnProperty(j)) metadata[j] = packageFile[k][j];
        }
    }

    fs.writeFileSync('./metadata.json', JSON.stringify(metadata, null, 2));

    artifactClient
        .uploadArtifact('metadata', ['metadata.json'], '.')
        .catch(error => core.setFailed(error));

    core.info('Metadata: ' + JSON.stringify(metadata, null, 4));

}

function getDeployEnvironment(metadata) {

    const environment = metadata.PRE_RELEASE_TYPE ? config.preReleaseType[metadata.PRE_RELEASE_TYPE].environment : config.team[metadata.TEAM].environment;

    if (environment) return environment;
    else core.setFailed(['Deployment environment not found:', metadata.TARGET_BRANCH, '/', metadata.PROJECT_VERSION].join(' '));

}

function validateVersion(metadata) {

    if (metadata.PROJECT_VERSION.match(config.environment[metadata.DEPLOY_ENVIRONMENT].versionPattern)) return true;
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
metadata.LEGACY = !!metadata.TARGET_BRANCH.match(config.customBranch.legacy.branchPattern);
metadata.HOTFIX = !!metadata.TARGET_BRANCH.match(config.customBranch.hotfix.branchPattern);

const gitHubUrl = process.env.GITHUB_API_URL + '/repos/' + process.env.GITHUB_REPOSITORY + '/topics';
const gitHubHeaders = {Authorization: 'token ' + core.getInput('github_token'), Accept: "application/vnd.github.mercy-preview+json"};
fetch(gitHubUrl, {headers: gitHubHeaders}).then(response => {

    if (response['status'] === 200) return response['json']();
    else throw ['Could not retrieve topics:', response['status'], response['statusText']].join(' ')

}).then(response => {

    const projectTopics = response['names'];
    metadata.TEAM = getMetadataFromTopics('team', config.team, projectTopics, true);
    metadata.INTERPRETER = getMetadataFromTopics('interpreter', config.interpreter, projectTopics, true);
    metadata.PROJECT_CLASS = getMetadataFromTopics('class', aggregateProjectClasses(), projectTopics, true);
    metadata.PROJECT_GROUP = getProjectGroup(metadata.PROJECT_CLASS);
    metadata.PACKAGE_FILE = process.env.GITHUB_WORKSPACE + '/' + config.projectGroup[metadata.PROJECT_GROUP].packageFile;

    const packageFileContent = parsePackageFile(metadata.PACKAGE_FILE, 'utf-8');
    metadata.SKIP_TESTS = packageFileContent['skip_tests'];
    metadata.PRE_BUMP_VERSION = packageFileContent['version'];

    const packageFileDef = {filename: metadata.PACKAGE_FILE};
    if ('updaterFunction' in config.projectGroup[metadata.PROJECT_GROUP]) packageFileDef.updater = config.projectGroup[metadata.PROJECT_GROUP].updaterFunction;
    else if ('updaterType' in config.projectGroup[metadata.PROJECT_GROUP]) packageFileDef.type = config.projectGroup[metadata.PROJECT_GROUP].updaterType;

    let standardVersionArgv = {
        packageFiles: [
            packageFileDef
        ],
        bumpFiles: [
            packageFileDef,
            {
                filename: "Dockerfile",
                updater: standardVersionDockerfileUpdater
            },
            {
                filename: "docker-compose.yml",
                updater: standardVersionDockerComposeUpdater
            }
        ],
        firstRelease: core.getBooleanInput('first_release'),
        silent: metadata.SKIP_BUMP,
        dryRun: metadata.SKIP_BUMP,
        gitTagFallback: false,
     };

    if (metadata.PRE_RELEASE_TYPE) standardVersionArgv.prerelease = metadata.PRE_RELEASE_TYPE;

    return standardVersion(standardVersionArgv)

}).then(() => {

    metadata.PROJECT_VERSION = parsePackageFile(metadata.PACKAGE_FILE, 'utf-8').version;

    switch(getProjectGroup(metadata.PROJECT_CLASS)) {

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
            metadata.MAESTRO_REPOSITORY = config.team[metadata.TEAM].repository;
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

            core.setFailed('Could not build environment variables for ' + metadata.PROJECT_CLASS + '/' + metadata.INTERPRETER);

    }

}).catch(error => core.setFailed(error));
