import { prisma } from "./db";
export async function enqueue(type: string, payload: Record<string, unknown>, projectId?: string, runAfter?: Date) {
  return prisma.job.create({ data: { type, payload: JSON.stringify(payload), projectId, runAfter: runAfter ?? new Date() } });
}
