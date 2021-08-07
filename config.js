module.exports = {
    manifestFile: "manifest.json",
    versionConflictMessage: "Version already exists in repository",
    webappsArtifactBucket: 'nodis-webapp',
    webappBucketPrefix: 'nodis-web',
    lambdaBucketPrefix: 'nodis-lambda',
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
    projectClasses: {
        package: ['library', 'python-app'],
        kubernetesWorkload: ['flask-app', 'nodejs-app', 'django-app', 'cronjob'],
        publicImage: ['public-image'],
        webapp: ['react-app'],
        helmChart: ['helm-chart'],
        lambda: ['lambda-function']
    }
};
