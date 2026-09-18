import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a user successfully', () => {
    const createUserDto = { name: 'Test User', email: 'test@example.com' };
    return request(app.getHttpServer())
      .post('/api/v1/users')
      .send(createUserDto)
      .expect(201)
      .then((res) => {
        // The response body is now wrapped by our TransformInterceptor
        expect(res.body.data).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            name: 'Test User',
            email: 'test@example.com',
          }),
        );
      });
  });

  it('should get a list of users', async () => {
    // First, create a user to ensure the list is not empty
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({ name: 'Another User', email: 'another@example.com' });

    return request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(200)
      .then((res) => {
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).toHaveProperty('id');
      });
  });

  it('should fail to create a user with invalid data', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users')
      .send({ email: 'only-email@test.com' }) // Name is missing
      .expect(400);
  });
});
