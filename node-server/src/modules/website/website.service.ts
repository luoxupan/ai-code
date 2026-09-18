import { Injectable } from '@nestjs/common';

@Injectable()
export class WebsiteService {
  getPage(currentUrl: string): string {
    const safeUrl = currentUrl
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<h1>HelloWorld</h1><p>当前访问的URL: ${safeUrl}</p>`;
  }
}
