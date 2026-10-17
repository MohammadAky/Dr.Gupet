import * as express from 'express';
import { productSyncJson } from './sync-body-parser';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
describe('Scoped product sync transport', () => {
  it('accepts a bounded larger CSV JSON only on sync routes and leaves ordinary JSON parsing intact', async () => {
    const app = express();
    app.use('/sync', productSyncJson());
    app.use(express.json());
    app.post('/sync/preview', (req, res) => res.json({ length: req.body.value.length }));
    app.post('/ordinary', (req, res) => res.json(req.body));
    await request(app)
      .post('/sync/preview')
      .send({ value: 'x'.repeat(120000) })
      .expect(200, { length: 120000 });
    await request(app)
      .post('/ordinary')
      .send({ value: 'x'.repeat(120000) })
      .expect(413);
    await request(app)
      .post('/sync/preview')
      .send({ value: 'x'.repeat(1100000) })
      .expect(413);
    await request(app).post('/ordinary').send({ value: 'small' }).expect(200, { value: 'small' });
    expect(productSyncJson().name).not.toBe('jsonParser');
  });
});
