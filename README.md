# SK Vision AI — Gemini-inspired HTML Image Studio + ImgUpscaler Gateway

A mobile-responsive HTML image editing studio served from the same Node.js 22+ Render API gateway, with upload/prompt UX and the five provided ImgUpscaler API groups. No NPM dependencies and no self-imposed request-count limit. The upstream service's credits, authentication, limits, terms, and Render's platform limits still apply.

**Important:** Even though the interface is ready to use, the upstream request/response schema for sign-object and create-job has not been publicly verified. This gateway transparently forwards your *real* JSON payload and upstream response. It cannot infer required fields or make requests work without valid authorization when upstream requires it.

## Deploy to Render

1. Create a GitHub repository and upload the files in this folder (including `index.html`, `server.js`, and `render.yaml`). Do **not** upload `.env`.
2. Render dashboard → New → Blueprint → connect your GitHub repository → deploy the service.
3. Render → Service → Environment: configure `IMGUPSCALER_COOKIE` and/or `IMGUPSCALER_AUTHORIZATION` if **your own account** needs them. Set `IMGUPSCALER_ORIGIN` and `IMGUPSCALER_REFERER` only if actually required. For custom upstream headers use `UPSTREAM_HEADERS_JSON`.
4. Render Blueprint sets a random `API_KEY`; copy it from your environment and send it in `X-API-Key` for API requests.
5. Open `https://your-app.onrender.com/` to launch the image studio. Open **API connection**, enter your Render `API_KEY`, then press **Test API Connection**. The key is never embedded in the HTML.
6. For signed uploads whose object storage blocks cross-origin browser requests, the interface falls back to `POST /api/upload/object`, restricted by `UPLOAD_ALLOWED_HOST_SUFFIXES` (configure only trusted, authorized storage domains). The default includes common cloud storage suffixes.
7. Replace `https://your-app.onrender.com` in the examples with the real Render URL.

## Routes

| Method | Local route | Upstream route |
|---|---|---|
| POST | `/api/upload/object` | Safe signed-upload PUT fallback (local gateway; 24 MB default) |
| POST | `/api/upload/sign` | `/api/common/upload/sign-object` |
| POST | `/api/jobs/create` | `/api/runtime/jobs/create-job` |
| GET | `/api/jobs/{JOB_ID}` | `/api/runtime/jobs/{JOB_ID}` |
| GET | `/api/credits` | `/api/business/config/free-credits-config` |
| GET | `/api/task-config?task=enhance` | `/api/runtime/system-parameters?full_key=router_free.image_enhance_v1` |
| GET | `/api/task-config?task=remove-object` | `/api/runtime/system-parameters?full_key=router_free.me_remove_object_v1` |
| GET | `/api/task-config?task=remove-background` | `/api/runtime/system-parameters?full_key=router_free.me_remove_background_v1` |
| GET | `/api/health` | local health check |

Original ImgUpscaler paths also work with your own Render domain. Analytics/tracking URLs are intentionally not proxied.

## HTML Image Studio

`index.html` is the single-page, mobile-friendly UI. Its features include image selection, four AI task modes, prompt text, task and sign JSON templates, job polling, result download, local brightness/contrast/saturation adjustments, and detailed upstream error diagnostics.

**The prompt-edit model was not present in the user-supplied set of task keys.** A prompt field in the UI does not imply the upstream Enhance task will interpret it. To enable unrestricted natural-language edits, you must have the actual authorized ImgUpscaler prompt-edit task key and exact upstream `sign-object` and `create-job` request schemas. Configure both under **Advanced API request templates**. The default bodies are illustrative and may return errors. This is not an official Gemini product and does not use Gemini AI.

To add the editor to an **existing** GitHub/Render API, upload `index.html`, **replace** `server.js` with the new version, and redeploy. Do not upload the ZIP file itself as your GitHub file tree. The web editor is now hosted on the gateway root; API documentation JSON moved to `/api`.

Caution: authentication is always required for upstream actions. The `API_KEY` goes into the on-page password box. Do not hardcode a secret into a public HTML page, commit a `.env` file, or distribute the gateway key to strangers.

## API requests

### Health (no key needed)
```bash
curl 'https://your-app.onrender.com/api/health'
```

### Task config
```bash
curl 'https://your-app.onrender.com/api/task-config?task=enhance' \
  -H 'X-API-Key: YOUR_GATEWAY_API_KEY'
```

### Credit configuration (this is NOT necessarily your account balance)
```bash
curl 'https://your-app.onrender.com/api/credits' \
  -H 'X-API-Key: YOUR_GATEWAY_API_KEY'
```

### Get a signed upload URL
```bash
curl -X POST 'https://your-app.onrender.com/api/upload/sign' \
  -H 'X-API-Key: YOUR_GATEWAY_API_KEY' \
  -H 'Content-Type: application/json' \
  --data-binary @sign-request.json
```
`sign-request.json` must contain exactly the JSON the upstream endpoint expects (from official documentation or an authorized request you own). The returned signed URL generally requires a separate upload of image bytes to storage; that storage URL is not one of the five endpoints. Use its response-specified HTTP method/headers and do not forward your gateway API key to the storage URL.

### Start image-edit job
```bash
curl -X POST 'https://your-app.onrender.com/api/jobs/create' \
  -H 'X-API-Key: YOUR_GATEWAY_API_KEY' \
  -H 'Content-Type: application/json' \
  --data-binary @job-request.json
```
`job-request.json` is the actual upstream job payload including the correct uploaded object reference and task parameters. Its schema has not been verified; this project deliberately does not invent it.

### Poll a job
```bash
curl 'https://your-app.onrender.com/api/jobs/ACTUAL_JOB_ID' \
  -H 'X-API-Key: YOUR_GATEWAY_API_KEY'
```

## Local run

```bash
cp .env.example .env
# Edit the .env file locally. Never push .env to GitHub.
npm start
```

Node.js 22+ required. Configure CORS_ORIGIN to your frontend's exact origin(s), separated by commas, if calling directly from a browser. Do not ship the gateway API key or upstream cookies in public frontend source.

## Limits and security

- **No artificial daily usage cap** in this gateway. Upstream service credit/rate limits and your Render plan still apply. A wrapper cannot make an upstream service unlimited or free.
- Access is protected by `API_KEY` in production. A public unprotected gateway could consume credits from your account.
- Requests and responses from upstream are forwarded without changing JSON field names.
- Uploaded signed-storage files are capped at `MAX_UPLOAD_BYTES` (24 MB by default). The signed PUT fallback rejects private IP addresses, HTTP URLs, and unapproved storage domain suffixes to mitigate SSRF.
- POST request body size cap `MAX_BODY_BYTES` defaults to 5 MB; this is for small JSON requests, not direct binary uploads. Adjust if necessary.
- The signed upload flow still needs the correct upstream JSON schema and a separate object-storage upload step.
