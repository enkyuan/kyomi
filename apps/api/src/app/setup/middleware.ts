/**
 * Re-exports shared Elysia stacks. Implementations live in `@shared/http/stacks`
 * so feature modules do not depend on the `app/` layer.
 */
export {
  apiV1AdapterPlugin,
  databaseAdapterPlugin,
  requestObservationPlugin,
} from "@shared/http/stacks";
