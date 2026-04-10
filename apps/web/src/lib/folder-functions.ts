import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

export const listFolders = createServerFn({ method: "GET" }).handler(
  async (): Promise<Folder[]> => {
    const headers = buildForwardHeaders(getRequestHeaders());

    return apiJson<Folder[]>("/api/v1/folders", {
      headers,
    });
  },
);

export const createFolder = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }): Promise<Folder> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJson<Folder>("/api/v1/folders", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: data.name.trim() }),
    });
  });
