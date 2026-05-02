import { Controller, Get } from '@nestjs/common';
import { TestService } from './test.service';

@Controller('app/test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get()
  getTest(): string {
    return this.testService.getTest();
  }
}
