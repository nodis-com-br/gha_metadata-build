const standardVersionYamlUpdater = require('standard-version-updater-yaml');

module.exports = {
    bucketPrefix: 'nodis',
    lambdaBucketPrefix: 'nodis-lambda',
    containerRegistry: 'ghcr.io/nodis-com-br',
    packageOverrideKeys: [
        "overrides",
        "annotations"
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
            targetCluster: "k8s0002",
            defaultNamespace: "default"
        },
        quality: {
            versionPattern: /^\d+\.\d+\.\d+-rc\.\d+$/,
            targetCluster: "k8s0002",
            defaultNamespace: "default"
        },
        prod: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_devback',
            topics: ['devback', 'devfront', 'experimento', 'devops', 'prod'],
            targetCluster: "k8s0001",
            defaultNamespace: "default"
        },
        catalog: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_catalog',
            topics: ['catalog'],
            targetCluster: "k8s0002",
            defaultNamespace: "default"

        },
        backoffice: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_devback',
            topics: ['backoffice'],
            targetCluster: "k8s0002",
            defaultNamespace: "default"

        }
    },
    interpreter: ['python', 'nodejs', 'shell', 'docker', 'helm', 'lua', 'dotnet', 'golang'],
    projectWorkflow: {
        package: {
            classes: ['library', 'python-app'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        kubernetesWorkload: {
            classes: ['flask-app', 'nodejs-app', 'django-app', 'cronjob', 'csharp-app'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        luaPackage: {
            classes: ['kong-plugin'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        golangApp: {
            classes: ['vault-plugin'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        baseImage: {
            classes: ['public-image'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        helmChart:  {
            classes: ['helm-chart'],
            packageFile: 'Chart.yaml',
            updaterModule: standardVersionYamlUpdater
        },
        staticWebsite:  {
            classes: ['react-app'],
            packageFile: 'package.json',
            updaterType: 'json'
        },
        admissionController: {
            classes: ['admission-controller'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        lambdaFunction:  {
            classes: ['lambda-function'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        }
    }
};
