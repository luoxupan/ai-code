import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FaqService } from '../modules/faq/faq.service';

const queries = [
  '怎么发邮件',
  '我要发一封邮件给客户',
  '退款多久能到账',
  '你们客服几点上班',
  '忘记密码登不上了',
  '能批量采购吗',
  '你们老板是谁',
  '今天天气怎么样',
  '如何删除我的账号',
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const faqService = app.get(FaqService);
    for (const query of queries) {
      const results = await faqService.search(query);
      console.log(
        `${query} => ${results.length ? `${results[0].question} (${results[0].score.toFixed(3)})` : '无命中'}`,
      );
    }
  } finally {
    await app.close();
  }
}
void main();
