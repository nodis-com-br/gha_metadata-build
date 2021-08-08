const standardVersionYamlUpdater = require.resolve('standard-version-updater-yaml');
const standardVersionJsonUpdater = require('standard-version/lib/updaters/types/json');

module.exports = {
    versionConflictMessage: "Version already exists in repository",
    webappsArtifactBucket: 'nodis-webapp',
    webappBucketPrefix: 'nodis-web',
    lambdaBucketPrefix: 'nodis-lambda',
    containerRegistry: {
        public: 'docker.io/nodisbr',
        private: 'registry.nodis.com.br'
    },
    preReleaseTypes: {
        dev: {
            branchPattern: /^refs\/heads\/develop$/,
            environment: 'dev'
        },
        rc: {
            branchPattern: /^refs\/heads\/release\/.+$/,
            environment: 'quality'
        },
    },
    customBranches: {
        legacy: {
            branchPattern: /^refs\/heads\/legacy\/.+$/
        },
        hotfix: {
            branchPattern: /^refs\/heads\/hotfix\/.+$/,
            environment: 'quality'
        }
    },
    environments: {
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
    teams: {
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
    interpreters: ['python', 'nodejs', 'shell', 'docker', 'helm'],
    projectGroups: {
        package: {
            topics: ['library', 'python-app'],
            manifestFile: 'manifest.json',
            updater: standardVersionJsonUpdater
        },
        kubernetesWorkload: {
            topics: ['flask-app', 'nodejs-app', 'django-app', 'cronjob'],
            manifestFile: 'manifest.json',
            updater: standardVersionJsonUpdater
        } ,
        publicImage: {
            topics: ['public-image'],
            manifestFile: 'manifest.json',
            updater: standardVersionJsonUpdater
        },
        helmChart:  {
            topics: ['helm-chart'],
            manifestFile: 'Chart.yaml',
            updater: standardVersionYamlUpdater
        },
        webapp:  {
            topics: ['react-app'],
            manifestFile: 'manifest.json',
            updater: standardVersionJsonUpdater
        },
        lambda:  {
            topics: ['lambda-function'],
            manifestFile: 'manifest.json',
            updater: standardVersionJsonUpdater
        }
    }
};
