/*tracing.ts*/

import { NodeSDK } from '@opentelemetry/sdk-node';
// import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
// import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const exporter = new OTLPTraceExporter({
  url: 'https://api.honeycomb.io:443/v1/traces',
  headers: { 'x-honeycomb-team': process.env.HONEYCOMB_API_KEY },
  concurrencyLimit: 100,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'nestjs-yogi-example',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0',
  }),
  traceExporter: exporter,
  spanProcessor: new BatchSpanProcessor(exporter),
  // traceExporter: new ConsoleSpanExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-graphql': { enabled: true, mergeItems: true, depth: -1, allowValues: true },
    }),
  ],
});

sdk.start();
