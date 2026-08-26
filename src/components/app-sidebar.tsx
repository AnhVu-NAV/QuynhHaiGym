"use client"

import * as React from "react"
import { Dumbbell, Users, QrCode, CreditCard, LayoutDashboard, Calendar, UsersRound, Settings, Shield, Cpu } from "lucide-react"
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
    { title: "Đội ngũ PT", url: "/trainers", icon: UsersRound },
    { title: "Lịch tập PT", url: "/schedule", icon: Calendar },
    { title: "Lớp học Group X", url: "/classes", icon: Dumbbell },
  ]

  const adminItems = [
    { title: "Máy nhận diện", url: "/devices", icon: Cpu },
    { title: "Nhân viên & tài khoản", url: "/users", icon: Shield },
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
    <Sidebar className="border-r border-slate-200 bg-white text-slate-700">
      <SidebarHeader className="flex min-h-24 flex-row items-center gap-3 border-b border-slate-200 bg-white p-5">
        <span className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700 shadow-sm"><Dumbbell className="h-6 w-6" /></span>
        <div><h2 className="text-lg font-black uppercase tracking-wider text-slate-900">Quỳnh Hải Gym</h2><p className="mt-0.5 text-xs font-medium text-emerald-600">Quản lý phòng tập</p></div>
      </SidebarHeader>
      <SidebarContent className="bg-white px-2 py-3 [&_[data-slot=sidebar-group-label]]:font-semibold [&_[data-slot=sidebar-group-label]]:text-slate-400 [&_[data-slot=sidebar-menu-button]]:h-11 [&_[data-slot=sidebar-menu-button]]:rounded-xl [&_[data-slot=sidebar-menu-button]]:text-slate-600 [&_[data-slot=sidebar-menu-button]]:hover:bg-slate-100 [&_[data-slot=sidebar-menu-button]]:hover:text-slate-900 [&_[data-active=true]]:bg-emerald-100 [&_[data-active=true]]:text-emerald-800">
        <SidebarGroup>
          <SidebarGroupLabel>Quản lý Phòng Tập</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} onClick={handleLinkClick} />} isActive={pathname === item.url}>
                    <item.icon />
                    <span className={pathname === item.url ? "font-bold" : ""}>{item.title}</span>
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
                    <item.icon />
                    <span className={pathname === item.url ? "font-bold" : ""}>{item.title}</span>
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
                      <item.icon />
                      <span className={pathname === item.url ? "font-bold" : ""}>{item.title}</span>
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
