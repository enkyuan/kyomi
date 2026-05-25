import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export async function handleMcpRequest(request: Request, server: McpServer): Promise<Response> {
  try {
    const jsonRpcRequest = (await request.json()) as JSONRPCMessage;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    let responseData: JSONRPCMessage | null = null;

    clientTransport.onmessage = (message: JSONRPCMessage) => {
      responseData = message;
    };

    // eslint-disable-next-line react-doctor/async-parallel
    await server.connect(serverTransport);

    await Promise.all([clientTransport.start(), serverTransport.start()]);

    await clientTransport.send(jsonRpcRequest);

    await new Promise((resolve) => setTimeout(resolve, 10));

    await Promise.all([clientTransport.close(), serverTransport.close()]);

    return Response.json(responseData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("MCP handler error:", error);

    // Return a JSON-RPC error response
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
          data: error instanceof Error ? error.message : String(error),
        },
        id: null,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
