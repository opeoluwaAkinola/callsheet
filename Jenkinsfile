// Declarative pipeline: parallel build/test of every component, JUnit reporting,
// then image build + push to ECR and a Terraform plan on main.
pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds(abortPrevious: true)
  }

  environment {
    AWS_REGION   = 'us-west-2'
    ECR_REGISTRY = credentials('callsheet-ecr-registry') // e.g. 123456789012.dkr.ecr.us-west-2.amazonaws.com
    IMAGE_TAG    = "${env.GIT_COMMIT.take(12)}"
  }

  stages {
    stage('Build & test') {
      parallel {
        stage('scheduling-service') {
          agent { docker { image 'eclipse-temurin:21-jdk'; reuseNode true } }
          steps {
            dir('services/scheduling-service') { sh './mvnw -B verify' }
          }
          post {
            always { junit 'services/scheduling-service/target/surefire-reports/*.xml' }
          }
        }
        stage('crew-service') {
          agent { docker { image 'node:20'; reuseNode true } }
          steps { dir('services/crew-service') { sh 'npm ci && npm run lint && npx vitest run --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml' } }
          post { always { junit 'services/crew-service/reports/*.xml' } }
        }
        stage('gateway') {
          agent { docker { image 'node:20'; reuseNode true } }
          steps { dir('services/gateway') { sh 'npm ci && npm run lint && npx vitest run --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml' } }
          post { always { junit 'services/gateway/reports/*.xml' } }
        }
        stage('callsheet-pdf lambda') {
          agent { docker { image 'node:20'; reuseNode true } }
          steps { dir('functions/callsheet-pdf') { sh 'npm ci && npm run lint && npx vitest run --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml && npm run build' } }
          post { always { junit 'functions/callsheet-pdf/reports/*.xml' } }
        }
        stage('web') {
          agent { docker { image 'node:20'; reuseNode true } }
          steps { dir('web') { sh 'npm ci && npx vitest run --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml && npm run build' } }
          post { always { junit 'web/reports/*.xml' } }
        }
      }
    }

    stage('End-to-end') {
      steps {
        sh 'docker compose up --build -d --wait'
        sh './scripts/smoke-test.sh http://localhost:8080'
      }
      post {
        failure { sh 'docker compose logs' }
        always { sh 'docker compose down -v' }
      }
    }

    stage('Publish images') {
      when { branch 'main' }
      steps {
        withAWS(region: env.AWS_REGION, credentials: 'callsheet-aws') {
          sh 'aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY'
          script {
            ['scheduling-service': 'services/scheduling-service', 'crew-service': 'services/crew-service',
             'gateway': 'services/gateway', 'web': 'web'].each { name, path ->
              sh "docker build -t ${ECR_REGISTRY}/callsheet/${name}:${IMAGE_TAG} ${path}"
              sh "docker push ${ECR_REGISTRY}/callsheet/${name}:${IMAGE_TAG}"
            }
          }
        }
      }
    }

    stage('Terraform plan') {
      when { branch 'main' }
      agent { docker { image 'hashicorp/terraform:1.9'; args '--entrypoint='; reuseNode true } }
      steps {
        withAWS(region: env.AWS_REGION, credentials: 'callsheet-aws') {
          dir('infra/terraform') {
            sh 'terraform init -input=false && terraform plan -input=false -out=tfplan'
            archiveArtifacts artifacts: 'tfplan'
          }
        }
      }
    }
  }
}
