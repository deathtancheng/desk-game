import {
  BackendError,
  createDatabaseClient,
  createSiteContext,
  errorResponse,
} from "./_qoder/backend.mjs";
import { application } from "./routes.ts";

const handle = application({ db: createDatabaseClient(), BackendError });

Deno.serve(async (request) => {
  let context;
  try {
    context = createSiteContext(request);
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});
