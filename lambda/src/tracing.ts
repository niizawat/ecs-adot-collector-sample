// Imports
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston'
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray'
import { Resource } from '@opentelemetry/resources'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import { AwsLambdaInstrumentation } from '@opentelemetry/instrumentation-aws-lambda'

// Configure the trace provider
const provider = new NodeTracerProvider({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'samplefunc',
    }),
    idGenerator: new AWSXRayIdGenerator(),
});
provider.register({
    propagator: new AWSXRayPropagator()
});

// Configure how spans are processed and exported. In this case we're sending spans
// as we receive them to an OTLP-compatible collector (e.g. Jaeger).
const exporter = new OTLPTraceExporter();

provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

// Register your auto-instrumentors
registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
        // new WinstonInstrumentation({
        //     logHook: (span, record) => {
        //       record['resource.service.name'] = provider.resource.attributes['service.name'];
        //     },
        // }),
        new HttpInstrumentation(),
        new AwsInstrumentation(),
        new AwsLambdaInstrumentation(),
    ],
});

// Register the provider globally
provider.register();
