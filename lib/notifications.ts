import prisma from '@/lib/db'

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  await prisma.notification.create({
    data: { userId, title, body, link: link ?? null },
  })
}
