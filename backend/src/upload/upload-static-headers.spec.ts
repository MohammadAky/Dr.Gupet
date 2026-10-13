import * as express from 'express';
import * as helmet from 'helmet';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { uploadStaticHeaders } from './upload-static-headers';

// This project has no supertest declarations; its CommonJS test adapter needs no new dependency.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
describe('public upload response policy', () => {
  let directory: string;
  let app: express.Express;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'drgupet-corp-'));
    writeFileSync(join(directory, 'pet.png'), Buffer.from([137, 80, 78, 71]));
    writeFileSync(join(directory, 'readme.txt'), 'text');
    app = express();
    app.use(helmet.default());
    app.use('/uploads', express.static(directory, { setHeaders: uploadStaticHeaders }));
    app.get('/api/v1/private', (_req, res) => {
      res.status(401).json({ error: 'unauthorized' });
    });
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  it('overrides CORP only for supported public raster uploads', async () => {
    const response = await request(app)
      .get('/uploads/pet.png')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('keeps nonimage resources and protected API responses at same-origin', async () => {
    const text = await request(app).get('/uploads/readme.txt').expect(200);
    const api = await request(app).get('/api/v1/private').expect(401);
    expect(text.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(api.headers['cross-origin-resource-policy']).toBe('same-origin');
  });
  it('does not relax missing upload responses or promise access from unrelated sites', async () => {
    const missing = await request(app).get('/uploads/missing.png').expect(404);
    const image = await request(app)
      .get('/uploads/pet.png')
      .set('Origin', 'https://unrelated.example')
      .expect(200);
    expect(missing.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(image.headers['cross-origin-resource-policy']).toBe('same-site');
  });
});
