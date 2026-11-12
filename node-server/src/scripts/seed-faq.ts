import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { CreateFaqDto } from '../modules/faq/dto/create-faq.dto';
import { Faq } from '../modules/faq/entities/faq.entity';
import { FaqService } from '../modules/faq/faq.service';

const SEED_FAQS: CreateFaqDto[] = [
  {
    question: '你们的产品支持哪些功能？',
    answer:
      '当前支持在线客服对话、猜你想问、FAQ 卡片、订单卡片以及邮件发送，后续会持续补充更多能力。',
    category: '产品',
  },
  {
    question: '如何发送邮件？',
    answer:
      '在对话中直接告诉客服你想发送邮件，系统会推送发送邮件卡片，填写收件人、主题和内容后提交即可。',
    category: '功能',
  },
  {
    question: '忘记密码或无法登录怎么办？',
    answer:
      '请确认账号与密码是否正确；仍然无法登录时，请联系客服并提供注册邮箱，我们会协助重置。',
    category: '账号',
  },
  {
    question: '客服的工作时间是？',
    answer:
      '人工客服工作时间为每天 9:00-21:00，其余时间可以留言，我们会尽快回复。',
    category: '客服',
  },
  {
    question: '如何查看我的历史会话？',
    answer:
      '同一账号重新进入客服页面会恢复最近的会话记录；如需彻底清理，可在会话结束后重新发起。',
    category: '账号',
  },
  {
    question: '订单状态在哪里查看？',
    answer:
      '订单状态会以订单卡片的形式推送到对话中，也可以联系人工客服查询最新进度。',
    category: '订单',
  },
  {
    question: '退款多久能到账？',
    answer:
      '退款审核通过后原路退回，通常 1-3 个工作日到账，具体以支付渠道为准。',
    category: '订单',
  },
  {
    question: '你们支持企业采购或批量下单吗？',
    answer:
      '支持，请通过邮件或人工客服联系我们，提供采购数量与需求，会有专人跟进。',
    category: '商务',
  },
];

const logger = new Logger('SeedFaq');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const faqService = app.get(FaqService);
    const repository = app.get<Repository<Faq>>(getRepositoryToken(Faq));
    const existing = await faqService.findAll();
    const existingQuestions = new Set(existing.map((faq) => faq.question));

    const pending = SEED_FAQS.filter(
      (item) => !existingQuestions.has(item.question),
    );

    if (pending.length) {
      // 批量落库后再统一 reindex，避免逐条触发 embedding（Ollama 不可用时尤其明显）。
      await repository.save(
        pending.map((item) =>
          repository.create({
            ...item,
            category: item.category ?? null,
            enabled: item.enabled ?? true,
            index_status: 'pending',
          }),
        ),
      );
    }

    const { indexed } = await faqService.reindex();
    logger.log(`Seeded ${pending.length} FAQ(s), indexed ${indexed} record(s)`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
