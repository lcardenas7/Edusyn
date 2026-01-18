import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        institutionId: dto.institutionId,
        authorId,
        type: dto.type,
        subject: dto.subject,
        content: dto.content,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        recipients: {
          create: dto.recipients.map((r) => ({
            recipientType: r.type,
            recipientId: r.recipientId,
          })),
        },
      },
      include: {
        recipients: true,
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id },
      data: {
        type: dto.type,
        subject: dto.subject,
        content: dto.content,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
      include: {
        recipients: true,
      },
    });
  }

  async send(id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.delete({ where: { id } });
  }

  async getByInstitution(institutionId: string, status?: string) {
    return this.prisma.message.findMany({
      where: {
        institutionId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        recipients: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        recipients: true,
      },
    });

    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async markAsRead(messageId: string, recipientId: string) {
    return this.prisma.messageRecipient.updateMany({
      where: {
        messageId,
        recipientId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  async getInbox(userId: string) {
    return this.prisma.messageRecipient.findMany({
      where: {
        OR: [
          { recipientId: userId },
          { recipientType: 'ALL_TEACHERS' },
          { recipientType: 'ALL_STUDENTS' },
        ],
      },
      include: {
        message: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
