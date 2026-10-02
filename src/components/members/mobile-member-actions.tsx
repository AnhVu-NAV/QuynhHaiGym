"use client"

import Link from "next/link"
import { ExternalLink, MoreHorizontal } from "lucide-react"
import { MemberDialog } from "@/components/members/member-dialog"
import { DeleteMemberButton } from "@/components/members/delete-member-button"
import { PreservationDialog, type PreservationHistory } from "@/components/subscriptions/preservation-dialog"
import { RefundDialog } from "@/components/transactions/refund-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { EnrollmentDeviceOption } from "@/components/devices/face-enrollment-button"

type MobileMemberActionsProps = {
  member: {
    id: number
    publicToken: string
    fullName: string
    phoneNumber: string
    gender: string | null
    status: string
    avatarUrl?: string | null
  }
  packages: { id: number; name: string; price: number; durationMonths: number }[]
  settings?: { bankId: string | null; accountNo: string | null; accountName: string | null }
  devices: EnrollmentDeviceOption[]
  cloudinaryApiKey?: string
  cloudinaryCloudName?: string
  currentSubscription?: { endDate: Date }
  preservationHistory: PreservationHistory[]
  refundableTransaction?: { id: number; amount: number; paymentMethod: string | null }
  isAdmin: boolean
}

const actionClass = "h-11 w-full justify-start rounded-xl px-3 text-sm"

export function MobileMemberActions({
  member,
  packages,
  settings,
  devices,
  cloudinaryApiKey,
  cloudinaryCloudName,
  currentSubscription,
  preservationHistory,
  refundableTransaction,
  isAdmin,
}: MobileMemberActionsProps) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="h-9 w-full justify-center rounded-xl px-2 text-xs" />}>
        <MoreHorizontal className="h-4 w-4" /> Thao tác
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <SheetHeader className="px-0 pb-2 pr-10">
          <SheetTitle>Thao tác hội viên</SheetTitle>
          <SheetDescription>{member.fullName} · {member.phoneNumber}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 overflow-y-auto pb-1">
          {isAdmin && currentSubscription && (
            <PreservationDialog
              memberId={member.id}
              memberName={member.fullName}
              membershipEndDate={currentSubscription.endDate}
              history={preservationHistory}
              triggerClassName={actionClass}
            />
          )}
          <Link href={`/my-card/${member.publicToken}`} target="_blank" className="inline-flex h-11 w-full items-center justify-start gap-2 rounded-xl border border-indigo-200 px-3 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50">
            <ExternalLink className="h-4 w-4" /> Xem thẻ hội viên
          </Link>
          <MemberDialog
            mode="edit"
            memberData={member}
            packages={packages}
            settings={settings}
            devices={devices}
            cloudinaryApiKey={cloudinaryApiKey}
            cloudinaryCloudName={cloudinaryCloudName}
            triggerClassName={actionClass}
            editTriggerLabel="Chỉnh sửa thông tin"
          />
          {isAdmin && refundableTransaction && (
            <RefundDialog
              transactionId={refundableTransaction.id}
              memberName={member.fullName}
              amount={refundableTransaction.amount}
              paymentMethod={refundableTransaction.paymentMethod}
              triggerLabel="Hủy gói & hoàn tiền"
              triggerClassName={actionClass}
            />
          )}
          {isAdmin && (
            <DeleteMemberButton id={member.id} triggerLabel="Xóa ẩn danh hội viên" triggerClassName={actionClass} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
