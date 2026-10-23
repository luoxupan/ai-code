import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import nodemailer, { Transporter } from 'nodemailer';
import { MailConfig } from '../../config';
import { SendMailDto } from './dto/send-mail.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    const mail = configService.get<MailConfig>('config.mail');
    if (!mail) {
      throw new Error('Mail configuration is missing');
    }

    this.from = mail.from;
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
    });
  }

  async sendMail(input: SendMailDto): Promise<void> {
    const recipients = input.recipients
      .split(',')
      .map((recipient) => recipient.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      throw new BadRequestException('收件人不能为空');
    }

    const invalidRecipient = recipients.find(
      (recipient) => !isEmail(recipient),
    );
    if (invalidRecipient) {
      throw new BadRequestException(`收件人邮箱无效: ${invalidRecipient}`);
    }

    if (!this.from) {
      throw new BadRequestException('SMTP 发件人未配置');
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipients.join(','),
        subject: input.subject,
        text: input.body,
        html: input.body.replace(/\r?\n/g, '<br>'),
      });
    } catch (error: unknown) {
      this.logger.error(`Failed to send mail: ${JSON.stringify(error)}`);
      throw new BadRequestException('发送邮件失败');
    }
  }
}
