// LOCAL DEVELOPMENT ONLY. The production build uses worker/index.js instead.
import app from './index.js';
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (env.LOCAL_DEVELOPMENT !== 'enabled' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return new Response('Local development wrapper: localhost requests only.', {status: 403});
    }
    if (url.pathname === '/signin-with-chatgpt' || url.pathname === '/signout-with-chatgpt') {
      return Response.redirect(new URL('/login', request.url).href, 302);
    }
    const headers = new Headers(request.headers);
    headers.set('oai-authenticated-user-id', 'local-development-admin');
    headers.set('oai-authenticated-user-email', 'local-admin@example.test');
    headers.set('oai-authenticated-user-full-name', 'Jace Roman');
    headers.delete('oai-authenticated-user-full-name-encoding');
    return app.fetch(new Request(request, {headers}), env, ctx);
  }
};
