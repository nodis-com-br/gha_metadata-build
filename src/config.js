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
        },
        quality: {
            versionPattern: /^\d+\.\d+\.\d+-rc\.\d+$/,
        },
        prod: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_devback',
            topics: ['devback', 'devfront', 'experimento', 'devops', 'prod']
        },
        catalog: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_catalog',
            topics: ['catalog']
        },
        backoffice: {
            versionPattern: /^\d+\.\d+\.\d+$/,
            repository: 'maestro_devback',
            topics: ['backoffice']
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
        kongPlugin: {
            classes: ['kong-plugin'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        vaultPlugin: {
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
        webapp:  {
            classes: ['react-app'],
            packageFile: 'package.json',
            updaterType: 'json'
        },
        lambdaFunction:  {
            classes: ['lambda-function'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        }
    }
};
