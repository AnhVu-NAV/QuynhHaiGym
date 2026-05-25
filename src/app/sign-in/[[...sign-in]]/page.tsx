import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Quỳnh Hải Gym</h1>
          <p className="text-slate-500 mt-2">Đăng nhập hệ thống quản trị nội bộ</p>
        </div>
        <div className="flex justify-center shadow-xl rounded-xl overflow-hidden">
          <SignIn 
            routing="path" 
            path="/sign-in"
            appearance={{
              elements: {
                footerAction: "hidden", // Ẩn hoàn toàn dòng chữ "Don't have an account? Sign up"
              }
            }} 
          />
        </div>
      </div>
    </div>
  );
}
