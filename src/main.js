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

    for (const k in config.branchType) {
        if (config.branchType.hasOwnProperty(k) && config.branchType[k].preRelease && ref.match(config.branchType[k].pattern)) return k;
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
    else core.setFailed('Project has multiple ' + label + ' topics [' + matches.join(' ') + ']');

}

function aggregateProjectClasses() {

    let classArray = [];

    for (const k in config.projectWorkflow) {
        if (config.projectWorkflow.hasOwnProperty(k)) classArray = classArray.concat(config.projectWorkflow[k].classes)
    }

    return classArray
}

function getProjectWorkflow(projectClass) {

    for (const k in config.projectWorkflow) {
        if (config.projectWorkflow.hasOwnProperty(k) && config.projectWorkflow[k].classes.includes(projectClass)) return k
    }
}


function getDeployEnvironment(metadata) {

    if (metadata.PRE_RELEASE_TYPE) return config.branchType[metadata.PRE_RELEASE_TYPE].environment;
    else if (metadata.HOTFIX) return config.branchType.hotfix.environment;
    else return config.team[metadata.TEAM].environment;

}

function matchVersionToBranch(metadata) {

    if (!metadata.PROJECT_VERSION.match(config.environment[metadata.DEPLOY_ENVIRONMENT].versionPattern)) {
        core.setFailed(['Branch mismatch: version', metadata.PROJECT_VERSION, 'should not be committed to branch', metadata.TARGET_BRANCH].join(' '));
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

///////////////////////////////////////////////////////////////////////////////


let metadata = {
    SKIP_BUMP: core.getBooleanInput('skip_bump'),
    PROJECT_NAME: process.env.GITHUB_REPOSITORY.split('/')[1],
    TARGET_BRANCH: process.env.GITHUB_EVENT_NAME === 'push' ? process.env.GITHUB_REF : 'refs/heads/' + process.env.GITHUB_BASE_REF,
};

metadata.PRE_RELEASE_TYPE = getPreReleaseType(metadata.TARGET_BRANCH);
metadata.LEGACY = !!metadata.TARGET_BRANCH.match(config.branchType.legacy.pattern);
metadata.HOTFIX = !!metadata.TARGET_BRANCH.match(config.branchType.hotfix.pattern);

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
    metadata.PROJECT_WORKFLOW = getProjectWorkflow(metadata.PROJECT_CLASS);
    metadata.PACKAGE_FILE = process.env.GITHUB_WORKSPACE + '/' + config.projectWorkflow[metadata.PROJECT_WORKFLOW].packageFile;

    const packageFileContent = parsePackageFile(metadata.PACKAGE_FILE, 'utf-8');
    metadata.SKIP_TESTS = 'skip_tests' in packageFileContent ? packageFileContent['skip_tests'] : false;
    metadata.PRE_BUMP_VERSION = packageFileContent['version'];

    const packageFileDef = {filename: metadata.PACKAGE_FILE};
    if ('updaterModule' in config.projectWorkflow[metadata.PROJECT_WORKFLOW]) packageFileDef.updater = config.projectWorkflow[metadata.PROJECT_WORKFLOW].updaterModule;
    else if ('updaterType' in config.projectWorkflow[metadata.PROJECT_WORKFLOW]) packageFileDef.type = config.projectWorkflow[metadata.PROJECT_WORKFLOW].updaterType;

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

    switch(metadata.PROJECT_WORKFLOW) {

        case 'package':

            break;

        case 'helmChart':

            metadata.PROJECT_NAME = metadata.PROJECT_NAME.replace(/^charts_/, '');
            break;

        case 'publicImage':

            metadata.DOCKER_BUILD_FROM_MASTER = true;
            metadata.DOCKER_IMAGE_NAME = config.containerRegistry.public + '/' + metadata.PROJECT_NAME.replace(/^dk_/, '');
            metadata.DOCKER_IMAGE_TAGS = 'latest ' + metadata.PROJECT_VERSION;
            break;

        case 'kubernetesWorkload':

            metadata.DOCKER_BUILD_FROM_MASTER = false;
            metadata.DEPLOY_ENVIRONMENT = getDeployEnvironment(metadata);
            process.env.GITHUB_EVENT_NAME === 'pull_request' && matchVersionToBranch(metadata);
            metadata.MAESTRO_REPOSITORY = config.team[metadata.TEAM].repository;
            metadata.DOCKER_IMAGE_NAME = config.containerRegistry.private + '/' + metadata.PROJECT_NAME;
            metadata.DOCKER_IMAGE_TAGS = [metadata.PROJECT_VERSION, metadata.DEPLOY_ENVIRONMENT , metadata.LEGACY ? 'legacy' : 'latest'].join(' ');
            if (metadata.TARGET_BRANCH.match(config.branchType.default.pattern) && metadata.PRE_BUMP_VERSION.match(config.environment.quality.versionPattern)) {
                metadata.VALIDATED_VERSION = metadata.PRE_BUMP_VERSION
            }
            break;

        case 'lambdaFunction':

            metadata.AWS_REGION = process.env.AWS_REGION;
            metadata.FUNCTION_NAME = metadata.PROJECT_NAME.replace(/^lb_/, '');
            metadata.ARTIFACT_NAME = metadata.FUNCTION_NAME + '.zip';
            metadata.ARTIFACT_FULLNAME = metadata.FUNCTION_NAME + '-' + metadata.PROJECT_VERSION + '.zip';
            metadata.ARTIFACT_PATH = metadata.FUNCTION_NAME;
            metadata.ARTIFACT_BUCKET = config.lambdaBucketPrefix + '-' + metadata.AWS_REGION;
            break;

        case 'webapp':

            metadata.ARTIFACT_FILENAME = metadata.PROJECT_NAME + '-' + metadata.PROJECT_VERSION + '.tgz';
            metadata.ARTIFACT_BUCKET = config.webappsArtifactBucket;
            metadata.WEBAPP_BUCKET = config.webappBucketPrefix + '-' + metadata.PROJECT_NAME;
            metadata.SUBDOMAIN = JSON.parse(fs.readFileSync(process.env.GITHUB_WORKSPACE +  '/package.json', 'utf-8'))['subdomain'];
            break;

        default:

            core.setFailed('Workflow not found for ' + metadata.PROJECT_CLASS);

    }

    publishMetadata(metadata);

}).catch(error => core.setFailed(error));
