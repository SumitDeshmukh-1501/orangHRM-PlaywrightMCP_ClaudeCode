// TEMPORARY probe — logs live observed behavior only, no assertions.
// Deleted immediately after verification.
import { test, request } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';

test.skip('probe login endpoints', async () => {
  const anon = await request.newContext({ baseURL: BASE });
  const r401 = await anon.get('/web/index.php/api/v2/dashboard/employees/action-summary');
  console.log('401 probe status:', r401.status());
  console.log('401 probe body:', JSON.stringify(await r401.text()));
  console.log('401 content-type:', r401.headers()['content-type']);
  await anon.dispose();

  for (const creds of [
    { label: 'VALID', username: 'Admin', password: 'admin123' },
    { label: 'BOGUS', username: 'zz_bogus_user_7t1v', password: 'zz_bogus_pass_7t1v' },
  ]) {
    const ctx = await request.newContext({ baseURL: BASE });
    const loginPage = await ctx.get('/web/index.php/auth/login');
    const html = await loginPage.text();
    const m = html.match(/name="_token"[^>]*value="([^"]+)"/);
    console.log(`[${creds.label}] GET login status:`, loginPage.status(), 'token found:', !!m, 'len:', m?.[1].length);

    const post = await ctx.post('/web/index.php/auth/validate', {
      form: { _token: m![1], username: creds.username, password: creds.password },
      maxRedirects: 0,
    });
    console.log(`[${creds.label}] POST validate status:`, post.status());
    console.log(`[${creds.label}] Location:`, post.headers()['location']);

    const dash = await ctx.get('/web/index.php/dashboard/index');
    console.log(`[${creds.label}] GET dashboard status:`, dash.status(), 'final url:', dash.url());

    const api = await ctx.get('/web/index.php/api/v2/dashboard/employees/action-summary');
    console.log(`[${creds.label}] API action-summary status:`, api.status(), 'body:', (await api.text()).slice(0, 160));
    await ctx.dispose();
  }
});
