import { PrismaClient } from '../generated';

const prisma = new PrismaClient();

async function test() {
  try {
    const job = await prisma.job.findFirst();
    const user = await prisma.user.findFirst();
    if (!job || !user) {
      console.log('No job or user found - skipping constraint test');
      return;
    }
    
    console.log('Testing CHECK constraint...');
    try {
      await prisma.returnClaim.create({
        data: {
          id: 'test-constraint',
          originalJobId: job.id,
          returnReason: 'test',
          status: 'RESOLVED',
          openedById: user.id,
        }
      });
      await prisma.returnClaim.delete({ where: { id: 'test-constraint' } });
      console.log('FAIL: Constraint did not fire');
    } catch (e: any) {
      if (e.message.includes('check constraint')) {
        console.log('PASS: CHECK constraint fired correctly');
      } else {
        console.log('Unexpected error: ' + e.message);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

test();
