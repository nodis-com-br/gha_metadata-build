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
            topics: ['prod'],
            targetCluster: "prod-k8s0002",
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
    language: ['javascript', 'typescript', 'python', 'lua', 'csharp', 'go', 'shell', 'helm', 'docker'],
    projectWorkflow: {
        library: {
            classes: ['package', 'library']
        },
        kubernetesWorkload: {
            classes: ['deployment', 'cronjob']
        },
        dockerImage: {
            classes: ['docker-image']
        },
        helmChart:  {
            classes: ['helm-chart']
        },
        goApplication: {
            classes: ['vault-plugin']
        },
        luaRock: {
            classes: ['kong-plugin']
        },
        website:  {
            classes: ['website', 'react-app']
        },
        lambdaFunction:  {
            classes: ['lambda-function']
        }
    }
};
