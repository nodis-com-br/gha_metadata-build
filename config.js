module.exports = {
    manifestFile: "manifest.json",
    versionConflictMessage: "Version already exists in repository",
    webappsArtifactBucket: 'nodis-webapp',
    webappBucketPrefix: 'nodis-web',
    lambdaBucketPrefix: 'nodis-lambda',
    legacyPattern: /^refs\/heads\/legacy\/.+$/,
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
    interpreters: ['python', 'nodejs', 'shell', 'docker', 'helm'],
    projectClasses: {
        package: ['library', 'python-app'],
        publicImage: ['public-image'],
        privateImage: ['flask-app', 'nodejs-app', 'django-app', 'cronjob'],
        webapp: ['react-app'],
        helmChart: ['helm-chart'],
        lambda: ['lambda-function']
    }
};
