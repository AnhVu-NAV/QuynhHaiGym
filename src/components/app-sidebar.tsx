"use client"

import * as React from "react"
import { Dumbbell, Users, QrCode, CreditCard, LayoutDashboard, Calendar, UsersRound, Settings, Shield } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type AppSidebarProps = {
  role?: string
}

export function AppSidebar({ role = "staff" }: AppSidebarProps) {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const items = [
    { title: "Tổng quan", url: "/", icon: LayoutDashboard },
    { title: "Hội viên", url: "/members", icon: Users },
    { title: "Check-in", url: "/check-ins", icon: QrCode },
    { title: "Gói tập", url: "/packages", icon: CreditCard },
  ]

  const ptItems = [
    { title: "Huấn luyện viên", url: "/trainers", icon: UsersRound },
    { title: "Lịch tập PT", url: "/schedule", icon: Calendar },
    { title: "Lớp học Group X", url: "/classes", icon: Dumbbell },
  ]

  const adminItems = [
    { title: "Phân quyền & Tài khoản", url: "/users", icon: Shield },
    {
      title: "Cấu hình",
      url: "/settings",
      icon: Settings,
    },
    {
      title: "Nhật ký hệ thống",
      url: "/logs",
      icon: Settings,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="p-4 flex items-center justify-center border-b">
        <Dumbbell className="h-8 w-8 text-emerald-600 mb-2" />
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider text-center">Quỳnh Hải<br />Gym</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quản lý Phòng Tập</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} onClick={handleLinkClick} />} isActive={pathname === item.url}>
                    <item.icon className={pathname === item.url ? "text-emerald-600" : "text-slate-500"} />
                    <span className={pathname === item.url ? "font-medium text-slate-800" : ""}>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Dịch vụ PT & Lớp học</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ptItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} onClick={handleLinkClick} />} isActive={pathname === item.url}>
                    <item.icon className={pathname === item.url ? "text-emerald-600" : "text-slate-500"} />
                    <span className={pathname === item.url ? "font-medium text-slate-800" : ""}>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Quản trị Hệ thống</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton render={<Link href={item.url} onClick={handleLinkClick} />} isActive={pathname === item.url}>
                      <item.icon className="text-emerald-600" />
                      <span className="font-medium">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
    </Sidebar>
  )
}
