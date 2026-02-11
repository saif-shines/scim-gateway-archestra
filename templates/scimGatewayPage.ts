/**
 * Renders the SCIM Gateway Admin Portal page.
 *
 * The given `src` is used as the iframe source for the embedded
 * Scalekit admin portal.
 */
export function renderScimGatewayPage(src: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SCIM Gateway for Archestra AI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background-color: #0f172a;
        color: #e5e7eb;
      }
      .container {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 40px;
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
      }
      p {
        margin-top: 0;
        margin-bottom: 1.25rem;
        color: #9ca3af;
      }
      .frame-wrapper {
        border-radius: 0.75rem;
        overflow: hidden;
        box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.5),
          0 10px 10px -5px rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(148, 163, 184, 0.4);
        background-color: #020617;
      }
      iframe {
        width: 100%;
        height: 800px;
        border: 0;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>SCIM Gateway for Archestra AI</h1>
      <p>Automate provisioning access to Archestra dashboard and its services.</p>
      <div class="frame-wrapper">
        <iframe
          src="${src}"
          allow="clipboard-write"
        ></iframe>
      </div>
    </div>
  </body>
</html>`;
}
