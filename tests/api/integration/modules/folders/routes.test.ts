import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerFolderRoutes } from "@modules/folders/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, silentLogger } from "@api-tests/support/layers";

const FOLDER_ID = "0b0f5b9e-6f7c-4a3e-9b53-1c2d3e4f5a6b";
const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

/** The folder routes as `/api/v1` mounts them: an authenticated user and a request id first. */
function appWith(client: Parameters<typeof fakeDb>[0]) {
  const runtime = ManagedRuntime.make(Layer.mergeAll(fakeDb(client), silentLogger));
  runtimes.push(runtime);
  const authenticated = new Elysia({ prefix: "/api/v1" }).derive(() => ({
    userId: "user-1",
    requestId: "req-1",
  }));
  registerTestErrorHandlers(authenticated);
  return registerFolderRoutes(authenticated as never, runtime) as unknown as {
    handle(request: Request): Promise<Response>;
  };
}

const call = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost/api/v1${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const folderRow = {
  id: FOLDER_ID,
  userId: "user-1",
  name: "Reading",
  isPinned: false,
  pinnedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("registerFolderRoutes", () => {
  test("POST /folders answers 201 with the created folder", async () => {
    const app = appWith({
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({ returning: () => Promise.resolve([folderRow]) }),
        }),
      }),
    });

    const response = await app.handle(call("POST", "/folders", { name: "Reading" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: FOLDER_ID,
      name: "Reading",
      isPinned: false,
      pinnedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("POST /folders on a duplicate renders the 409 error envelope", async () => {
    const app = appWith({
      insert: () => ({
        values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }) }),
      }),
    });

    const response = await app.handle(call("POST", "/folders", { name: "Reading" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        message: "Folder already exists",
        code: "FOLDER_DUPLICATE",
        requestId: expect.any(String),
      },
    });
  });

  test("DELETE /folders/:id answers 204 once the folder is gone", async () => {
    let selects = 0;
    const app = appWith({
      select: () => {
        selects += 1;
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve(
                  selects === 1
                    ? [{ id: FOLDER_ID, name: "Reading" }]
                    : [{ ...folderRow, name: "Unsorted" }],
                ),
            }),
          }),
        };
      },
      insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve() }) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    });

    const response = await app.handle(call("DELETE", `/folders/${FOLDER_ID}`));

    expect(response.status).toBe(204);
  });

  test("PUT /folders/:id for another user's folder renders FOLDER_NOT_FOUND", async () => {
    const app = appWith({
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    });

    const response = await app.handle(call("PUT", `/folders/${FOLDER_ID}`, { isPinned: true }));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { message: "Folder not found", code: "FOLDER_NOT_FOUND" },
    });
  });

  test("a database failure renders the opaque 500 envelope", async () => {
    const app = appWith({
      select: () => {
        throw new Error("password authentication failed for user postgres");
      },
    });

    const response = await app.handle(call("GET", "/folders"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { message: "Internal error", code: "INTERNAL_ERROR" },
    });
  });
});
