import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
const username = 'teststudent3';
const password = 'Test1234!';
let user = await prisma.user.findUnique({ where: { username } });
if (!user) {
  const zone = await prisma.pricingArea.findFirst({ where: { isActive: true } });
  const destination = await prisma.destination.findFirst({ where: { isActive: true } });
  if (!zone || !destination) {
    throw new Error('No pricing zone or destination found');
  }
  const student = await prisma.student.create({
    data: {
      name: 'Test Student 3',
      phone: '0500000003',
      whatsapp: '0500000003',
      zone: zone.name,
      destinationId: destination.id,
      transportMode: 'LINE'
    }
  });
  user = await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(password, 10),
      name: 'Test Student 3',
      phone: '0500000003',
      role: 'student',
      studentId: student.id,
      mustChangePassword: false
    }
  });
  console.log(JSON.stringify({ status: 'created', username, password, studentId: student.id }));
} else {
  console.log(JSON.stringify({ status: 'exists', username, studentId: user.studentId ?? null }));
}
await prisma.$disconnect();
