import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Peer, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDrivers } from 'aws-cdk-lib/aws-ecs';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Architecture, DockerImageCode, DockerImageFunction, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { DnsRecordType, NamespaceType } from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';

export class EcsAdotCollectorSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket
    const bucket = new Bucket(this, 'SampleBucket', {
      bucketName: `sample-bucket-${this.account}`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // VPC
    const vpc = new Vpc(this, 'Vpc', {
      vpcName: 'SampleVpc',
      natGateways: 1,
    });
    // ECS Cluster
    const cluster = new Cluster(this, 'EcsCluster', {
      clusterName: 'SampleCluster',
      vpc: vpc,
      defaultCloudMapNamespace: {
        name: 'sample.com',
        type: NamespaceType.DNS_PRIVATE,
        vpc: vpc,
      }
    });
    // ECS TaskDefinition
    const taskdef = new FargateTaskDefinition(this, 'TaskDefinition', {
      family: 'SampleTask',
      cpu: 512,
      memoryLimitMiB: 1024,      
    });
    taskdef.addContainer('AdotCollector', {
      containerName: 'collector',
      image: ContainerImage.fromRegistry('amazon/aws-otel-collector'),
      portMappings: [
        { containerPort: 4317 },
        { containerPort: 4318 },
      ],
      logging: LogDrivers.awsLogs({
        logGroup: new LogGroup(this, 'ADOTLogGroup', {
          logGroupName: 'sample-adot-log',
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        streamPrefix: 'adot',
      })
    });
    taskdef.taskRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));

    // Security Group
    const sg = new SecurityGroup(this, 'ContainerSg', {
      securityGroupName: 'container-sg',
      vpc: vpc,
      allowAllOutbound: true,
    });
    sg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(4317), 'allow OTEL/gRPC');
    sg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(4318), 'allow OTEL/HTTP');
    // ECS Service
    const service = new FargateService(this, 'SampleService', {
      serviceName: 'SampleService',
      cluster: cluster,
      taskDefinition: taskdef,
      securityGroups: [sg],
      cloudMapOptions: {
        name: 'collector',
        dnsRecordType: DnsRecordType.A,
      },
    });

    // Lambda Function
    const layerArn = 'arn:aws:lambda:ap-northeast-1:901920570463:layer:aws-otel-nodejs-arm64-ver-1-7-0:2';
    const func = new DockerImageFunction(this, 'DockerImageFunction', {
      functionName: 'samplefunc',
      architecture: Architecture.ARM_64,
      code: DockerImageCode.fromImageAsset('lambda/', {
        buildArgs: {
          AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'] || '',
          AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'] || '',
          AWS_SESSION_TOKEN: process.env['AWS_SESSION_TOKEN'] || '',
          AWS_DEFAULT_REGION: process.env['AWS_DEFAULT_REGION'] || '',
          ADOT_LAYER_ARN: layerArn,
        }
      }),
      memorySize: 1024,
      environment: {
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector.sample.com:4318',
        BUCKET_NAME: bucket.bucketName,
        // Instrumentをカスタマイズする場合はwrapper.jsを自前で準備する
        // NODE_OPTIONS: '--require "/var/task/dist/wrapper.js" ${NODE_OPTIONS}',
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
      },
      // vpc: vpc,
      tracing: Tracing.ACTIVE,
    });

    bucket.grantReadWrite(func);

  }
}
