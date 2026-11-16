'use strict';

jest.mock('../../configs/db');

const request = require('supertest');
const { createApp } = require('../../app');
const db = require('../../configs/db');

const app = createApp();

describe('GET /api/health', () => {
  test('[positive] reports host details and database status', async () => {
    db.ping.mockResolvedValue(true);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.hostname).toBe('string');
    expect(res.body.data.db).toBe('up');
    expect(res.body.data.status).toBe('ok');
  });
});
