const standardVersionYamlUpdater = require('standard-version-updater-yaml')

module.exports = {
    webappsArtifactBucket: 'nodis-webapp',
    webappBucketPrefix: 'nodis-web',
    lambdaBucketPrefix: 'nodis-lambda',
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
            topics: ['library', 'python-app'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        kubernetesWorkload: {
            topics: ['flask-app', 'nodejs-app', 'django-app', 'cronjob'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        } ,
        publicImage: {
            topics: ['public-image'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        helmChart:  {
            topics: ['helm-chart'],
            packageFile: 'Chart.yaml',
            updaterFunction: standardVersionYamlUpdater
        },
        webapp:  {
            topics: ['react-app'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        },
        lambda:  {
            topics: ['lambda-function'],
            packageFile: 'manifest.json',
            updaterType: 'json'
        }
    }
};
