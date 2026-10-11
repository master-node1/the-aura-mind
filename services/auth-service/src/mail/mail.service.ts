import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Sends auth emails over SMTP_URL. Without SMTP_URL nothing is sent: outside
 * production the link is logged so local signups can still be verified.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const smtpUrl = config.get<string>('SMTP_URL');
    if (smtpUrl) this.transport = nodemailer.createTransport(smtpUrl);
  }

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    if (!this.transport) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.warn('SMTP_URL is not set; verification email not sent');
      } else {
        this.logger.log(`SMTP_URL is not set; verification link for ${to}: ${link}`);
      }
      return;
    }
    await this.transport.sendMail({
      from: this.config.get<string>('MAIL_FROM') || 'AuraMind <no-reply@localhost>',
      to,
      subject: 'Verify your AuraMind email address',
      text: `Confirm your email address by opening this link:\n\n${link}\n\nIf you didn't sign up, ignore this email.`,
    });
  }
}
