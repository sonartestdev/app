import React, { useMemo, useState } from "react";
import JSZip from "jszip";

// A small, self-contained web app that:
// 1) Loads a template JSON (paste or upload)
// 2) Generates N payloads with unique requestId, EDIPI, NPI, secId, Names, email
// 3) Lets you download all payloads as a .zip
// 4) Optionally sends them as HTTP request bodies to a REST endpoint
//
// Notes:
// - All generation happens in-browser.
// - Sending uses fetch(). For cross-domain endpoints, CORS must allow it.
// - If your service requires mTLS, private network access, or blocks browsers, use the Python CLI instead.

function utcNowIsoZ() {
  const d = new Date();
  // seconds precision
  const iso = new Date(Math.floor(d.getTime() / 1000) * 1000).toISOString();
  return iso; // already ends with Z
}

function randDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randUpper(n) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function makeRequestId(prefix) {
  // Similar to: PREFIX-YYYY-MM-DD_HHMM_X
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const suffix = randUpper(1);
  return `${prefix}-${yyyy}-${mm}-${dd}_${hh}${mi}_${suffix}`;
}

function makeSecId() {
  return `${randDigits(10)}${randUpper(1)}`;
}

function luhnCheckDigit(numStr) {
  // Luhn for numeric string (no check digit)
  let total = 0;
  const rev = numStr.split("").reverse();
  for (let i = 0; i < rev.length; i++) {
    let d = Number(rev[i]);
    if (i % 2 === 0) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  const check = (10 - (total % 10)) % 10;
  return String(check);
}

function makeNpi() {
  // NPI: 10 digits, check digit is Luhn over '80840' + first9
  const first9 = randDigits(9);
  const base = `80840${first9}`;
  const check = luhnCheckDigit(base);
  return `${first9}${check}`;
}

function makeEdipi() {
  // T + 9 digits + BLL + 3 digits + Z
  return `T${randDigits(9)}BLL${randDigits(3)}Z`;
}

function makeMiddleName() {
  return `UC${randDigits(3)}`;
}

function normalizeEmailLocalPart(s) {
  return s
    .trim()
    .replace(/[^A-Za-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .toUpperCase();
}

function makeEmail(given, sur, seq, domain) {
  const local = normalizeEmailLocalPart(`${given}.${sur}${seq}`);
  return `${local}@${domain}`;
}

const FIRST_NAMES = [
  "Jacob",
  "Emma",
  "Noah",
  "Olivia",
  "Liam",
  "Ava",
  "Mason",
  "Sophia",
  "Ethan",
  "Mia",
  "Lucas",
  "Amelia",
  "Logan",
  "Isabella",
  "James",
  "Harper",
  "Benjamin",
  "Evelyn",
  "Alexander",
  "Ella",
  "Daniel",
  "Aria",
  "Henry",
  "Scarlett",
  "Michael",
  "Grace",
];

const LAST_NAMES = [
  "Adams",
  "Baker",
  "Carter",
  "Davis",
  "Edwards",
  "Foster",
  "Garcia",
  "Hughes",
  "Iverson",
  "Johnson",
  "Kim",
  "Lopez",
  "Mitchell",
  "Nguyen",
  "Owens",
  "Patel",
  "Quinn",
  "Roberts",
  "Sanders",
  "Turner",
  "Usman",
  "Vasquez",
  "Walker",
  "Xu",
  "Young",
  "Zimmerman",
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
}

function safeGet(obj, path) {
  try {
    let cur = obj;
    for (const k of path) cur = cur[k];
    return cur;
  } catch {
    return undefined;
  }
}

function templateLooksLikeApds(template) {
  // Minimal sanity checks for the sample structure
  return (
    typeof template === "object" &&
    template !== null &&
    safeGet(template, ["apdsRequest", "messageMetaData", "requestId"]) !== undefined &&
    safeGet(template, ["apdsRequest", "identityAttributes", "EDIPI"]) !== undefined
  );
}

function buildHeaders(rawHeadersLines, bearerToken) {
  const headers = {};
  const lines = rawHeadersLines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) headers[k] = v;
  }

  if (bearerToken.trim()) headers["Authorization"] = `Bearer ${bearerToken.trim()}`;
  headers["Content-Type"] = "application/json";
  return headers;
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="text-base font-semibold">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-gray-600">{subtitle}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 6 }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border px-3 py-2 text-sm font-mono outline-none focus:ring-2"
      />
    </label>
  );
}

function Button({ children, onClick, disabled, variant = "primary" }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "border bg-black text-white hover:opacity-90"
      : variant === "danger"
        ? "border bg-red-600 text-white hover:opacity-90"
        : "border bg-white text-black hover:bg-gray-50";
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full border bg-white">
        <div className="h-2 rounded-full bg-black" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const [templateText, setTemplateText] = useState("{");
  const [templateFileName, setTemplateFileName] = useState("(none)");
  const [templateError, setTemplateError] = useState("");

  const [count, setCount] = useState("10");
  const [requestIdPrefix, setRequestIdPrefix] = useState("BLLTEST");
  const [emailDomain, setEmailDomain] = useState("VA.TEST.COM");

  const [generated, setGenerated] = useState([]); // array of { filename, json, meta }
  const [genError, setGenError] = useState("");

  // Sender controls
  const [sendUrl, setSendUrl] = useState("");
  const [sendMethod, setSendMethod] = useState("POST");
  const [sendHeaders, setSendHeaders] = useState("X-Env: test");
  const [bearerToken, setBearerToken] = useState("");
  const [concurrency, setConcurrency] = useState("3");
  const [delayMs, setDelayMs] = useState("0");

  const [sending, setSending] = useState(false);
  const [sendLog, setSendLog] = useState([]); // {filename, status, ok, error}
  const [sentCount, setSentCount] = useState(0);

  const parsedTemplate = useMemo(() => {
    try {
      const obj = JSON.parse(templateText);
      setTemplateError("");
      return obj;
    } catch (e) {
      setTemplateError(String(e?.message || e));
      return null;
    }
  }, [templateText]);

  async function onUploadTemplate(file) {
    const text = await file.text();
    setTemplateText(text);
    setTemplateFileName(file.name);
  }

  function generatePayloads() {
    setGenError("");
    if (!parsedTemplate) {
      setGenError("Template JSON is invalid.");
      return;
    }
    if (!templateLooksLikeApds(parsedTemplate)) {
      setGenError(
        "Template doesn't look like the expected structure (missing apdsRequest.messageMetaData.requestId or apdsRequest.identityAttributes.EDIPI)."
      );
      return;
    }

    const n = Math.max(1, Math.min(5000, Number(count) || 0));

    const seen = {
      requestId: new Set(),
      edipi: new Set(),
      npi: new Set(),
      secId: new Set(),
      email: new Set(),
      name: new Set(),
    };

    const out = [];

    for (let i = 1; i <= n; i++) {
      const p = deepClone(parsedTemplate);

      let given = "";
      let sur = "";
      let middle = "";
      for (let tries = 0; tries < 1000; tries++) {
        given = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        sur = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        middle = makeMiddleName();
        const key = `${given}|${sur}|${middle}`;
        if (!seen.name.has(key)) {
          seen.name.add(key);
          break;
        }
      }

      let rid = "";
      for (let tries = 0; tries < 1000; tries++) {
        rid = makeRequestId(requestIdPrefix);
        if (!seen.requestId.has(rid)) {
          seen.requestId.add(rid);
          break;
        }
      }

      let edipi = "";
      for (let tries = 0; tries < 1000; tries++) {
        edipi = makeEdipi();
        if (!seen.edipi.has(edipi)) {
          seen.edipi.add(edipi);
          break;
        }
      }

      let npi = "";
      for (let tries = 0; tries < 1000; tries++) {
        npi = makeNpi();
        if (!seen.npi.has(npi)) {
          seen.npi.add(npi);
          break;
        }
      }

      let secId = "";
      for (let tries = 0; tries < 1000; tries++) {
        secId = makeSecId();
        if (!seen.secId.has(secId)) {
          seen.secId.add(secId);
          break;
        }
      }

      let email = "";
      for (let tries = 0; tries < 1000; tries++) {
        email = makeEmail(given, sur, i, emailDomain);
        if (!seen.email.has(email)) {
          seen.email.add(email);
          break;
        }
      }

      // Apply updates in the same known locations as your sample
      setPath(p, ["apdsRequest", "messageMetaData", "requestId"], rid);
      setPath(p, ["apdsRequest", "messageMetaData", "requestDateTime"], utcNowIsoZ());

      setPath(p, ["apdsRequest", "identityAttributes", "givenName"], given);
      setPath(p, ["apdsRequest", "identityAttributes", "surName"], sur);
      setPath(p, ["apdsRequest", "identityAttributes", "middleName"], middle);
      setPath(p, ["apdsRequest", "identityAttributes", "primaryEmail"], email);
      setPath(p, ["apdsRequest", "identityAttributes", "EDIPI"], edipi);
      setPath(p, ["apdsRequest", "identityAttributes", "secId"], secId);
      setPath(p, ["apdsRequest", "identityAttributes", "NPI"], npi);

      const filename = `${rid}__${sur}_${given}.json`.replace(/:/g, "-");
      out.push({
        filename,
        json: p,
        meta: { requestId: rid, givenName: given, surName: sur, middleName: middle, EDIPI: edipi, NPI: npi, secId, email },
      });
    }

    setGenerated(out);
    setSendLog([]);
    setSentCount(0);
  }

  async function downloadZip() {
    const zip = new JSZip();
    for (const item of generated) {
      zip.file(item.filename, JSON.stringify(item.json, null, 2) + "\n");
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apds_payloads_${generated.length}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSingle(idx) {
    const item = generated[idx];
    const blob = new Blob([JSON.stringify(item.json, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function sendAll() {
    setGenError("");
    if (!generated.length) {
      setGenError("Generate payloads first.");
      return;
    }
    if (!sendUrl.trim()) {
      setGenError("Enter a destination URL to send requests.");
      return;
    }

    const headers = buildHeaders(sendHeaders, bearerToken);
    const method = (sendMethod || "POST").toUpperCase();
    const conc = Math.max(1, Math.min(50, Number(concurrency) || 1));
    const delay = Math.max(0, Math.min(60000, Number(delayMs) || 0));

    setSending(true);
    setSendLog([]);
    setSentCount(0);

    // Simple concurrency pool
    let idx = 0;
    let okCount = 0;
    const log = [];

    async function worker(workerId) {
      while (true) {
        const myIdx = idx;
        idx += 1;
        if (myIdx >= generated.length) return;

        const item = generated[myIdx];
        if (delay) await sleep(delay);

        try {
          const resp = await fetch(sendUrl, {
            method,
            headers,
            body: JSON.stringify(item.json),
          });
          const text = await resp.text().catch(() => "");
          const ok = resp.status >= 200 && resp.status < 300;
          if (ok) okCount += 1;

          log.push({
            filename: item.filename,
            status: resp.status,
            ok,
            error: ok ? "" : (text || resp.statusText || "Request failed").slice(0, 500),
          });
        } catch (e) {
          log.push({
            filename: item.filename,
            status: 0,
            ok: false,
            error: String(e?.message || e),
          });
        }

        setSentCount((c) => c + 1);
        // Update UI occasionally
        if (log.length % 5 === 0) setSendLog([...log]);
      }
    }

    const workers = Array.from({ length: conc }, (_, i) => worker(i + 1));
    await Promise.all(workers);

    // Final flush
    setSendLog([...log]);
    setSending(false);
  }

  function resetAll() {
    setGenerated([]);
    setSendLog([]);
    setSentCount(0);
    setGenError("");
  }

  const templateOk = parsedTemplate && !templateError;
  const samplePreview = generated[0]?.json ? JSON.stringify(generated[0].json, null, 2) : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-2">
          <div className="text-2xl font-bold">APDS Payload Generator & Sender</div>
          <div className="text-sm text-gray-600">
            Load a template JSON, generate unique sample create-transaction payloads, download as ZIP, and optionally POST them to an endpoint.
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge>Unique per file: requestId</Badge>
            <Badge>EDIPI</Badge>
            <Badge>NPI</Badge>
            <Badge>secId</Badge>
            <Badge>Names</Badge>
            <Badge>email</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
            title="1) Template"
            subtitle={
              templateFileName === "(none)"
                ? "Paste your sample create-transaction JSON, or upload it."
                : `Loaded: ${templateFileName}`
            }
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadTemplate(f);
                  }}
                  className="block w-full text-sm"
                />
              </div>
              <TextArea
                label="Template JSON"
                value={templateText}
                onChange={setTemplateText}
                placeholder="Paste your template JSON here..."
                rows={12}
              />
              <div className="rounded-xl border bg-gray-50 p-3 text-xs">
                <div className="font-semibold">Template status</div>
                <div className="mt-1">
                  {templateOk ? (
                    <span className="text-green-700">Looks valid.</span>
                  ) : (
                    <span className="text-red-700">Invalid JSON or missing expected APDS fields.</span>
                  )}
                </div>
                {templateError ? <div className="mt-1 text-red-700">JSON parse error: {templateError}</div> : null}
              </div>
            </div>
          </Card>

          <Card title="2) Generate" subtitle="Choose how many payloads to create and how to format requestId/email.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Count (1–5000)" value={count} onChange={setCount} placeholder="10" type="number" />
              <Input label="requestId prefix" value={requestIdPrefix} onChange={setRequestIdPrefix} placeholder="BLLTEST" />
              <Input label="Email domain" value={emailDomain} onChange={setEmailDomain} placeholder="VA.TEST.COM" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={generatePayloads} disabled={!templateOk}>
                Generate
              </Button>
              <Button onClick={resetAll} variant="secondary" disabled={!generated.length && !sendLog.length}>
                Reset
              </Button>
              <div className="ml-auto flex items-center gap-2 text-sm text-gray-700">
                <span className="font-semibold">Generated:</span>
                <span>{generated.length}</span>
              </div>
            </div>

            {genError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{genError}</div> : null}

            {generated.length ? (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={downloadZip}>Download ZIP</Button>
                  <Button
                    onClick={() => {
                      if (generated.length) downloadSingle(0);
                    }}
                    variant="secondary"
                  >
                    Download first JSON
                  </Button>
                  <div className="text-xs text-gray-600">
                    Tip: filenames are <span className="font-mono">requestId__Last_First.json</span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">Preview (first payload)</div>
                    <div className="text-xs text-gray-600">
                      requestId: <span className="font-mono">{generated[0].meta.requestId}</span>
                    </div>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-xl border bg-white p-3 text-xs">{samplePreview}</pre>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="3) Send" subtitle="POST/PUT/PATCH the generated payloads to a REST endpoint (browser fetch).">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="URL" value={sendUrl} onChange={setSendUrl} placeholder="https://your-service.example.com/apds" />
              <Input label="Method" value={sendMethod} onChange={setSendMethod} placeholder="POST" />
              <Input label="Concurrency (1–50)" value={concurrency} onChange={setConcurrency} type="number" />
              <Input label="Delay per request (ms)" value={delayMs} onChange={setDelayMs} type="number" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextArea
                label="Extra headers (one per line: Key: Value)"
                value={sendHeaders}
                onChange={setSendHeaders}
                placeholder={`X-Env: test\nX-Trace: 123`}
                rows={5}
              />
              <TextArea
                label="Bearer token (optional)"
                value={bearerToken}
                onChange={setBearerToken}
                placeholder="paste token here"
                rows={5}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={sendAll} disabled={sending || !generated.length}>
                {sending ? "Sending…" : "Send all"}
              </Button>
              <Button
                variant="secondary"
                disabled={!generated.length}
                onClick={() => {
                  // Quick one-off curl-ish export: download a .txt with curl examples
                  const headers = buildHeaders(sendHeaders, bearerToken);
                  const item = generated[0];
                  const headerFlags = Object.entries(headers)
                    .map(([k, v]) => `-H ${JSON.stringify(`${k}: ${v}`)}`)
                    .join(" ");
                  const curl = `curl -X ${sendMethod.toUpperCase()} ${JSON.stringify(sendUrl || "https://YOUR_URL") } \\n  ${headerFlags} \\n  --data-binary @${JSON.stringify(item.filename)}`;
                  const blob = new Blob([curl + "\n"], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "curl_example.txt";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
              >
                Export curl example
              </Button>

              <div className="ml-auto w-64">
                <ProgressBar value={sentCount} max={generated.length || 1} />
              </div>
            </div>

            {generated.length ? (
              <div className="mt-4 text-sm text-gray-700">
                Sent <span className="font-semibold">{sentCount}</span> / {generated.length}
              </div>
            ) : null}

            {sendLog.length ? (
              <div className="mt-4 rounded-2xl border bg-white">
                <div className="border-b px-4 py-3 text-sm font-semibold">Send results</div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2">File</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sendLog
                        .slice()
                        .sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1))
                        .map((r) => (
                          <tr key={r.filename} className="border-t">
                            <td className="px-4 py-2 font-mono">{r.filename}</td>
                            <td className="px-4 py-2">{r.status || "—"}</td>
                            <td className="px-4 py-2">
                              {r.ok ? (
                                <span className="text-green-700">OK</span>
                              ) : (
                                <span className="text-red-700">{r.error || "Failed"}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border bg-gray-50 p-3 text-xs text-gray-700">
              <div className="font-semibold">Browser caveats</div>
              <ul className="mt-1 list-disc pl-5">
                <li>
                  The destination service must allow CORS for your origin. If it doesn’t, use the Python CLI sender (server-side) instead.
                </li>
                <li>Authorization headers are supported; mTLS/private network constraints are not (in a normal browser).</li>
              </ul>
            </div>
          </Card>

          <Card title="4) Generated index" subtitle="Quick glance at the unique fields per payload.">
            {!generated.length ? (
              <div className="text-sm text-gray-600">Generate payloads to see the index here.</div>
            ) : (
              <div className="max-h-[520px] overflow-auto rounded-2xl border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">requestId</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">EDIPI</th>
                      <th className="px-4 py-2">NPI</th>
                      <th className="px-4 py-2">secId</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.map((item, i) => (
                      <tr key={item.filename} className="border-t">
                        <td className="px-4 py-2">{i + 1}</td>
                        <td className="px-4 py-2 font-mono">{item.meta.requestId}</td>
                        <td className="px-4 py-2">{item.meta.surName}, {item.meta.givenName} {item.meta.middleName}</td>
                        <td className="px-4 py-2 font-mono">{item.meta.email}</td>
                        <td className="px-4 py-2 font-mono">{item.meta.EDIPI}</td>
                        <td className="px-4 py-2 font-mono">{item.meta.NPI}</td>
                        <td className="px-4 py-2 font-mono">{item.meta.secId}</td>
                        <td className="px-4 py-2">
                          <Button variant="secondary" onClick={() => downloadSingle(i)}>
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="mt-8 text-xs text-gray-500">
          If you need this app wired to a backend (so you can send without CORS and keep secrets off the browser), tell me what stack you want
          (Flask/FastAPI/Node/OCI Functions), and I’ll produce a minimal server that exposes <span className="font-mono">/generate</span> and <span className="font-mono">/send</span>.
        </div>
      </div>
    </div>
  );
}
