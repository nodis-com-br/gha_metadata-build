module.exports = {
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
            updaterFunction: require('standard-version-updater-yaml')
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
