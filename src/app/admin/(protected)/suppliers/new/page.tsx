import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SupplierForm } from "@/components/admin/supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      <Link
        href="/admin/suppliers"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to suppliers
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">New supplier</h1>
      <SupplierForm />
    </div>
  );
}
