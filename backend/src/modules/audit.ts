import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export async function journaliser(utilisateurId: string | null, action: string, cible?: string, details?: Prisma.InputJsonValue): Promise<void> {
  await prisma.journalAudit.create({ data: { utilisateurId, action, cible, details } });
}
