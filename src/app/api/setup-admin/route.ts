import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập vào Clerk trước!' }, { status: 401 });
  }

  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy thông tin user từ Clerk' }, { status: 400 });
  }

  const email = user.emailAddresses[0]?.emailAddress || '';

  // Check if user exists in our DB
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (existingUser) {
    // Make them admin
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));
    return NextResponse.json({ message: 'Đã cấp lại quyền Admin cho tài khoản hiện tại!' });
  } else {
    // Insert new admin user
    await db.insert(users).values({
      id: userId,
      email: email,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      role: 'admin',
    });
    return NextResponse.json({ message: 'Đã tạo mới và cấp quyền Admin thành công!' });
  }
}
