'use strict';

jest.mock('../../configs/db');
jest.mock('../../models/userModel');

const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApp } = require('../../app');
const userModel = require('../../models/userModel');

const app = createApp();
const PASSWORD = 'Passw0rd!';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    userModel.findConflicts.mockResolvedValue({ username: false, phone: false });
    userModel.create.mockResolvedValue(11);
  });

  test('[positive] a valid registration returns 201 and never logs the user in', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'carol', phone: '0833333333', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      id: 11,
      username: 'carol',
      phone: '0833333333',
      role: 'Customer',
      points: 0
    });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('[negative] a password without a digit returns 400 with details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'carol', phone: '0833333333', password: 'short1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(userModel.create).not.toHaveBeenCalled();
  });

  test('[negative] a taken username or phone returns 409 CONFLICT', async () => {
    userModel.findConflicts.mockResolvedValue({ username: true, phone: false });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', phone: '0833333333', password: PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(userModel.create).not.toHaveBeenCalled();
  });

  test('[negative] a role field in the body is ignored (no privilege escalation)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'mallory', phone: '0844444444', password: PASSWORD, role: 'Admin' });

    const args = userModel.create.mock.calls[0][0];
    expect(args.role).toBe('Customer');
    expect(args.shopId).toBeNull();
  });
});

describe('POST /api/auth/login', () => {
  let hash;

  beforeAll(async () => {
    hash = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(() => {
    userModel.findByUsernameWithHash.mockResolvedValue({
      id: 5,
      username: 'alice',
      phone: '0811111111',
      points: 120,
      role: 'Customer',
      shopId: null,
      passwordHash: hash
    });
  });

  test('[positive] valid credentials return 200 with an HttpOnly SameSite=Strict cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('alice');
    expect(res.body.data.redirectTo).toBe('/customer/dashboard');

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toContain('token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  test('[negative] the token is never returned in the JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: PASSWORD });

    expect(res.body.data.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('eyJ');
  });

  test('[negative] a wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Wrong1234' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('[negative] an unknown user still runs bcrypt.compare and returns 401', async () => {
    userModel.findByUsernameWithHash.mockResolvedValue(null);
    const spy = jest.spyOn(bcrypt, 'compare');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalled();
  });
});

describe('POST /api/auth/logout', () => {
  test('[positive] logout clears the cookie even without a session', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Logged out');
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toContain('token=');
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
