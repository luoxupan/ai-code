import { Controller, Get, Res, Param, Req } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebsiteService } from './website.service';

@Controller('website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get('*path')
  getPage(@Param('path') path: string, @Req() req: Request, @Res() res: Response): void {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const html = this.websiteService.getPage(fullUrl);
    res.type('text/html').send(html);
  }
}
