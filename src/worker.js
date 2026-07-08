export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth") {
      return handleAuth(request, env);
    }
    if (url.pathname === "/api/callback") {
      return handleCallback(request, env);
    }

    // selain 2 path di atas, tampilkan file statis seperti biasa
    return env.ASSETS.fetch(request);
  }
};

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/callback`;
  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
  return Response.redirect(authorizeUrl, 302);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      code
    })
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    return new Response('OAuth error: ' + JSON.stringify(tokenData), { status: 400 });
  }

  const message = JSON.stringify({ token: tokenData.access_token, provider: 'github' });
  const html = `<script>
    (function() {
      function receiveMessage() {
        window.opener.postMessage('authorization:github:success:${message}', '*');
        window.removeEventListener('message', receiveMessage, false);
      }
      window.addEventListener('message', receiveMessage, false);
      window.opener.postMessage('authorizing:github', '*');
    })();
  </script>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
