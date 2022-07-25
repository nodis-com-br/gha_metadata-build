// Load .env file for local testing
require('dotenv').config();

const core = require('@actions/core');
const artifact = require('@actions/artifact');
const fs = require('fs');
const yamlParser = require('yaml');
const fetch = require('node-fetch');
const config = require('./config.js');
const process = require('process');
const standardVersion = require('standard-version');
const environmentStream = fs.createWriteStream(process.env.GITHUB_ENV, {flags:'a'});


function getPreReleaseType(ref) {
    for (const k in config.branchType) {
        if (config.branchType.hasOwnProperty(k) && config.branchType[k].preRelease && ref.match(config.branchType[k].pattern)) return k;
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

function getPackageFile() {
    let packageFile
    for (let i = 0; i < config.packageFiles.length; ++i ){
        let fullFilename = process.env.GITHUB_WORKSPACE + '/' + config.packageFiles[i].filename;
        if  (fs.existsSync(fullFilename)) {
            packageFile = fullFilename
            break
        }
    }
    if (packageFile) return packageFile
    else core.setFailed("Package file not found")
}

function parsePackageFile(manifestFilePath) {
    try {
        return yamlParser.parse(fs.readFileSync(manifestFilePath, 'utf-8'));
    } catch (e) {
        core.setFailed(e)
    }
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

function getEnvironment(metadata, projectTopics) {
    let environment
    for (const k in config.environment) {
        if (config.environment.hasOwnProperty(k) && config.environment[k].hasOwnProperty('topics')) {
            if (getMetadataFromTopics('environments', config.environment[k].topics, projectTopics, false)) {
                environment = k
            }
        }
    }
    return environment
}

function getDeployEnvironment(metadata) {
    if (metadata.PRE_RELEASE_TYPE) return config.branchType[metadata.PRE_RELEASE_TYPE].environment;
    else if (metadata.HOTFIX) return config.branchType.hotfix.environment;
    else return metadata.ENVIRONMENT
}

function matchVersionToBranch(metadata) {
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && !metadata.PROJECT_VERSION.match(config.environment[metadata.DEPLOY_ENVIRONMENT].versionPattern)) {
        core.setFailed(['Branch mismatch: version', metadata.PROJECT_VERSION, 'should not be committed to branch', metadata.TARGET_BRANCH].join(' '));
    }
}

function publishMetadata(metadata) {
    const artifactClient = artifact.create();
    const packageFile = parsePackageFile(metadata.PACKAGE_FILE);
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


let packageFileContent, metadata = {
    SKIP_BUMP: core.getBooleanInput('skip_bump'),
    PROJECT_NAME: process.env.GITHUB_REPOSITORY.split('/')[1],
    REPOSITORY_OWNER: process.env.GITHUB_REPOSITORY.split('/')[0],
    TARGET_BRANCH: process.env.GITHUB_BASE_REF ? 'refs/heads/' + process.env.GITHUB_BASE_REF : process.env.GITHUB_REF
};

metadata.REPOSITORY_NAME = metadata.PROJECT_NAME;
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
    metadata.ENVIRONMENT = getEnvironment(metadata, projectTopics);
    metadata.LANGUAGE = getMetadataFromTopics('language', config.language, projectTopics, true);
    metadata.PROJECT_CLASS = getMetadataFromTopics('class', aggregateProjectClasses(), projectTopics, true);
    metadata.PROJECT_WORKFLOW = getProjectWorkflow(metadata.PROJECT_CLASS);
    metadata.PACKAGE_FILE = getPackageFile();
    packageFileContent = parsePackageFile(metadata.PACKAGE_FILE);
    metadata.SKIP_BUMP = 'SKIP_BUMP' in packageFileContent ? packageFileContent.SKIP_BUMP : metadata.SKIP_BUMP;
    metadata.SKIP_TESTS = 'skip_tests' in packageFileContent ? packageFileContent['skip_tests'] : false;
    metadata.PRE_BUMP_VERSION = packageFileContent['version'];

    environmentStream.write('SKIP_BUMP=' + metadata.SKIP_BUMP.toString()  + '\n');

    let standardVersionArgv = {
        packageFiles: config.packageFiles,
        bumpFiles: Array.prototype.concat(config.packageFiles, config.bumpFiles),
        firstRelease: core.getBooleanInput('first_release'),
        silent: metadata.SKIP_BUMP,
        dryRun: metadata.SKIP_BUMP,
        gitTagFallback: false,
     };

    if (metadata.PRE_RELEASE_TYPE) standardVersionArgv.prerelease = metadata.PRE_RELEASE_TYPE;

    return standardVersion(standardVersionArgv)

}).then(() => {

    metadata.PROJECT_VERSION = parsePackageFile(metadata.PACKAGE_FILE).version;

    switch(metadata.PROJECT_WORKFLOW) {

        case 'library':
        case 'luaRock':
            break;

        case 'dockerImage':
            metadata.PROJECT_NAME = metadata.PROJECT_NAME.replace(/^(dk|docker)[_-]/, '');
            metadata.DOCKER_BUILD_FROM_MASTER = true;
            metadata.DOCKER_IMAGE_NAME = config.containerRegistry + '/' + metadata.PROJECT_NAME;
            metadata.DOCKER_IMAGE_TAGS = 'latest ' + metadata.PROJECT_VERSION;
            break;

        case 'kubernetesWorkload':
            metadata.DOCKER_BUILD_FROM_MASTER = false;
            metadata.DEPLOY_ENVIRONMENT = getDeployEnvironment(metadata);
            matchVersionToBranch(metadata);
            metadata.MAESTRO_REPOSITORY = config.environment[metadata.ENVIRONMENT].repository;
            metadata.DOCKER_IMAGE_NAME = config.containerRegistry + '/' + metadata.PROJECT_NAME;
            metadata.DOCKER_IMAGE_TAGS = [metadata.PROJECT_VERSION, metadata.DEPLOY_ENVIRONMENT , metadata.LEGACY ? 'legacy' : 'latest'].join(' ');
            metadata.KUBERNETES_CLUSTER = config.environment[metadata.DEPLOY_ENVIRONMENT].targetCluster
            metadata.KUBERNETES_NAMESPACE = config.environment[metadata.DEPLOY_ENVIRONMENT].defaultNamespace
            metadata.KUBERNETES_WORKLOAD_TYPE = metadata.PROJECT_CLASS === 'cronjob' ? metadata.PROJECT_CLASS : "deployment"
            metadata.KUBERNETES_WORKLOAD_NAME = metadata.PROJECT_NAME.replace(/_/g, '-')
            if (metadata.TARGET_BRANCH.match(config.branchType.default.pattern) && metadata.PRE_BUMP_VERSION.match(config.environment.quality.versionPattern)) {
                metadata.VALIDATED_VERSION = metadata.PRE_BUMP_VERSION
            }
            break;

        case 'helmChart':
            metadata.PROJECT_NAME = metadata.PROJECT_NAME.replace(/^(chart|charts)[_-]/, '');
            metadata.CHART_TYPE = packageFileContent.type;
            metadata.ARTIFACT_NAME = metadata.PROJECT_NAME + '-' + metadata.PROJECT_VERSION + '.tgz'
            break;

        case 'website':
            metadata.DEPLOY_ENVIRONMENT = getDeployEnvironment(metadata);
            matchVersionToBranch(metadata);
            metadata.SUBDOMAIN = packageFileContent['subdomain'];
            metadata.CUSTOM_TYPES = JSON.stringify(packageFileContent.hasOwnProperty('custom_types') ? packageFileContent['custom_types'] : '[]');
            metadata.ARTIFACT_FILENAME = metadata.PROJECT_NAME + '-' + metadata.PROJECT_VERSION + '.tgz';
            metadata.WEBAPP_BUCKET = config.bucketPrefix + '-' + metadata.DEPLOY_ENVIRONMENT + '-' + metadata.SUBDOMAIN;
            metadata.VAULT_ROLE = metadata.DEPLOY_ENVIRONMENT + '-' + metadata.SUBDOMAIN;
            break;

        case 'lambdaFunction':
            metadata.AWS_REGION = process.env.AWS_REGION;
            metadata.FUNCTION_NAME = metadata.PROJECT_NAME.replace(/^(lb|lambda)[_-]/, '');
            metadata.ARTIFACT_NAME = metadata.FUNCTION_NAME + '.zip';
            metadata.ARTIFACT_FULLNAME = metadata.FUNCTION_NAME + '-' + metadata.PROJECT_VERSION + '.zip';
            metadata.ARTIFACT_PATH = metadata.FUNCTION_NAME;
            metadata.ARTIFACT_BUCKET = config.lambdaBucketPrefix + '-' + metadata.AWS_REGION;
            break;

        case 'goApplication': {
            metadata.GO_BUILD_IMAGE_TAG = packageFileContent["go_build_image_tag"]
            metadata.GO_MAIN_FILE = packageFileContent["go_main_file"]
            break;
        }
        default:
            core.setFailed('no workflow not found for ' + metadata.PROJECT_CLASS);

    }

    publishMetadata(metadata);

}).catch(error => core.setFailed(error));
