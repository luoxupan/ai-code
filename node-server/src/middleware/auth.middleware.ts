import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly httpService: HttpService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authApiUrl = 'http://localhost:3001/auth';
    try {
      // In a real scenario, you would probably pass some token from the request to the auth service.
      const { data } = await firstValueFrom(
        this.httpService.post(authApiUrl, { token: req.headers.authorization }),
      );

      // Since the auth API is not ready, we'll use a placeholder logic.
      // We will assume the request is authorized if a specific header is present.
      // You should replace this with the actual API call commented out above once the service is ready.

      console.log('---In AuthMiddleware---');

      if (data?.errno === 0) {
        // Placeholder for successful authentication
        console.log(
          'Authorization header found. Assuming successful authentication.',
        );
        next();
      } else {
        // Placeholder for failed authentication
        console.log('Authorization header not found. Denying access.');
        res.status(401).send('Unauthorized');
      }
    } catch (error) {
      // This will catch errors when calling the auth API, e.g., network errors, or if the auth service returns a 4xx/5xx response.
      let errorMessage = 'An unknown error occurred during authentication.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Error during authentication:', errorMessage);
      res.status(401).send('Unauthorized');
    }
  }
}
