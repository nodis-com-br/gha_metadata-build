const standardVersionYamlUpdater = require('standard-version-updater-yaml');

module.exports = {
    webappsArtifactBucket: 'nodis-webapp',
    webappBucketPrefix: 'nodis-web',
    lambdaBucketPrefix: 'nodis-lambda',
    masterBranchPattern: /^refs\/heads\/master$/,
    containerRegistry: {
        public: 'docker.io/nodisbr',
        private: 'registry.nodis.com.br'
    },
    packageOverrideKeys: [
        "overrides",
        "annotations"
    ],
    preReleaseType: {
        dev: {
            branchPattern: /^refs\/heads\/develop$/,
            environment: 'dev'
        },
        rc: {
            branchPattern: /^refs\/heads\/release\/.+$/,
            environment: 'quality'
        },
    },
    customBranch: {
        legacy: {
            branchPattern: /^refs\/heads\/legacy\/.+$/
        },
        hotfix: {
            branchPattern: /^refs\/heads\/hotfix\/.+$/,
            environment: 'quality'
        }
    },
    environment: {
        dev: {
            versionPattern: /^\d+\.\d+\.\d+-dev\.\d+$/
        },
        quality: {
            versionPattern: /^\d+\.\d+\.\d+-rc\.\d+$/
        },
        prod: {
            versionPattern: /^\d+\.\d+\.\d+$/
        },
        catalog: {
            versionPattern: /^\d+\.\d+\.\d+$/
        }
    },
    team: {
        devback: {
            repository: 'maestro_devback',
            environment: 'prod'
        },
        devfront: {
            repository: 'maestro_devback',
            environment: 'prod'
        },
        experimento: {
            repository: 'maestro_experimento',
            environment: 'prod'
        },
        devops: {
            repository: 'maestro_devback',
            environment: 'prod'
        },
        catalog: {
            repository: 'maestro_catalog',
            environment: 'catalog'
        }
    },
    interpreter: ['python', 'nodejs', 'shell', 'docker', 'helm'],
    projectGroup: {
        package: {
            classes: ['library', 'python-app'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        kubernetesWorkload: {
            classes: ['flask-app', 'nodejs-app', 'django-app', 'cronjob'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        } ,
        publicImage: {
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
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        lambda:  {
            classes: ['lambda-function'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        }
    }
};
