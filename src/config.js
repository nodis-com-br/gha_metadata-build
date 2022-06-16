const standardVersionYamlUpdater = require("standard-version-updater-yaml");
const standardVersionDockerfileUpdater = require("@damlys/standard-version-updater-docker/dist/dockerfile");
const standardVersionDockerComposeUpdater = require("@damlys/standard-version-updater-docker");

module.exports = {
    bucketPrefix: 'nodis',
    lambdaBucketPrefix: 'nodis-lambda',
    containerRegistry: 'ghcr.io/nodis-com-br',
    packageOverrideKeys: [
        "overrides",
        "annotations"
    ],
    packageFiles:  [
        {
            filename: "manifest.json",
            type: 'json'
        },
        {
            filename: "package.json",
            type: 'json'
        },
        {
            filename: "Chart.yaml",
            updater: standardVersionYamlUpdater
        }
    ],
    bumpFiles:  [
        {
            filename: "Dockerfile",
            updater: standardVersionDockerfileUpdater
        },
        {
            filename: "docker-compose.yml",
            updater: standardVersionDockerComposeUpdater
        }
    ],
    branchType: {
        dev: {
            pattern: /^refs\/heads\/develop$/,
            environment: 'dev',
            preRelease: true
        },
        rc: {
            pattern: /^refs\/heads\/release\/.+$/,
            environment: 'quality',
            preRelease: true
        },
        hotfix: {
            pattern: /^refs\/heads\/hotfix\/.+$/,
            environment: 'quality',
            preRelease: true
        },
        legacy: {
            pattern: /^refs\/heads\/legacy\/.+$/,
            environment: null,
            preRelease: false
        },
        default: {
            pattern: /^refs\/heads\/(main|master)$/,
            environment: null,
            preRelease: false
        }
    },
    environment: {
        dev: {
            versionPattern: /^\d+\.\d+\.\d+-dev\.\d+$/,
            targetCluster: "dev-k8s0002",
            defaultNamespace: "default"
        },
        quality: {
            versionPattern: /^\d+\.\d+\.\d+-rc\.\d+$/,
            targetCluster: "quality-k8s0002",
            defaultNamespace: "default"
        },
        prod: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_devback',
            topics: ['devback', 'prod'],
            targetCluster: "prod-k8s0001",
            defaultNamespace: "default"
        },
        catalog: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_catalog',
            topics: ['catalog'],
            targetCluster: "catalog-k8s0002",
            defaultNamespace: "default"

        },
        backoffice: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_devback',
            topics: ['backoffice'],
            targetCluster: "backoffice-k8s0002",
            defaultNamespace: "default"
        },
    },
    interpreter: ['python', 'nodejs', 'lua', 'csharp', 'golang', 'shell', 'docker', 'helm'],
    projectWorkflow: {
        package: {
            classes: ['package', 'library', 'python-app', 'kong-plugin', 'vault-plugin']
        },
        kubernetesWorkload: {
            classes: ['deployment', 'cronjob', 'flask-app', 'nodejs-app', 'django-app', 'csharp-app']
        },
        dockerImage: {
            classes: ['docker-image', 'public-image']
        },
        helmChart:  {
            classes: ['helm-chart']
        },
        website:  {
            classes: ['website', 'react-app']
        },
        lambdaFunction:  {
            classes: ['lambda-function']
        }
    }
};
