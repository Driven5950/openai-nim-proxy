const https = require("https");

const NIM_API_KEY = process.env.NIM_API_KEY || "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";
const NIM_BASE_URL = "integrate.api.nvidia.com";

const MODELS = [
  { id: "minimaxai/minimax-m2.5", object: "model", owned_by: "minimaxai" },
  { id: "qwen/qwen3.5-397b-a17b", object: "model", owned_by: "qwen" },
  { id: "z-ai/glm5", object: "model", owned_by: "z-ai" },
  { id: "minimaxai/minimax-m2.1", object: "model", owned_by: "minimaxai" },
  { id: "stepfun-ai/step-3.5-flash", object: "model", owned_by: "stepfun-ai" },
  { id: "moonshotai/kimi-k2.5", object: "model", owned_by: "moonshotai" },
  { id: "z-ai/glm4.7", object: "model", owned_by: "z-ai" },
  { id: "deepseek-ai/deepseek-v3.2", object: "model", owned_by: "deepseek-ai" },
  { id: "deepseek-ai/deepseek-v3.1-terminus", object: "model", owned_by: "deepseek-ai" },
  { id: "qwen/qwen3-next-80b-a3b-instruct", object: "model", owned_by: "qwen" },
  { id: "mistralai/devstral-2-123b-instruct-2512", object: "model", owned_by: "mistralai" },
  { id: "mistralai/mistral-large-3-675b-instruct-2512", object: "model", owned_by: "mistralai" },
  { id: "qwen/qwen3-coder-480b-a35b-instruct", object: "model", owned_by: "qwen" },
];

function sendJSON(res, status, data) {
  res.status(status).json(data);
}

function proxyToNIM(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: NIM_BASE_URL,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NIM_API_KEY}`,
        Accept: "text/event-stream",
      },
    };

    const req = https.request(options, (nimRes) => {
      resolve(nimRes);
    });

    req.on("error", reject);

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";

  // Models endpoint
  if (url.includes("/models")) {
    return sendJSON(res, 200, {
      object: "list",
      data: MODELS.map((m) => ({
        ...m,
        created: 1700000000,
        id: m.id,
      })),
    });
  }

  // Chat completions
  if (url.includes("/chat/completions") && req.method === "POST") {
    const body = req.body;

    if (!body || !body.model) {
      return sendJSON(res, 400, { error: { message: "Missing model in request body" } });
    }

    // Force thinking off, reasoning on
    const nimBody = {
      ...body,
      stream: body.stream || false,
    };

    // Remove thinking param if present, ensure no think tags
    delete nimBody.thinking;

    // Add reasoning effort if model supports it (won't break others)
    nimBody.reasoning_effort = "default";

    const stream = nimBody.stream;

    try {
      const nimRes = await proxyToNIM(
        "/v1/chat/completions",
        "POST",
        {},
        nimBody
      );

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        nimRes.pipe(res);
      } else {
        let data = "";
        nimRes.on("data", (chunk) => (data += chunk));
        nimRes.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            // Strip <think> blocks from content if present
            if (parsed.choices) {
              parsed.choices = parsed.choices.map((choice) => {
                if (choice.message && choice.message.content) {
                  choice.message.content = choice.message.content
                    .replace(/<think>[\s\S]*?<\/think>/gi, "")
                    .trim();
                }
                return choice;
              });
            }
            sendJSON(res, nimRes.statusCode, parsed);
          } catch (e) {
            res.status(nimRes.statusCode).send(data);
          }
        });
      }
    } catch (err) {
      return sendJSON(res, 500, { error: { message: err.message } });
    }

    return;
  }

  // Fallback
  return sendJSON(res, 404, { error: { message: "Not found" } });
};
